# mytask Backend

## Overview
A Node.js + Express + MongoDB Atlas backend for a Jira-like task management system, including:
- Role-Based Access Control (RBAC)
- AI Summaries with role-based insights
- Real-time notifications with Socket.IO
- Time tracking
- Audit logging
- Heroku deployment
- Enhanced Sprint Management System
- Advanced API Filtering and Pagination
- Caching for Performance Optimization
- Comprehensive Error Handling
- Subscription-based feature access

## Setup

1. Run `npm install` to install dependencies.
2. Copy `.env.example` to `.env` and fill in your environment variables.
3. Start locally: `npm run dev` or `node server.js`.

## Deploy to Heroku

1. `heroku create your-app-name`
2. `git push heroku main`
3. `heroku config:set MONGODB_URI=... JWT_SECRET=... OPENAI_API_KEY=...`
4. Your app is live at `https://your-app-name.herokuapp.com`

## Sprint Management Features

- Create, Read, Update, Delete Sprint operations
- Add/Remove Tasks from Sprints
- Sprint Progress Tracking
- Burndown Charts
- Sprint Statistics and Reporting
- Real-time Updates via WebSockets

## AI-Powered Summarization

mytask includes an advanced AI summarization system that provides personalized insights based on user roles:

### Role-Based AI Summaries

- **Developers** receive updates focused on their assigned tasks, priorities, and deadlines
- **Managers** get team performance metrics, bottlenecks, and overall project status
- **QA** specialists see testing priorities and quality metrics
- **Clients** receive high-level progress updates focused on business value

### Summary Badge

The system generates summaries that appear in a badge at the top of the interface:

```json
{
  "id": "user_001",
  "name": "Stan Stepanenko",
  "role": "Developer",
  "summaries": {
    "project_101": [
      {
        "id": "summary_001",
        "timestamp": "2025-03-07T09:00:00Z",
        "content": "You have a new task assigned: #5434 (high priority)."
      },
      {
        "id": "summary_002",
        "timestamp": "2025-03-08T09:15:00Z",
        "content": "Task #5434 is due today."
      }
    ],
    "project_202": [
      {
        "id": "summary_003",
        "timestamp": "2025-03-07T14:15:00Z",
        "content": "Sprint progress at 65%, great job!"
      }
    ]
  }
}
```

### Auto-Generated Summaries

Summaries are automatically refreshed when:

- New tasks are created
- Tasks are assigned or reassigned
- Task statuses change
- Sprints are started or completed

## Subscription Features

mytask offers a tiered subscription model to keep the core experience simple while allowing teams that need more flexibility to customize their workflow:

### Free Tier
- Basic task management
- 4 default statuses (ToDo, Doing, Testing, Done)
- Limited to 5 projects and 10 users

### Professional Tier
- Custom task statuses (up to 10)
- Priority support
- Up to 10 projects and 20 users

### Business Tier 
- Custom task statuses
- Unlimited projects
- API access
- Advanced reporting
- Up to 50 users

### Enterprise Tier
- All features
- Unlimited users and projects

## API Documentation

### Project Settings

```
GET /api/projects/:projectId/settings
```
Get project settings including statuses, priorities, and roles.

```
PATCH /api/projects/:projectId/settings/statuses
```
Update project statuses (requires subscription).

```
POST /api/projects/:projectId/migrate-statuses
```
Migrate tasks when updating statuses.

### Subscriptions

```
GET /api/subscriptions/plans
```
Get available subscription plans.

```
GET /api/subscriptions/current
```
Get current user's subscriptions.

```
POST /api/subscriptions
```
Create a new subscription.

```
PATCH /api/subscriptions/:subscriptionId/cancel
```
Cancel a subscription.

### AI Summaries

```
GET /api/summaries
```
Get fresh AI-generated summaries for current user.

```
GET /api/summaries/cached
```
Get cached summaries for faster loading.

```
POST /api/summaries/projects/:projectId
```
Generate summaries for all users in a project (Manager only).

```
POST /api/summaries/projects/:projectId/invalidate
```
Invalidate summary cache after major project changes.
