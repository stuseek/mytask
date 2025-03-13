// src/controllers/teamController.js
const Team = require('../models/teamModel');
const User = require('../models/userModel');
const { logAction } = require('../utils/logger');

exports.createTeam = async (req, res) => {
    try {
        const { name, description } = req.body;
        const team = new Team({
            name,
            description,
            ownerUserId: req.user._id,
            members: [req.user._id]
        });
        await team.save();

        // Also update user who created the team
        await User.findByIdAndUpdate(req.user._id, {
            $push: { ownedTeams: team._id, teams: team._id }
        });

        await logAction(req.user._id, 'CREATE_TEAM', 'Team', team._id, { name }, req.ip);

        res.status(201).json({ team });
    } catch (error) {
        console.error('Create Team Error:', error);
        res.status(500).json({ message: 'Failed to create team' });
    }
};

exports.getAllTeams = async (req, res) => {
    try {
        // Possibly filter by membership: find all teams in which req.user is a member
        // If you want: Team.find({ members: req.user._id })
        const teams = await Team.find().populate('members', 'name email');
        res.json({ teams });
    } catch (error) {
        console.error('Get All Teams Error:', error);
        res.status(500).json({ message: 'Failed to retrieve teams' });
    }
};

exports.getTeamById = async (req, res) => {
    try {
        const { teamId } = req.params;
        const team = await Team.findById(teamId).populate('members', 'name email');
        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }
        res.json({ team });
    } catch (error) {
        console.error('Get Team By ID Error:', error);
        res.status(500).json({ message: 'Failed to retrieve team' });
    }
};

exports.updateTeam = async (req, res) => {
    try {
        const { teamId } = req.params;
        const { name, description } = req.body;
        const team = await Team.findById(teamId);
        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }

        // Check if current user is the owner
        if (String(team.ownerUserId) !== String(req.user._id)) {
            return res.status(403).json({ message: 'Not authorized to update this team' });
        }

        if (name) team.name = name;
        if (description) team.description = description;
        await team.save();

        await logAction(req.user._id, 'UPDATE_TEAM', 'Team', team._id, { name }, req.ip);

        res.json({ team });
    } catch (error) {
        console.error('Update Team Error:', error);
        res.status(500).json({ message: 'Failed to update team' });
    }
};

exports.deleteTeam = async (req, res) => {
    try {
        const { teamId } = req.params;
        const team = await Team.findById(teamId);
        if (!team) {
            return res.status(404).json({ message: 'Team not found' });
        }

        // Check if current user is the owner
        if (String(team.ownerUserId) !== String(req.user._id)) {
            return res.status(403).json({ message: 'Not authorized to delete this team' });
        }

        // Remove references from users
        await User.updateMany(
            { _id: { $in: team.members } },
            { $pull: { teams: team._id } }
        );

        await team.remove();

        await logAction(req.user._id, 'DELETE_TEAM', 'Team', teamId, {}, req.ip);

        res.json({ message: 'Team deleted' });
    } catch (error) {
        console.error('Delete Team Error:', error);
        res.status(500).json({ message: 'Failed to delete team' });
    }
};

exports.addMember = async (req, res) => {
    try {
        const { teamId } = req.params;
        const { userId } = req.body;

        const team = await Team.findById(teamId);
        if (!team) return res.status(404).json({ message: 'Team not found' });

        // Optional: only allow team owner or manager to add members
        if (String(team.ownerUserId) !== String(req.user._id)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Add user to team
        if (!team.members.includes(userId)) {
            team.members.push(userId);
            await team.save();

            // Also update user document
            await User.findByIdAndUpdate(userId, {
                $push: { teams: team._id }
            });
        }

        await logAction(
            req.user._id,
            'ADD_MEMBER',
            'Team',
            teamId,
            { newMember: userId },
            req.ip
        );

        res.json({ team });
    } catch (error) {
        console.error('Add Member Error:', error);
        res.status(500).json({ message: 'Failed to add member' });
    }
};

exports.removeMember = async (req, res) => {
    try {
        const { teamId, memberId } = req.params;

        const team = await Team.findById(teamId);
        if (!team) return res.status(404).json({ message: 'Team not found' });

        if (String(team.ownerUserId) !== String(req.user._id)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Remove user from team
        await Team.findByIdAndUpdate(teamId, {
            $pull: { members: memberId }
        });

        // Also remove team from user's doc
        await User.findByIdAndUpdate(memberId, {
            $pull: { teams: teamId }
        });

        await logAction(
            req.user._id,
            'REMOVE_MEMBER',
            'Team',
            teamId,
            { removedMember: memberId },
            req.ip
        );

        res.json({ message: 'Member removed from team' });
    } catch (error) {
        console.error('Remove Member Error:', error);
        res.status(500).json({ message: 'Failed to remove member' });
    }
};