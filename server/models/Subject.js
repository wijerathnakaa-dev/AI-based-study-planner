const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Subject name is required'],
    trim: true
  },
  color: {
    type: String,
    default: '#8B5CF6'
  },
  icon: {
    type: String,
    default: '📚'
  },
  targetGrade: {
    type: Number,
    min: 0,
    max: 100,
    default: 90
  },
  currentGrade: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  credits: {
    type: Number,
    default: 3,
    min: 1,
    max: 6
  },
  semester: {
    type: String,
    default: 'Fall 2026'
  },
  totalStudyMinutes: {
    type: Number,
    default: 0
  },
  difficulty: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
  }
}, {
  timestamps: true
});

// Index for fast queries
subjectSchema.index({ user: 1 });

module.exports = mongoose.model('Subject', subjectSchema);
