const Project = require('../models/projectModel');
const { logAction } = require('../utils/logger');
const { generateSummary } = require('../services/aiService');

// Create a new project
exports.createProject = async (req, res) => {
  try {
    const { name, description, teamIds } = req.body;
    const project = new Project({
      name,
      description,
      teamIds,
      ownerUserId: req.user._id
    });
    await project.save();

    await logAction(
      req.user._id,
      'CREATE_PROJECT',
      'Project',
      project._id,
      { name, description, teamIds },
      req.ip
    );

    res.status(201).json({ project });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all projects
exports.getAllProjects = async (req, res) => {
  try {
    const projects = await Project.find().populate('teamIds');
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update a project (with AI summary example)
exports.updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Basic check: if user is not owner, block
    if (String(project.ownerUserId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to update project' });
    }

    // Update fields
    project.name = name || project.name;
    project.description = description || project.description;
    await project.save();

    await logAction(
      req.user._id,
      'UPDATE_PROJECT',
      'Project',
      project._id,
      { name, description },
      req.ip
    );

    // AI summary if description changed
    if (description) {
      const summary = await generateSummary(description);
      console.log('AI Summary:', summary);
    }

    res.json({ project });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
