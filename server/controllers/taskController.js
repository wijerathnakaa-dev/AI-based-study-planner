const Task = require('../models/Task');
const Subject = require('../models/Subject');

exports.getTasks = async (req, res, next) => {
  try {
    const { status, priority, subject, type, sort, search } = req.query;
    const query = { user: req.user._id };

    if (status === 'overdue') {
      query.status = { $ne: 'completed' };
      query.dueDate = { $lt: new Date() };
    } else if (status) {
      query.status = status;
    }

    if (priority) query.priority = Number(priority);
    if (subject) query.subject = subject;
    if (type) query.type = type;
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    let sortOption = { dueDate: 1 };
    if (sort === 'priority' || sort === 'priority_desc') sortOption = { priority: -1, dueDate: 1 };
    else if (sort === 'priority_asc') sortOption = { priority: 1, dueDate: 1 };
    else if (sort === 'created' || sort === 'createdAt_desc') sortOption = { createdAt: -1 };
    else if (sort === 'createdAt_asc') sortOption = { createdAt: 1 };
    else if (sort === 'dueDate_desc') sortOption = { dueDate: -1 };
    else if (sort === 'dueDate' || sort === 'dueDate_asc') sortOption = { dueDate: 1 };

    const tasks = await Task.find(query)
      .populate('subject', 'name color icon')
      .sort(sortOption);

    res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks
    });
  } catch (error) {
    next(error);
  }
};

exports.getTask = async (req, res, next) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, user: req.user._id })
      .populate('subject', 'name color icon');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    res.status(200).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

exports.createTask = async (req, res, next) => {
  try {
    req.body.user = req.user._id;

    if (!req.body.title || typeof req.body.title !== 'string' || !req.body.title.trim()) {
      return res.status(400).json({ success: false, message: 'Task title is required' });
    }

    if (!req.body.dueDate || isNaN(new Date(req.body.dueDate).getTime())) {
      return res.status(400).json({ success: false, message: 'A valid due date is required' });
    }

    if (req.body.estimatedMinutes !== undefined) {
      const est = Number(req.body.estimatedMinutes);
      if (isNaN(est) || est < 5 || est > 1440) {
        return res.status(400).json({ success: false, message: 'Estimated minutes must be between 5 and 1440' });
      }
      req.body.estimatedMinutes = est;
    }

    // Verify subject ownership
    if (req.body.subject) {
      const subject = await Subject.findOne({ _id: req.body.subject, user: req.user._id });
      if (!subject) {
        return res.status(404).json({ success: false, message: 'Subject not found or does not belong to you' });
      }
    }

    const task = await Task.create(req.body);
    const populatedTask = await Task.findById(task._id).populate('subject', 'name color icon');

    res.status(201).json({
      success: true,
      data: populatedTask
    });
  } catch (error) {
    next(error);
  }
};

exports.updateTask = async (req, res, next) => {
  try {
    const existingTask = await Task.findOne({ _id: req.params.id, user: req.user._id });

    if (!existingTask) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    if (req.body.dueDate && isNaN(new Date(req.body.dueDate).getTime())) {
      return res.status(400).json({ success: false, message: 'A valid due date is required' });
    }

    if (req.body.estimatedMinutes !== undefined) {
      const est = Number(req.body.estimatedMinutes);
      if (isNaN(est) || est < 5 || est > 1440) {
        return res.status(400).json({ success: false, message: 'Estimated minutes must be between 5 and 1440' });
      }
      req.body.estimatedMinutes = est;
    }

    // Verify subject ownership if subject is changed/provided
    if (req.body.subject) {
      const subject = await Subject.findOne({ _id: req.body.subject, user: req.user._id });
      if (!subject) {
        return res.status(404).json({ success: false, message: 'Subject not found or does not belong to you' });
      }
    }

    if (req.body.status === 'completed' && existingTask.status !== 'completed') {
      req.body.completedAt = new Date();
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    ).populate('subject', 'name color icon');

    res.status(200).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

exports.deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, user: req.user._id });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

exports.updateTaskStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const updateData = { status };

    if (status === 'completed') {
      updateData.completedAt = new Date();
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      updateData,
      { new: true, runValidators: true }
    ).populate('subject', 'name color icon');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    res.status(200).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};
