const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const db = require("../db/index.js");
const app = express();
const config = require("../config/index.js");
const cors = require("cors");
const router = require("../routes/index.js");

// Create HTTP server wrapper for Socket.io
const server = http.createServer(app);

// Initialize Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for development
    methods: ["GET", "POST"]
  }
});

// Trust proxy to get real client IP when behind Nginx/Load Balancer
app.set('trust proxy', true);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use("/api", router);
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Import and initialize auction socket handlers
const initAuctionSockets = require("../sockets/auctionSocket");
initAuctionSockets(io);

// Use server.listen instead of app.listen for Socket.io
server.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
  console.log("Socket.io initialized for real-time auction");
});

