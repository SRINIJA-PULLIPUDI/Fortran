const jwt = require('jsonwebtoken');
const User = require('../models/User');

function signToken(user) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// POST /api/auth/register
async function register(req, res, next) {
  try {
    const { fullName, userId, email, password, dob } = req.body;
    if (!fullName || !userId || !email || !password) {
      return res.status(400).json({ message: 'fullName, userId, email and password are required' });
    }

    const existing = await User.findOne({ $or: [{ email }, { userId }] });
    if (existing) {
      return res.status(409).json({ message: 'A user with that email or userId already exists' });
    }

    const user = await User.create({ fullName, userId, email, password, dob });
    const token = signToken(user);
    res.status(201).json({
      token,
      user: { id: user._id, fullName: user.fullName, userId: user.userId, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { emailOrUserId, password } = req.body;
    if (!emailOrUserId || !password) {
      return res.status(400).json({ message: 'emailOrUserId and password are required' });
    }

    const user = await User.findOne({ $or: [{ email: emailOrUserId }, { userId: emailOrUserId }] });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = signToken(user);
    res.json({
      token,
      user: { id: user._id, fullName: user.fullName, userId: user.userId, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me
async function me(req, res) {
  res.json({ user: req.user });
}

// PUT /api/auth/change-password
async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'currentPassword and newPassword are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user._id);
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword; // pre-save hook on the model hashes it
    await user.save();

    res.json({ message: 'Password updated' });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, me, changePassword };