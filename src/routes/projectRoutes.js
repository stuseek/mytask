const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createProject,
  getAllProjects,
  updateProject
} = require('../controllers/projectController');

// All these routes are protected by JWT auth
router.post('/', auth, createProject);
router.get('/', auth, getAllProjects);
router.put('/:id', auth, updateProject);

module.exports = router;
