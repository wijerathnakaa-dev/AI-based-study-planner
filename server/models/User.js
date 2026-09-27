const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: 50
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false
  },
  avatar: {
    type: String,
    default: ''
  },
  preferences: {
    studyHoursPerDay: { type: Number, default: 4, min: 1, max: 16 },
    preferredStartTime: { type: String, default: '09:00' },
    preferredEndTime: { type: String, default: '21:00' },
    breakDuration: { type: Number, default: 15 },
    sessionDuration: { type: Number, default: 45 },
    darkMode: { type: Boolean, default: true }
  },
  studyStreak: {
    current: { type: Number, default: 0 },
    longest: { type: Number, default: 0 },
    lastStudyDate: { type: Date }
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
