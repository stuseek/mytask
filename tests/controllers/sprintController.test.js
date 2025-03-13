// tests/controllers/sprintController.test.js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const app = require('../../src/app');
const Sprint = require('../../src/models/sprintModel');
const Project = require('../../src/models/projectModel');
const Task = require('../../src/models/taskModel');
const User = require('../../src/models/userModel');
const jwt = require('jsonwebtoken');

let mongoServer;

// Mock user for authentication
const testUser = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123',
    role: 'Admin'
};

// Generate JWT token for authentication
const generateToken = (user) => {
    return jwt.sign(
        { id: user._id },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
    );
};

// Setup database before tests
beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
});

// Clear database between tests
beforeEach(async () => {
    await Sprint.deleteMany({});
    await Project.deleteMany({});
    await Task.deleteMany({});
    await User.deleteMany({});
    
    // Create test user
    await User.create(testUser);
});

// Disconnect after tests
afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

describe('Sprint Controller', () => {
    describe('createSprint', () => {
        it('should create a new sprint', async () => {
            // Create a test project first
            const project = await Project.create({
                name: 'Test Project',
                description: 'A test project',
                ownerUserId: testUser._id
            });
            
            const token = generateToken(testUser);
            
            const sprintData = {
                name: 'Test Sprint',
                description: 'A test sprint',
                startDate: new Date(),
                endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days later
            };
            
            const response = await request(app)
                .post(`/api/projects/${project._id}/sprints`)
                .set('Authorization', `Bearer ${token}`)
                .send(sprintData);
            
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe(sprintData.name);
            expect(response.body.data.projectId).toBe(project._id.toString());
        });
        
        it('should return 400 for invalid sprint data', async () => {
            const project = await Project.create({
                name: 'Test Project',
                description: 'A test project',
                ownerUserId: testUser._id
            });
            
            const token = generateToken(testUser);
            
            // Missing required name
            const sprintData = {
                description: 'A test sprint',
                startDate: new Date(),
                endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
            };
            
            const response = await request(app)
                .post(`/api/projects/${project._id}/sprints`)
                .set('Authorization', `Bearer ${token}`)
                .send(sprintData);
            
            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });
    });
    
    describe('getSprintsForProject', () => {
        it('should return all sprints for a project', async () => {
            // Create a test project
            const project = await Project.create({
                name: 'Test Project',
                description: 'A test project',
                ownerUserId: testUser._id
            });
            
            // Create test sprints
            await Sprint.create([
                {
                    name: 'Sprint 1',
                    description: 'First sprint',
                    projectId: project._id,
                    startDate: new Date(),
                    endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
                },
                {
                    name: 'Sprint 2',
                    description: 'Second sprint',
                    projectId: project._id,
                    startDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
                    endDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000)
                }
            ]);
            
            const token = generateToken(testUser);
            
            const response = await request(app)
                .get(`/api/projects/${project._id}/sprints`)
                .set('Authorization', `Bearer ${token}`);
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.length).toBe(2);
            expect(response.body.data[0].name).toBe('Sprint 1');
            expect(response.body.data[1].name).toBe('Sprint 2');
        });
    });
    
    describe('addTaskToSprint', () => {
        it('should add a task to a sprint', async () => {
            // Create test project
            const project = await Project.create({
                name: 'Test Project',
                description: 'A test project',
                ownerUserId: testUser._id
            });
            
            // Create test sprint
            const sprint = await Sprint.create({
                name: 'Test Sprint',
                description: 'A test sprint',
                projectId: project._id,
                startDate: new Date(),
                endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
            });
            
            // Create test task
            const task = await Task.create({
                title: 'Test Task',
                description: 'A test task',
                projectId: project._id,
                status: 'Todo',
                priority: 'Medium'
            });
            
            const token = generateToken(testUser);
            
            const response = await request(app)
                .post(`/api/sprints/${sprint._id}/tasks/${task._id}`)
                .set('Authorization', `Bearer ${token}`);
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            
            // Check that task is now in sprint
            const updatedSprint = await Sprint.findById(sprint._id);
            expect(updatedSprint.taskIds.map(id => id.toString())).toContain(task._id.toString());
            
            // Check that task has sprint reference
            const updatedTask = await Task.findById(task._id);
            expect(updatedTask.sprintId.toString()).toBe(sprint._id.toString());
        });
    });
    
    // Add more tests for other controller methods...
});
