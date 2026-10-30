const Task = require('../models/Task');
const Subject = require('../models/Subject');
const StudySession = require('../models/StudySession');
const User = require('../models/User');

function calculateUrgency(dueDate) {
  const now = new Date();
  const due = new Date(dueDate);
  const hoursUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilDue <= 0) return 100; // Overdue
  if (hoursUntilDue <= 24) return 95; // Due within 24h
  if (hoursUntilDue <= 48) return 85; // Due within 48h
  if (hoursUntilDue <= 72) return 70; // Due within 3 days
  if (hoursUntilDue <= 168) return 50; // Due within 1 week
  if (hoursUntilDue <= 336) return 30; // Due within 2 weeks
  return 15;
}

function calculateTaskScore(task, subjectPerformance, lastSessionDate = null) {
  const urgency = calculateUrgency(task.dueDate);
  const priorityWeight = ((task.priority || 3) / 5) * 100;
  const difficultyWeight = ((task.difficulty || 3) / 5) * 100;

  let performanceGap = 0;
  if (subjectPerformance && subjectPerformance.targetGrade && subjectPerformance.currentGrade) {
    const gap = subjectPerformance.targetGrade - subjectPerformance.currentGrade;
    performanceGap = Math.max(0, gap);
  }

  // Spaced study deficit: boost if subject hasn't been studied recently
  let recencyBonus = 0;
  if (lastSessionDate) {
    const hoursSinceLastStudy = (Date.now() - new Date(lastSessionDate).getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastStudy > 72) recencyBonus = 20;
    else if (hoursSinceLastStudy > 48) recencyBonus = 10;
  } else {
    recencyBonus = 15;
  }

  // Weighted composite score (Urgency: 40%, Priority: 25%, Difficulty: 15%, Performance Gap: 15%, Spaced Bonus: 5%)
  return (urgency * 0.40) +
         (priorityWeight * 0.25) +
         (difficultyWeight * 0.15) +
         (performanceGap * 0.15) +
         (recencyBonus * 0.05);
}

function generateTimeSlots(startTime, endTime, sessionDuration, breakDuration) {
  const slots = [];
  const [startHour, startMin] = (startTime || '09:00').split(':').map(Number);
  const [endHour, endMin] = (endTime || '21:00').split(':').map(Number);

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
    const numDays = Math.min(Math.max(1, Number(days) || 7), 14);

    // 1. Fetch only pending and in-progress tasks (avoid completed tasks)
    const tasks = await Task.find({
      user: req.user._id,
      status: { $ne: 'completed' }
    }).populate('subject');

    // 2. Map subjects and past sessions for spaced repetition check
    const subjects = await Subject.find({ user: req.user._id });
    const subjectMap = {};
    subjects.forEach(s => { subjectMap[s._id.toString()] = s; });

    const recentSessions = await StudySession.find({ user: req.user._id }).sort({ startTime: -1 });
    const subjectLastStudied = {};
    recentSessions.forEach(s => {
      if (s.subject && !subjectLastStudied[s.subject.toString()]) {
        subjectLastStudied[s.subject.toString()] = s.startTime;
      }
    });

    // 3. Build Remaining-Minutes Tracker for each active task
    const activeTrackers = tasks
      .map(task => {
        const remainingMinutes = Math.max(0, (task.estimatedMinutes || 60) - (task.completedMinutes || 0));
        const sub = task.subject ? subjectMap[task.subject._id.toString()] : null;
        const lastDate = task.subject ? subjectLastStudied[task.subject._id.toString()] : null;
        const score = calculateTaskScore(task, sub, lastDate);

        return {
          task,
          score,
          initialRemaining: remainingMinutes,
          remainingMinutes,
          totalAllocatedMinutes: 0,
          dailySessionsAllocated: 0
        };
      })
      .filter(item => item.remainingMinutes > 0)
      .sort((a, b) => b.score - a.score);

    const schedule = [];
    const preferences = user?.preferences || {};
    const {
      sessionDuration = 45,
      breakDuration = 15,
      preferredStartTime = '09:00',
      preferredEndTime = '21:00',
      studyHoursPerDay = 4
    } = preferences;

    const availableSlots = generateTimeSlots(preferredStartTime, preferredEndTime, sessionDuration, breakDuration);
    const maxSlotsPerDay = Math.min(
      Math.floor((studyHoursPerDay * 60) / (sessionDuration + breakDuration)),
      availableSlots.length
    );

    // Total daily available study capacity
    const dailyAvailableMinutes = maxSlotsPerDay * sessionDuration;
    const totalAvailableMinutes = dailyAvailableMinutes * numDays;

    // 4. Distribute work across days
    for (let day = 0; day < numDays; day++) {
      const date = new Date();
      date.setDate(date.getDate() + day);
      date.setHours(0, 0, 0, 0);

      // Reset daily session counters so tasks are distributed across days instead of clustered
      activeTrackers.forEach(item => { item.dailySessionsAllocated = 0; });

      const daySlots = availableSlots.slice(0, maxSlotsPerDay);
      const daySchedule = {
        date: date.toISOString().split('T')[0],
        dayName: date.toLocaleDateString('en-US', { weekday: 'long' }),
        sessions: []
      };

      for (let sIdx = 0; sIdx < daySlots.length; sIdx++) {
        const slot = daySlots[sIdx];

        // Find candidate tasks that still have work remaining
        // Prefer tasks that haven't exceeded 2 sessions today to avoid fatigue and distribute work
        const candidates = activeTrackers.filter(item => item.remainingMinutes > 0);
        if (candidates.length === 0) break; // All tasks fully scheduled!

        // Prioritize candidates:
        // 1. Due today or tomorrow (highest priority, can have up to 3 daily sessions)
        // 2. Normal tasks (up to 2 daily sessions)
        let chosenTracker = candidates.find(item => {
          const hoursToDue = (new Date(item.task.dueDate).getTime() - date.getTime()) / (1000 * 60 * 60);
          const maxAllowedToday = hoursToDue <= 48 ? 3 : 2;
          return item.dailySessionsAllocated < maxAllowedToday;
        });

        // If all candidates hit their soft daily cap, take the one with the highest score that still has work
        if (!chosenTracker) {
          chosenTracker = candidates[0];
        }

        const allocatedDuration = Math.min(sessionDuration, chosenTracker.remainingMinutes);

        // Update Remaining-Minutes Tracker
        chosenTracker.remainingMinutes -= allocatedDuration;
        chosenTracker.totalAllocatedMinutes += allocatedDuration;
        chosenTracker.dailySessionsAllocated += 1;

        daySchedule.sessions.push({
          id: `slot-${day}-${sIdx}`,
          taskId: chosenTracker.task._id,
          taskTitle: chosenTracker.task.title,
          subject: chosenTracker.task.subject ? {
            _id: chosenTracker.task.subject._id,
            name: chosenTracker.task.subject.name,
            color: chosenTracker.task.subject.color,
            icon: chosenTracker.task.subject.icon
          } : null,
          type: chosenTracker.task.type,
          priority: chosenTracker.task.priority,
          urgencyScore: Math.round(chosenTracker.score),
          startTime: slot.startTime,
          endTime: slot.endTime,
          duration: allocatedDuration,
          dueDate: chosenTracker.task.dueDate,
          status: 'scheduled'
        });
      }

      schedule.push(daySchedule);
    }

    // 5. Generate Warnings & Insights (Check if tasks can be completed before deadline, warn on insufficient time)
    const insights = generateInsights(activeTrackers, subjects, totalAvailableMinutes, numDays);

    res.status(200).json({
      success: true,
      data: {
        schedule,
        insights,
        meta: {
          totalTasks: tasks.length,
          activeTasksTracked: activeTrackers.length,
          daysPlanned: numDays,
          sessionDuration,
          breakDuration,
          dailyAvailableMinutes,
          totalAvailableMinutes
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

function generateInsights(activeTrackers, subjects, totalAvailableMinutes, days) {
  const insights = [];

  // 1. Deadline & Insufficient Time Warnings
  const totalWorkNeeded = activeTrackers.reduce((sum, item) => sum + item.initialRemaining, 0);
  const totalRemainingAfterSchedule = activeTrackers.reduce((sum, item) => sum + item.remainingMinutes, 0);

  if (totalRemainingAfterSchedule > 0 && totalWorkNeeded > totalAvailableMinutes) {
    const deficitHours = Math.round((totalWorkNeeded - totalAvailableMinutes) / 60 * 10) / 10;
    insights.push({
      type: 'warning',
      icon: '⚠️',
      title: 'Insufficient Study Hours Available',
      message: `You have ${Math.round(totalWorkNeeded / 60 * 10) / 10} hours of pending work across ${activeTrackers.length} tasks, but only ${Math.round(totalAvailableMinutes / 60 * 10) / 10} hours configured in your ${days}-day schedule. Consider increasing your daily study hours in Profile.`,
      priority: 'high'
    });
  }

  // 2. Specific tasks with deadline risks
  const atRiskTasks = activeTrackers.filter(item => {
    const now = new Date();
    const dueDate = new Date(item.task.dueDate);
    const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    // If due within planning window and still has unallocated minutes
    return hoursUntilDue <= (days * 24) && item.remainingMinutes > 0;
  });

  if (atRiskTasks.length > 0) {
    const topRisk = atRiskTasks[0];
    insights.push({
      type: 'urgent',
      icon: '🚨',
      title: 'Deadline Risk Detected',
      message: `Task "${topRisk.task.title}" is due ${new Date(topRisk.task.dueDate).toLocaleDateString()}, but still requires ${topRisk.remainingMinutes} min of study that could not fit into available slots!`,
      priority: 'high'
    });
  }

  // 3. Urgent Tasks due in 48 hours
  const urgentTasks = activeTrackers.filter(st => calculateUrgency(st.task.dueDate) >= 85);
  if (urgentTasks.length > 0) {
    insights.push({
      type: 'urgent',
      icon: '🔥',
      title: 'Urgent Tasks Due Soon',
      message: `You have ${urgentTasks.length} task${urgentTasks.length > 1 ? 's' : ''} due within 48 hours. These have been prioritized at the front of your schedule.`,
      priority: 'high'
    });
  }

  // 4. Performance Gap Alert
  const weakSubjects = subjects.filter(s => s.currentGrade > 0 && s.currentGrade < (s.targetGrade - 10));
  if (weakSubjects.length > 0) {
    insights.push({
      type: 'performance',
      icon: '📊',
      title: 'Performance Reinforcement Alert',
      message: `${weakSubjects.map(s => s.name).join(', ')} currently below target grade. Extra focus slots have been weighted accordingly.`,
      priority: 'medium'
    });
  }

  // 5. Workload overview
  insights.push({
    type: 'workload',
    icon: '⏱️',
    title: 'Workload Overview',
    message: `${Math.round(totalWorkNeeded / 60 * 10) / 10} hours of focused work remaining across ${activeTrackers.length} tasks.`,
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
        totalStudyMinutes: sessions.reduce((sum, s) => sum + (s.duration || 0), 0)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Feature 1: Personalized Study Coach & Recommendations
exports.getRecommendations = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [tasks, subjects, recentSessions] = await Promise.all([
      Task.find({ user: userId, status: { $ne: 'completed' } }).populate('subject'),
      Subject.find({ user: userId }),
      StudySession.find({ user: userId }).sort({ startTime: -1 }).limit(20)
    ]);

    if (tasks.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          hasTasks: false,
          message: 'All tasks completed! Add new tasks or subjects to generate recommendations.',
          recommendations: []
        }
      });
    }

    const subjectMap = {};
    subjects.forEach(s => { subjectMap[s._id.toString()] = s; });

    const subjectLastStudied = {};
    recentSessions.forEach(s => {
      if (s.subject && !subjectLastStudied[s.subject.toString()]) {
        subjectLastStudied[s.subject.toString()] = s.startTime;
      }
    });

    // Score all active tasks using rule-based multi-factor evaluation
    const scoredTasks = tasks.map(task => {
      const sub = task.subject ? subjectMap[task.subject._id.toString()] : null;
      const lastSessionDate = task.subject ? subjectLastStudied[task.subject._id.toString()] : null;
      const score = calculateTaskScore(task, sub, lastSessionDate);
      const remainingMinutes = Math.max(0, (task.estimatedMinutes || 60) - (task.completedMinutes || 0));

      const now = new Date();
      const due = new Date(task.dueDate);
      const hoursToDue = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60));

      // Construct recommendation rationale explanation
      const reasons = [];
      if (hoursToDue <= 0) {
        reasons.push('⚠️ This task is overdue and needs immediate resolution.');
      } else if (hoursToDue <= 24) {
        reasons.push(`🔥 Deadline is within 24 hours (${hoursToDue}h remaining).`);
      } else if (hoursToDue <= 48) {
        reasons.push(`⏰ Due in less than 48 hours.`);
      }

      if (sub && sub.targetGrade > sub.currentGrade) {
        const gap = sub.targetGrade - sub.currentGrade;
        if (gap >= 10) {
          reasons.push(`📈 Subject grade (${sub.currentGrade}%) is ${gap}% below target (${sub.targetGrade}%).`);
        }
      }

      if (task.priority >= 4) {
        reasons.push(`⭐ High priority task (P${task.priority}).`);
      }

      if (task.difficulty >= 4) {
        reasons.push(`🧠 High difficulty (D${task.difficulty}/5) requires focused cognitive energy.`);
      }

      if (!lastSessionDate) {
        reasons.push(`📚 You haven't studied this subject recently.`);
      }

      // Recommend study technique & duration
      let recommendedDuration = 45;
      let recommendedTechnique = 'Pomodoro (25/5)';
      if (task.difficulty >= 4 || remainingMinutes >= 60) {
        recommendedDuration = 45;
        recommendedTechnique = 'Deep Work (45 min)';
      } else if (remainingMinutes <= 30) {
        recommendedDuration = 25;
        recommendedTechnique = 'Quick Focus Sprint (25 min)';
      }

      return {
        task: {
          _id: task._id,
          title: task.title,
          type: task.type,
          priority: task.priority,
          difficulty: task.difficulty,
          dueDate: task.dueDate,
          estimatedMinutes: task.estimatedMinutes,
          completedMinutes: task.completedMinutes,
          remainingMinutes,
          subject: sub ? {
            _id: sub._id,
            name: sub.name,
            color: sub.color,
            icon: sub.icon,
            currentGrade: sub.currentGrade,
            targetGrade: sub.targetGrade
          } : null
        },
        aiScore: Math.round(score),
        reasons: reasons.length > 0 ? reasons : ['Optimal task for steady academic progress.'],
        recommendedDuration,
        recommendedTechnique
      };
    }).sort((a, b) => b.aiScore - a.aiScore);

    const primaryRecommendation = scoredTasks[0] || null;
    const secondaryRecommendations = scoredTasks.slice(1, 4);

    let coachAdvice = 'Keep up the consistent effort! Review your daily tasks to stay on track.';
    if (primaryRecommendation) {
      const topTask = primaryRecommendation.task;
      const hoursToDue = Math.round((new Date(topTask.dueDate).getTime() - Date.now()) / (1000 * 60 * 60));

      if (hoursToDue <= 0) {
        coachAdvice = `Urgent Recovery: "${topTask.title}" is overdue. Dedicate your immediate study block to complete it and relieve deadline pressure.`;
      } else if (hoursToDue <= 24) {
        coachAdvice = `High Priority: "${topTask.title}" is due in ${hoursToDue} hours. A ${primaryRecommendation.recommendedDuration}-minute session will help you complete it in time.`;
      } else if (topTask.subject && topTask.subject.targetGrade > topTask.subject.currentGrade + 10) {
        coachAdvice = `Grade Reinforcement: Dedicated focus on ${topTask.subject.name} will help bridge the gap toward your ${topTask.subject.targetGrade}% target.`;
      } else {
        coachAdvice = `Recommended Focus: Work on "${topTask.title}" using ${primaryRecommendation.recommendedTechnique} for optimal retention.`;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        hasTasks: true,
        coachAdvice,
        primaryRecommendation,
        secondaryRecommendations,
        totalPendingTasks: tasks.length
      }
    });
  } catch (error) {
    next(error);
  }
};
