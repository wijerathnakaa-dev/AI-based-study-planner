const Subject = require('../models/Subject');
const Task = require('../models/Task');
const StudySession = require('../models/StudySession');

exports.getSubjects = async (req, res, next) => {
  try {
    const { semester } = req.query;
    const query = { user: req.user._id };
    if (semester && semester !== 'all') {
      query.semester = semester;
    }

    const subjects = await Subject.find(query).sort({ name: 1 });

    const enriched = await Promise.all(subjects.map(async (subject) => {
      const taskCount = await Task.countDocuments({ subject: subject._id, user: req.user._id });
      const completedTasks = await Task.countDocuments({ subject: subject._id, user: req.user._id, status: 'completed' });
      return {
        ...subject.toObject(),
        taskCount,
        completedTasks
      };
    }));

    res.status(200).json({
      success: true,
      count: enriched.length,
      data: enriched
    });
  } catch (error) {
    next(error);
  }
};

exports.getSubject = async (req, res, next) => {
  try {
    const subject = await Subject.findOne({ _id: req.params.id, user: req.user._id });

    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    res.status(200).json({ success: true, data: subject });
  } catch (error) {
    next(error);
  }
};

exports.createSubject = async (req, res, next) => {
  try {
    req.body.user = req.user._id;

    if (!req.body.name || typeof req.body.name !== 'string' || !req.body.name.trim()) {
      return res.status(400).json({ success: false, message: 'Subject name is required' });
    }

    if (req.body.targetGrade !== undefined) {
      const tg = Number(req.body.targetGrade);
      if (isNaN(tg) || tg < 0 || tg > 100) {
        return res.status(400).json({ success: false, message: 'Target grade must be between 0 and 100' });
      }
      req.body.targetGrade = tg;
    }

    if (req.body.currentGrade !== undefined) {
      const cg = Number(req.body.currentGrade);
      if (isNaN(cg) || cg < 0 || cg > 100) {
        return res.status(400).json({ success: false, message: 'Current grade must be between 0 and 100' });
      }
      req.body.currentGrade = cg;
    }

    if (req.body.credits !== undefined) {
      const cr = Number(req.body.credits);
      if (isNaN(cr) || cr < 1 || cr > 10) {
        return res.status(400).json({ success: false, message: 'Credits must be between 1 and 10' });
      }
      req.body.credits = cr;
    }

    const subject = await Subject.create(req.body);
    res.status(201).json({ success: true, data: subject });
  } catch (error) {
    next(error);
  }
};

exports.updateSubject = async (req, res, next) => {
  try {
    if (req.body.targetGrade !== undefined) {
      const tg = Number(req.body.targetGrade);
      if (isNaN(tg) || tg < 0 || tg > 100) {
        return res.status(400).json({ success: false, message: 'Target grade must be between 0 and 100' });
      }
      req.body.targetGrade = tg;
    }

    if (req.body.currentGrade !== undefined) {
      const cg = Number(req.body.currentGrade);
      if (isNaN(cg) || cg < 0 || cg > 100) {
        return res.status(400).json({ success: false, message: 'Current grade must be between 0 and 100' });
      }
      req.body.currentGrade = cg;
    }

    if (req.body.credits !== undefined) {
      const cr = Number(req.body.credits);
      if (isNaN(cr) || cr < 1 || cr > 10) {
        return res.status(400).json({ success: false, message: 'Credits must be between 1 and 10' });
      }
      req.body.credits = cr;
    }

    const subject = await Subject.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    res.status(200).json({ success: true, data: subject });
  } catch (error) {
    next(error);
  }
};

exports.deleteSubject = async (req, res, next) => {
  try {
    const subject = await Subject.findOneAndDelete({ _id: req.params.id, user: req.user._id });

    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    await Task.updateMany({ subject: req.params.id }, { subject: null });

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

exports.getSubjectAnalytics = async (req, res, next) => {
  try {
    const subject = await Subject.findOne({ _id: req.params.id, user: req.user._id });
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    const tasks = await Task.find({ subject: req.params.id, user: req.user._id });
    const sessions = await StudySession.find({ subject: req.params.id, user: req.user._id });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const totalStudyMinutes = sessions.reduce((sum, s) => sum + s.duration, 0);
    const avgFocusScore = sessions.length > 0
      ? sessions.reduce((sum, s) => sum + s.focusScore, 0) / sessions.length
      : 0;

    res.status(200).json({
      success: true,
      data: {
        subject,
        totalTasks,
        completedTasks,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        totalStudyMinutes,
        totalStudyHours: Math.round(totalStudyMinutes / 60 * 10) / 10,
        avgFocusScore: Math.round(avgFocusScore * 10) / 10,
        sessionCount: sessions.length
      }
    });
  } catch (error) {
    next(error);
  }
};
