# mytask Backend

## Overview
A Node.js + Express + MongoDB Atlas backend for a Jira-like task management system, including:
- RBAC
- AI Summaries (OpenAI)
- Real-time notifications with Socket.IO
- Time tracking
- Audit logging
- Heroku deployment

## Setup

1. Run \`npm install\` to install dependencies.
2. Copy \`.env.example\` to \`.env\` and fill in your environment variables.
3. Start locally: \`npm run dev\` or \`node server.js\`.

## Deploy to Heroku

1. \`heroku create your-app-name\`
2. \`git push heroku main\`
3. \`heroku config:set MONGODB_URI=... JWT_SECRET=... OPENAI_API_KEY=...\`
4. Your app is live at \`https://your-app-name.herokuapp.com\`.
