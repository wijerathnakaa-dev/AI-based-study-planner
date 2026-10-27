const mongoose = require('mongoose');

const studySessionSchema = new mongoose.Schema({
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
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    default: null
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    default: null
  },
  duration: {
    type: Number,
    default: 0
  },
  focusScore: {
    type: Number,
    min: 1,
    max: 10,
    default: 7
  },
  type: {
    type: String,
    enum: ['study', 'revision', 'practice', 'reading'],
    default: 'study'
  },
  notes: {
    type: String,
    default: '',
    maxlength: 500
  }
}, {
  timestamps: true
});

studySessionSchema.index({ user: 1, startTime: -1 });
studySessionSchema.index({ user: 1, subject: 1 });

module.exports = mongoose.model('StudySession', studySessionSchema);
