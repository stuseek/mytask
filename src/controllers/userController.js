const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const { logAction } = require('../utils/logger');
const { sendEmail } = require('../utils/email');

// Register a new user
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    let existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({ name, email, passwordHash });
    await user.save();

    await logAction(
      user._id,
      'CREATE_USER',
      'User',
      user._id,
      { name, email },
      req.ip
    );

    // Optional: send welcome email
    // await sendEmail(email, 'Welcome!', `<h1>Hi ${name}, thanks for registering!</h1>`);

    res.status(201).json({ message: 'User registered', userId: user._id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Login user
exports.loginUser = async (req, res) => {
  try {
    const { email, password /* mfaToken */ } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    // If MFA enabled, verify TOTP here (speakeasy)

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '8h'
    });

    res.json({ token, userId: user._id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get current user profile
exports.getProfile = async (req, res) => {
  try {
    // user is attached to req in auth middleware
    const user = await User.findById(req.user._id).select('-passwordHash');
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
