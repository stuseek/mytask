const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getProfile } = require('../controllers/userController');
const auth = require('../middleware/auth');

// Public endpoints
router.post('/register', registerUser);
router.post('/login', loginUser);

// Protected endpoints
router.get('/profile', auth, getProfile);

module.exports = router;
