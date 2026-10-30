const Task = require('../models/Task');
const Subject = require('../models/Subject');
const StudySession = require('../models/StudySession');
const User = require('../models/User');

exports.getOverview = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const totalTasks = await Task.countDocuments({ user: userId });
    const completedTasks = await Task.countDocuments({ user: userId, status: 'completed' });
    const pendingTasks = await Task.countDocuments({ user: userId, status: 'pending' });
    const inProgressTasks = await Task.countDocuments({ user: userId, status: 'in-progress' });

    const overdueTasks = await Task.countDocuments({
      user: userId,
      status: { $ne: 'completed' },
      dueDate: { $lt: new Date() }
    });

    const allSessions = await StudySession.find({ user: userId });
    const totalStudyMinutes = allSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const avgFocusScore = allSessions.length > 0
      ? allSessions.reduce((sum, s) => sum + (s.focusScore || 0), 0) / allSessions.length
      : 0;

    // Standard ISO week start (Monday 00:00:00)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - diffToMonday);
    weekStart.setHours(0, 0, 0, 0);

    const weekSessions = allSessions.filter(s => new Date(s.startTime) >= weekStart);
    const weeklyStudyMinutes = weekSessions.reduce((sum, s) => sum + (s.duration || 0), 0);

    const subjectCount = await Subject.countDocuments({ user: userId });

    const user = await User.findById(userId);

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const upcomingDeadlines = await Task.find({
      user: userId,
      status: { $ne: 'completed' },
      dueDate: { $gte: new Date(), $lte: nextWeek }
    }).populate('subject', 'name color icon').sort({ dueDate: 1 }).limit(5);

    res.status(200).json({
      success: true,
      data: {
        tasks: {
          total: totalTasks,
          completed: completedTasks,
          pending: pendingTasks,
          inProgress: inProgressTasks,
          overdue: overdueTasks,
          completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
        },
        study: {
          totalMinutes: totalStudyMinutes,
          totalHours: Math.round(totalStudyMinutes / 60 * 10) / 10,
          weeklyMinutes: weeklyStudyMinutes,
          weeklyHours: Math.round(weeklyStudyMinutes / 60 * 10) / 10,
          avgFocusScore: Math.round(avgFocusScore * 10) / 10,
          totalSessions: allSessions.length
        },
        streak: user?.studyStreak || { current: 0, longest: 0 },
        subjectCount,
        upcomingDeadlines
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getStudyTrends = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const numDays = Math.min(Math.max(1, Number(days) || 30), 90);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - numDays + 1);
    startDate.setHours(0, 0, 0, 0);

    const sessions = await StudySession.find({
      user: req.user._id,
      startTime: { $gte: startDate }
    }).populate('subject', 'name color');

    const dailyData = {};
    for (let i = 0; i < numDays; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      dailyData[key] = { date: key, minutes: 0, sessions: 0, avgFocus: 0, focusSum: 0 };
    }

    sessions.forEach(session => {
      const key = new Date(session.startTime).toISOString().split('T')[0];
      if (dailyData[key]) {
        dailyData[key].minutes += (session.duration || 0);
        dailyData[key].sessions += 1;
        dailyData[key].focusSum += (session.focusScore || 0);
      }
    });

    const trends = Object.values(dailyData).map(d => ({
      ...d,
      hours: Math.round(d.minutes / 60 * 10) / 10,
      avgFocus: d.sessions > 0 ? Math.round(d.focusSum / d.sessions * 10) / 10 : 0
    }));

    res.status(200).json({
      success: true,
      data: trends
    });
  } catch (error) {
    next(error);
  }
};

exports.getSubjectPerformance = async (req, res, next) => {
  try {
    const subjects = await Subject.find({ user: req.user._id });

    const performance = await Promise.all(subjects.map(async (subject) => {
      const tasks = await Task.find({ subject: subject._id, user: req.user._id });
      const sessions = await StudySession.find({ subject: subject._id, user: req.user._id });

      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'completed').length;
      const totalStudyMinutes = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);

      return {
        _id: subject._id,
        name: subject.name,
        color: subject.color,
        icon: subject.icon,
        currentGrade: subject.currentGrade,
        targetGrade: subject.targetGrade,
        credits: subject.credits,
        totalTasks,
        completedTasks,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        studyHours: Math.round(totalStudyMinutes / 60 * 10) / 10
      };
    }));

    res.status(200).json({
      success: true,
      data: performance
    });
  } catch (error) {
    next(error);
  }
};

exports.createSession = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // 1. Validate timestamps and duration
    let startTime = req.body.startTime ? new Date(req.body.startTime) : null;
    let endTime = req.body.endTime ? new Date(req.body.endTime) : null;
    let duration = Number(req.body.duration);

    if (!startTime || isNaN(startTime.getTime())) {
      // Derive start time if duration is available, otherwise default to now
      if (!isNaN(duration) && duration > 0) {
        startTime = new Date(Date.now() - duration * 60 * 1000);
      } else {
        startTime = new Date();
      }
    }

    if (!endTime || isNaN(endTime.getTime())) {
      if (!isNaN(duration) && duration > 0) {
        endTime = new Date(startTime.getTime() + duration * 60 * 1000);
      } else {
        endTime = new Date();
      }
    }

    // Calculate actual elapsed minutes if not provided or to verify
    if (isNaN(duration) || duration <= 0) {
      duration = Math.max(1, Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)));
    }

    if (duration > 1440) {
      return res.status(400).json({
        success: false,
        message: 'Session duration cannot exceed 24 hours (1440 minutes)'
      });
    }

    // 2. Verify Subject Ownership
    let verifiedSubject = null;
    if (req.body.subject) {
      verifiedSubject = await Subject.findOne({ _id: req.body.subject, user: userId });
      if (!verifiedSubject) {
        return res.status(404).json({
          success: false,
          message: 'Subject not found or does not belong to you'
        });
      }
    }

    // 3. Verify Task Ownership
    let verifiedTask = null;
    if (req.body.task) {
      verifiedTask = await Task.findOne({ _id: req.body.task, user: userId });
      if (!verifiedTask) {
        return res.status(404).json({
          success: false,
          message: 'Task not found or does not belong to you'
        });
      }
    }

    const focusScore = Math.min(10, Math.max(1, Number(req.body.focusScore) || 7));

    // 4. Create the Study Session
    const session = await StudySession.create({
      user: userId,
      subject: verifiedSubject ? verifiedSubject._id : null,
      task: verifiedTask ? verifiedTask._id : null,
      startTime,
      endTime,
      duration,
      focusScore,
      type: req.body.type || 'study',
      notes: req.body.notes ? String(req.body.notes).slice(0, 500) : ''
    });

    // 5. Update Subject totalStudyMinutes
    if (verifiedSubject) {
      await Subject.findOneAndUpdate(
        { _id: verifiedSubject._id, user: userId },
        { $inc: { totalStudyMinutes: session.duration } }
      );
    }

    // 6. Update Task completedMinutes (capped at estimatedMinutes to prevent inaccurate runaway progress)
    if (verifiedTask) {
      const currentCompleted = verifiedTask.completedMinutes || 0;
      const estimated = verifiedTask.estimatedMinutes || 60;
      const newCompleted = Math.min(currentCompleted + session.duration, estimated);

      const updateFields = { completedMinutes: newCompleted };
      if (verifiedTask.status === 'pending') {
        updateFields.status = 'in-progress';
      }

      await Task.findOneAndUpdate(
        { _id: verifiedTask._id, user: userId },
        updateFields
      );
    }

    // 7. Update User Study Streak (date-safe comparison)
    const user = await User.findById(userId);
    const streak = user?.studyStreak || { current: 0, longest: 0, lastStudyDate: null };

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    let lastStudyStr = null;
    if (streak.lastStudyDate) {
      lastStudyStr = new Date(streak.lastStudyDate).toISOString().split('T')[0];
    }

    if (lastStudyStr !== todayStr) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      let newStreak = 1;
      if (lastStudyStr === yesterdayStr) {
        newStreak = (streak.current || 0) + 1;
      }

      await User.findByIdAndUpdate(userId, {
        'studyStreak.current': newStreak,
        'studyStreak.longest': Math.max(newStreak, streak.longest || 0),
        'studyStreak.lastStudyDate': now
      });
    }

    res.status(201).json({
      success: true,
      data: session
    });
  } catch (error) {
    next(error);
  }
};
