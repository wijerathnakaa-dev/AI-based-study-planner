const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user._id);

  const userData = {
    _id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    preferences: user.preferences,
    studyStreak: user.studyStreak,
    createdAt: user.createdAt
  };

  // Standardize on JWT bearer token in response payload
  res.status(statusCode).json({
    success: true,
    token,
    data: userData
  });
};

exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required'
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists'
      });
    }

    const user = await User.create({ name, email, password });
    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

exports.logout = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
};

exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { name, preferences } = req.body;
    const updateData = {};

    if (name) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'Valid name is required' });
      }
      updateData.name = name.trim();
    }

    if (preferences) {
      const mergedPrefs = { ...req.user.preferences?.toObject?.() || req.user.preferences, ...preferences };

      // Validate study hours per day (1 to 16)
      if (mergedPrefs.studyHoursPerDay !== undefined) {
        const hours = Number(mergedPrefs.studyHoursPerDay);
        if (isNaN(hours) || hours < 1 || hours > 16) {
          return res.status(400).json({
            success: false,
            message: 'Study hours per day must be between 1 and 16 hours'
          });
        }
        mergedPrefs.studyHoursPerDay = hours;
      }

      // Validate session duration (15 to 180 mins)
      if (mergedPrefs.sessionDuration !== undefined) {
        const dur = Number(mergedPrefs.sessionDuration);
        if (isNaN(dur) || dur < 15 || dur > 180) {
          return res.status(400).json({
            success: false,
            message: 'Session duration must be between 15 and 180 minutes'
          });
        }
        mergedPrefs.sessionDuration = dur;
      }

      // Validate break duration (5 to 60 mins)
      if (mergedPrefs.breakDuration !== undefined) {
        const brk = Number(mergedPrefs.breakDuration);
        if (isNaN(brk) || brk < 5 || brk > 60) {
          return res.status(400).json({
            success: false,
            message: 'Break duration must be between 5 and 60 minutes'
          });
        }
        mergedPrefs.breakDuration = brk;
      }

      // Validate preferred start and end times
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (mergedPrefs.preferredStartTime && !timeRegex.test(mergedPrefs.preferredStartTime)) {
        return res.status(400).json({
          success: false,
          message: 'Preferred start time must be in HH:MM 24-hour format'
        });
      }

      if (mergedPrefs.preferredEndTime && !timeRegex.test(mergedPrefs.preferredEndTime)) {
        return res.status(400).json({
          success: false,
          message: 'Preferred end time must be in HH:MM 24-hour format'
        });
      }

      if (mergedPrefs.preferredStartTime && mergedPrefs.preferredEndTime) {
        const [sH, sM] = mergedPrefs.preferredStartTime.split(':').map(Number);
        const [eH, eM] = mergedPrefs.preferredEndTime.split(':').map(Number);
        const startMinutes = sH * 60 + sM;
        const endMinutes = eH * 60 + eM;

        if (startMinutes >= endMinutes) {
          return res.status(400).json({
            success: false,
            message: 'Preferred start time must be earlier than preferred end time'
          });
        }

        const availableWindowMinutes = endMinutes - startMinutes;
        const minSlotMinutes = (mergedPrefs.sessionDuration || 45) + (mergedPrefs.breakDuration || 15);
        if (availableWindowMinutes < minSlotMinutes) {
          return res.status(400).json({
            success: false,
            message: `Time window (${Math.round(availableWindowMinutes / 60 * 10) / 10}h) is too short for a full session + break (${minSlotMinutes} mins)`
          });
        }

        const plannedStudyMinutes = (mergedPrefs.studyHoursPerDay || 4) * 60;
        if (plannedStudyMinutes > availableWindowMinutes) {
          return res.status(400).json({
            success: false,
            message: `Study hours per day (${mergedPrefs.studyHoursPerDay}h) exceeds the study window between ${mergedPrefs.preferredStartTime} and ${mergedPrefs.preferredEndTime} (${Math.round(availableWindowMinutes / 60 * 10) / 10}h)`
          });
        }
      }

      updateData.preferences = mergedPrefs;
    }

    const user = await User.findByIdAndUpdate(req.user._id, updateData, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};
