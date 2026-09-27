const Task = require('../models/Task');
const Subject = require('../models/Subject');
const StudySession = require('../models/StudySession');
const User = require('../models/User');

// @desc    Get analytics overview
// @route   GET /api/analytics/overview
exports.getOverview = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Task stats
    const totalTasks = await Task.countDocuments({ user: userId });
    const completedTasks = await Task.countDocuments({ user: userId, status: 'completed' });
    const pendingTasks = await Task.countDocuments({ user: userId, status: 'pending' });
    const inProgressTasks = await Task.countDocuments({ user: userId, status: 'in-progress' });

    // Overdue tasks
    const overdueTasks = await Task.countDocuments({
      user: userId,
      status: { $ne: 'completed' },
      dueDate: { $lt: new Date() }
    });

    // Study sessions
    const allSessions = await StudySession.find({ user: userId });
    const totalStudyMinutes = allSessions.reduce((sum, s) => sum + s.duration, 0);
    const avgFocusScore = allSessions.length > 0
      ? allSessions.reduce((sum, s) => sum + s.focusScore, 0) / allSessions.length
      : 0;

    // This week's study time
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekSessions = allSessions.filter(s => new Date(s.startTime) >= weekStart);
    const weeklyStudyMinutes = weekSessions.reduce((sum, s) => sum + s.duration, 0);

    // Subject count
    const subjectCount = await Subject.countDocuments({ user: userId });

    // Study streak
    const user = await User.findById(userId);

    // Upcoming deadlines (next 7 days)
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
        streak: user.studyStreak,
        subjectCount,
        upcomingDeadlines
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get study trends (last 30 days)
// @route   GET /api/analytics/study-trends
exports.getStudyTrends = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(days));
    startDate.setHours(0, 0, 0, 0);

    const sessions = await StudySession.find({
      user: req.user._id,
      startTime: { $gte: startDate }
    }).populate('subject', 'name color');

    // Group by date
    const dailyData = {};
    for (let i = 0; i < Number(days); i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      dailyData[key] = { date: key, minutes: 0, sessions: 0, avgFocus: 0, focusSum: 0 };
    }

    sessions.forEach(session => {
      const key = new Date(session.startTime).toISOString().split('T')[0];
      if (dailyData[key]) {
        dailyData[key].minutes += session.duration;
        dailyData[key].sessions += 1;
        dailyData[key].focusSum += session.focusScore;
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

// @desc    Get subject performance
// @route   GET /api/analytics/subject-performance
exports.getSubjectPerformance = async (req, res, next) => {
  try {
    const subjects = await Subject.find({ user: req.user._id });

    const performance = await Promise.all(subjects.map(async (subject) => {
      const tasks = await Task.find({ subject: subject._id, user: req.user._id });
      const sessions = await StudySession.find({ subject: subject._id, user: req.user._id });

      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'completed').length;
      const totalStudyMinutes = sessions.reduce((sum, s) => sum + s.duration, 0);

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

// @desc    Log a study session
// @route   POST /api/analytics/sessions
exports.createSession = async (req, res, next) => {
  try {
    req.body.user = req.user._id;

    // Calculate duration if start and end provided
    if (req.body.startTime && req.body.endTime) {
      const start = new Date(req.body.startTime);
      const end = new Date(req.body.endTime);
      req.body.duration = Math.round((end - start) / (1000 * 60));
    }

    const session = await StudySession.create(req.body);

    // Update subject total study minutes
    if (req.body.subject) {
      await Subject.findByIdAndUpdate(req.body.subject, {
        $inc: { totalStudyMinutes: session.duration }
      });
    }

    // Update study streak
    const user = await User.findById(req.user._id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastStudy = user.studyStreak.lastStudyDate ? new Date(user.studyStreak.lastStudyDate) : null;

    if (!lastStudy || lastStudy < today) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let newStreak = 1;
      if (lastStudy && lastStudy >= yesterday) {
        newStreak = user.studyStreak.current + 1;
      }

      await User.findByIdAndUpdate(req.user._id, {
        'studyStreak.current': newStreak,
        'studyStreak.longest': Math.max(newStreak, user.studyStreak.longest),
        'studyStreak.lastStudyDate': new Date()
      });
    }

    // Update task completed minutes
    if (req.body.task) {
      const Task = require('../models/Task');
      await Task.findByIdAndUpdate(req.body.task, {
        $inc: { completedMinutes: session.duration }
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
