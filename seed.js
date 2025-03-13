/**
 * seed.js
 * Script to seed basic data into the "mytask" backend.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Import your models:
const User = require('./src/models/userModel');
const Team = require('./src/models/teamModel');
const Project = require('./src/models/projectModel');
const Task = require('./src/models/taskModel');
const connectDB = require('./src/config/db');

// Adjust this if you want to *keep* existing data:
const DROP_DATABASE = true; // or false if you only want to add

async function seed() {
    try {
        console.log('[Seed] Connecting to database...');
        await connectDB();

        if (DROP_DATABASE) {
            console.log('[Seed] Dropping existing collections...');
            // Drop all relevant collections; if they don't exist, no error is thrown
            await mongoose.connection.db.dropCollection('users').catch(() => {});
            await mongoose.connection.db.dropCollection('teams').catch(() => {});
            await mongoose.connection.db.dropCollection('projects').catch(() => {});
            await mongoose.connection.db.dropCollection('tasks').catch(() => {});
            // Add more if needed (comments, sprints, etc.)
        }

        console.log('[Seed] Creating sample users...');
        // Create a superadmin user
        const superadminPassword = await bcrypt.hash('Supersecret123', 10);
        const superadminUser = new User({
            name: 'Superadmin',
            email: 'superadmin@mytask.com',
            passwordHash: superadminPassword,
        });
        await superadminUser.save();

        // Create a normal user
        const userPassword = await bcrypt.hash('Userpass123', 10);
        const normalUser = new User({
            name: 'John Doe',
            email: 'john@mytask.com',
            passwordHash: userPassword,
        });
        await normalUser.save();

        console.log('[Seed] Creating a sample team...');
        const team = new Team({
            name: 'Alpha Team',
            description: 'This is the Alpha Team!',
            ownerUserId: superadminUser._id,
            members: [superadminUser._id, normalUser._id],
        });
        await team.save();

        // Link the team references back to the users
        superadminUser.teams.push(team._id);
        normalUser.teams.push(team._id);

        // For demonstration, superadmin "owns" the team
        superadminUser.ownedTeams.push(team._id);

        await superadminUser.save();
        await normalUser.save();

        console.log('[Seed] Creating a sample project...');
        const project = new Project({
            name: 'Project Phoenix',
            description: 'A sample project for demonstration.',
            teamIds: [team._id],
            ownerUserId: superadminUser._id,
        });
        await project.save();

        // Link the project references back to the users
        superadminUser.ownedProjects.push(project._id);
        normalUser.assignedProjects.push(project._id);

        // Optional: set RBAC roles
        // e.g., superadminUser is "Manager" on this project, normalUser is "Developer"
        superadminUser.projectRoles.set(project._id.toString(), 'Superadmin');
        normalUser.projectRoles.set(project._id.toString(), 'Developer');

        await superadminUser.save();
        await normalUser.save();

        console.log('[Seed] Creating sample tasks...');
        const task1 = new Task({
            title: 'Setup CI/CD',
            description: 'Configure GitHub Actions pipeline for the project.',
            projectId: project._id,
            assignedTo: normalUser._id, // assigned to John
            status: 'ToDo',
            priority: 'High',
        });
        await task1.save();

        const task2 = new Task({
            title: 'Implement Login Page',
            description: 'Create the frontend login page and connect to backend.',
            projectId: project._id,
            assignedTo: normalUser._id,
            status: 'ToDo',
            priority: 'Medium',
        });
        await task2.save();

        // Link tasks to project
        project.tasks.push(task1._id, task2._id);
        await project.save();

        // Also reflect these tasks on the user
        normalUser.assignedTasks.push(task1._id, task2._id);
        await normalUser.save();

        console.log('[Seed] Seeding completed successfully!');
    } catch (error) {
        console.error('[Seed] Error seeding data:', error);
    } finally {
        mongoose.connection.close();
    }
}

seed();