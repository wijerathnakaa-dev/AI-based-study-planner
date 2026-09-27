const Task = require('../models/Task');

// @desc    Get all tasks for user
// @route   GET /api/tasks
exports.getTasks = async (req, res, next) => {
  try {
    const { status, priority, subject, type, sort, search } = req.query;
    const query = { user: req.user._id };

    if (status) query.status = status;
    if (priority) query.priority = Number(priority);
    if (subject) query.subject = subject;
    if (type) query.type = type;
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    let sortOption = { dueDate: 1 };
    if (sort === 'priority') sortOption = { priority: -1, dueDate: 1 };
    if (sort === 'created') sortOption = { createdAt: -1 };
    if (sort === 'dueDate') sortOption = { dueDate: 1 };

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

// @desc    Get single task
// @route   GET /api/tasks/:id
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

// @desc    Create task
// @route   POST /api/tasks
exports.createTask = async (req, res, next) => {
  try {
    req.body.user = req.user._id;
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

// @desc    Update task
// @route   PUT /api/tasks/:id
exports.updateTask = async (req, res, next) => {
  try {
    let task = await Task.findOne({ _id: req.params.id, user: req.user._id });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // If completing the task, set completedAt
    if (req.body.status === 'completed' && task.status !== 'completed') {
      req.body.completedAt = new Date();
    }

    task = await Task.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    }).populate('subject', 'name color icon');

    res.status(200).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete task
// @route   DELETE /api/tasks/:id
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

// @desc    Update task status
// @route   PATCH /api/tasks/:id/status
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
