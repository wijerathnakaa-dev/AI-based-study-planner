const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    default: null
  },
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    default: '',
    maxlength: 1000
  },
  type: {
    type: String,
    enum: ['assignment', 'exam', 'reading', 'project', 'revision', 'other'],
    default: 'assignment'
  },
  priority: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
  },
  difficulty: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  estimatedMinutes: {
    type: Number,
    default: 60,
    min: 5
  },
  completedMinutes: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed'],
    default: 'pending'
  },
  tags: [{
    type: String,
    trim: true
  }],
  scheduledDate: {
    type: Date,
    default: null
  },
  scheduledStartTime: {
    type: String,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

taskSchema.index({ user: 1, status: 1 });
taskSchema.index({ user: 1, dueDate: 1 });
taskSchema.index({ user: 1, subject: 1 });

module.exports = mongoose.model('Task', taskSchema);
