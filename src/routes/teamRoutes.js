// src/routes/teamRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
    createTeam,
    getAllTeams,
    getTeamById,
    updateTeam,
    deleteTeam,
    addMember,
    removeMember
} = require('../controllers/teamController');

router.post('/', auth, createTeam);
router.get('/', auth, getAllTeams);
router.get('/:teamId', auth, getTeamById);
router.put('/:teamId', auth, updateTeam);
router.delete('/:teamId', auth, deleteTeam);

// Member management
router.post('/:teamId/members', auth, addMember);
router.delete('/:teamId/members/:memberId', auth, removeMember);

module.exports = router;