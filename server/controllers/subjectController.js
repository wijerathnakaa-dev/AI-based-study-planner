const Subject = require('../models/Subject');
const Task = require('../models/Task');
const StudySession = require('../models/StudySession');

// @desc    Get all subjects for user
// @route   GET /api/subjects
exports.getSubjects = async (req, res, next) => {
  try {
    const subjects = await Subject.find({ user: req.user._id }).sort({ name: 1 });

    // Enrich with task counts
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

// @desc    Get single subject
// @route   GET /api/subjects/:id
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

// @desc    Create subject
// @route   POST /api/subjects
exports.createSubject = async (req, res, next) => {
  try {
    req.body.user = req.user._id;
    const subject = await Subject.create(req.body);
    res.status(201).json({ success: true, data: subject });
  } catch (error) {
    next(error);
  }
};

// @desc    Update subject
// @route   PUT /api/subjects/:id
exports.updateSubject = async (req, res, next) => {
  try {
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

// @desc    Delete subject
// @route   DELETE /api/subjects/:id
exports.deleteSubject = async (req, res, next) => {
  try {
    const subject = await Subject.findOneAndDelete({ _id: req.params.id, user: req.user._id });

    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    // Also remove tasks linked to this subject
    await Task.updateMany({ subject: req.params.id }, { subject: null });

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

// @desc    Get subject analytics
// @route   GET /api/subjects/:id/analytics
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
