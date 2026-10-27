const Task = require('../models/Task');
const Subject = require('../models/Subject');
const StudySession = require('../models/StudySession');
const User = require('../models/User');


function calculateUrgency(dueDate) {
  const now = new Date();
  const due = new Date(dueDate);
  const hoursUntilDue = (due - now) / (1000 * 60 * 60);

  if (hoursUntilDue <= 0) return 100;
  if (hoursUntilDue <= 24) return 95;
  if (hoursUntilDue <= 48) return 85;
  if (hoursUntilDue <= 72) return 70;
  if (hoursUntilDue <= 168) return 50;
  if (hoursUntilDue <= 336) return 30;
  return 10;
}

function calculateTaskScore(task, subjectPerformance) {
  const urgency = calculateUrgency(task.dueDate);
  const priorityWeight = (task.priority / 5) * 100;
  const difficultyWeight = (task.difficulty / 5) * 30;

  let performanceGap = 0;
  if (subjectPerformance && subjectPerformance.targetGrade && subjectPerformance.currentGrade) {
    const gap = subjectPerformance.targetGrade - subjectPerformance.currentGrade;
    performanceGap = Math.max(0, gap) * 0.5;
  }

  return (urgency * 0.4) + (priorityWeight * 0.3) + (difficultyWeight * 0.15) + (performanceGap * 0.15);
}

function generateTimeSlots(startTime, endTime, sessionDuration, breakDuration) {
  const slots = [];
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  let currentMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  while (currentMinutes + sessionDuration <= endMinutes) {
    const slotStart = `${String(Math.floor(currentMinutes / 60)).padStart(2, '0')}:${String(currentMinutes % 60).padStart(2, '0')}`;
    const slotEnd = `${String(Math.floor((currentMinutes + sessionDuration) / 60)).padStart(2, '0')}:${String((currentMinutes + sessionDuration) % 60).padStart(2, '0')}`;

    slots.push({
      startTime: slotStart,
      endTime: slotEnd,
      duration: sessionDuration
    });

    currentMinutes += sessionDuration + breakDuration;
  }

  return slots;
}

exports.generateSchedule = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const { days = 7 } = req.body;

    const tasks = await Task.find({
      user: req.user._id,
      status: { $ne: 'completed' }
    }).populate('subject');

    const subjects = await Subject.find({ user: req.user._id });
    const subjectMap = {};
    subjects.forEach(s => { subjectMap[s._id.toString()] = s; });

    const scoredTasks = tasks.map(task => ({
      task,
      score: calculateTaskScore(task, task.subject ? subjectMap[task.subject._id.toString()] : null)
    })).sort((a, b) => b.score - a.score);

    const schedule = [];
    const { sessionDuration = 45, breakDuration = 15, preferredStartTime = '09:00', preferredEndTime = '21:00', studyHoursPerDay = 4 } = user.preferences || {};

    const maxSlotsPerDay = Math.floor((studyHoursPerDay * 60) / (sessionDuration + breakDuration));

    for (let day = 0; day < days; day++) {
      const date = new Date();
      date.setDate(date.getDate() + day);
      date.setHours(0, 0, 0, 0);

      const timeSlots = generateTimeSlots(preferredStartTime, preferredEndTime, sessionDuration, breakDuration);
      const daySlots = timeSlots.slice(0, maxSlotsPerDay);

      const daySchedule = {
        date: date.toISOString().split('T')[0],
        dayName: date.toLocaleDateString('en-US', { weekday: 'long' }),
        sessions: []
      };

      let taskIndex = 0;
      for (const slot of daySlots) {
        if (taskIndex >= scoredTasks.length) break;

        const { task, score } = scoredTasks[taskIndex];
        const remainingMinutes = task.estimatedMinutes - task.completedMinutes;

        if (remainingMinutes <= 0) {
          taskIndex++;
          continue;
        }

        daySchedule.sessions.push({
          taskId: task._id,
          taskTitle: task.title,
          subject: task.subject ? {
            name: task.subject.name,
            color: task.subject.color,
            icon: task.subject.icon
          } : null,
          type: task.type,
          priority: task.priority,
          urgencyScore: Math.round(score),
          startTime: slot.startTime,
          endTime: slot.endTime,
          duration: slot.duration,
          dueDate: task.dueDate
        });

        if (remainingMinutes > sessionDuration) {
        } else {
          taskIndex++;
        }
      }

      schedule.push(daySchedule);
    }

    const insights = generateInsights(scoredTasks, subjects);

    res.status(200).json({
      success: true,
      data: {
        schedule,
        insights,
        meta: {
          totalTasks: tasks.length,
          daysPlanned: days,
          sessionDuration,
          breakDuration
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

function generateInsights(scoredTasks, subjects) {
  const insights = [];

  const urgentTasks = scoredTasks.filter(st => calculateUrgency(st.task.dueDate) >= 85);
  if (urgentTasks.length > 0) {
    insights.push({
      type: 'urgent',
      icon: '🔥',
      title: 'Urgent Tasks Detected',
      message: `You have ${urgentTasks.length} task${urgentTasks.length > 1 ? 's' : ''} due within 48 hours. Focus on these first!`,
      priority: 'high'
    });
  }

  const weakSubjects = subjects.filter(s => s.currentGrade > 0 && s.currentGrade < s.targetGrade - 10);
  if (weakSubjects.length > 0) {
    insights.push({
      type: 'performance',
      icon: '📊',
      title: 'Performance Gap Alert',
      message: `${weakSubjects.map(s => s.name).join(', ')} ${weakSubjects.length > 1 ? 'are' : 'is'} below your target grade. Consider allocating more study time.`,
      priority: 'medium'
    });
  }

  const totalMinutes = scoredTasks.reduce((sum, st) => sum + (st.task.estimatedMinutes - st.task.completedMinutes), 0);
  const totalHours = Math.round(totalMinutes / 60);
  insights.push({
    type: 'workload',
    icon: '⏱️',
    title: 'Workload Overview',
    message: `You have approximately ${totalHours} hours of study remaining across ${scoredTasks.length} tasks.`,
    priority: 'info'
  });

  insights.push({
    type: 'tip',
    icon: '💡',
    title: 'Study Tip',
    message: 'Try the Pomodoro technique: 45 min focused study followed by a 15 min break. Your brain retains more with spaced intervals!',
    priority: 'info'
  });

  return insights;
}

exports.getTodaySchedule = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const tasks = await Task.find({
      user: req.user._id,
      status: { $ne: 'completed' },
      $or: [
        { scheduledDate: { $gte: today, $lt: tomorrow } },
        { dueDate: { $gte: today, $lt: tomorrow } }
      ]
    }).populate('subject', 'name color icon').sort({ priority: -1, dueDate: 1 });

    const sessions = await StudySession.find({
      user: req.user._id,
      startTime: { $gte: today, $lt: tomorrow }
    }).populate('subject', 'name color');

    res.status(200).json({
      success: true,
      data: {
        tasks,
        sessions,
        totalStudyMinutes: sessions.reduce((sum, s) => sum + s.duration, 0)
      }
    });
  } catch (error) {
    next(error);
  }
};
