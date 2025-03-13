require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const connectDB = require('./src/config/db');

// Connect to DB
connectDB();

const server = http.createServer(app);

// Setup Socket.IO for real-time notifications
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: { origin: '*' },
});

// Pass `io` to our notification socket logic
require('./src/websocket/notificationSocket')(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
