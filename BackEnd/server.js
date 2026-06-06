const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const compression = require("compression");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
require("dotenv").config();

// Routes
const authRoutes = require("./routes/authRoutes");
const oauthRoutes = require("./routes/oauthRoutes");
const skillRoutes = require("./routes/skillRoutes");
const userRoutes = require("./routes/userRoutes");
const trustRoutes = require("./routes/trustRoutes");
const geoRoutes = require("./routes/geoRoutes");
const videoRoutes = require("./routes/videoRoutes");
const connectionRoutes = require("./routes/connectionRoutes");

// Middleware
const errorHandler = require("./middleware/errorHandler");
const { generalLimiter, authLimiter } = require("./middleware/rateLimiter");
const { moderationQueue } = require("./services/queueService");
const eventEmitter = require("./utils/events");

const app = express();
app.set("trust proxy", 1); // Trust first proxy (needed for express-rate-limit on Render)
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Make io accessible to routes
app.set("io", io);

// Track online users
const onlineUsers = new Map();

// Socket.IO connection handling
io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    // User joins their personal room for notifications
    socket.on("register", (userId) => {
        if (userId) {
            socket.join(`user_${userId}`);
            socket.userId = userId;
            
            const currentCount = onlineUsers.get(userId) || 0;
            onlineUsers.set(userId, currentCount + 1);
            
            // Broadcast updated online users list
            io.emit("users-online", Array.from(onlineUsers.keys()));
            if (currentCount === 0) {
                io.emit("user-online", userId);
            }
            
            console.log(`User ${userId} registered on socket ${socket.id} (count: ${currentCount + 1})`);
        }
    });

    // Real-Time Audio Moderation (Whisper/Groq)
    socket.on("audio-chunk", async (data) => {
        if (!data || !data.audioBuffer) return;

        const lang = data.language || "English";
        const langCodeMap = { "English": "en", "Spanish": "es", "French": "fr", "Hindi": "hi", "German": "de", "Mandarin": "zh", "Japanese": "ja", "Arabic": "ar", "Portuguese": "pt", "Korean": "ko" };
        const langCode = langCodeMap[lang] || "en";

        // Add to Bull queue (non-blocking)
        moderationQueue.add({
            audioBuffer: data.audioBuffer,
            langCode,
            userId: data.userId
        });
    });

    // Handle call ended event
    socket.on("call-ended", async (data) => {
        const { roomId, userId, otherUserId, callDuration } = data;
        
        if (otherUserId && callDuration) {
            try {
                // Fetch user details
                const User = require("./models/user");
                const currentUser = await User.findById(userId).select("name avatar");
                
                // Emit to other user to open rating modal
                io.to(`user_${otherUserId}`).emit("call-ended", {
                    otherUser: {
                        _id: userId,
                        name: currentUser?.name || "Someone",
                        avatar: currentUser?.avatar
                    },
                    callDuration
                });
            } catch (err) {
                console.error("Error handling call-ended:", err);
            }
        }
    });

    socket.on("disconnect", () => {
        console.log("Socket disconnected:", socket.id);
        
        // Remove user from online list
        if (socket.userId) {
            const currentCount = onlineUsers.get(socket.userId) || 0;
            if (currentCount > 1) {
                onlineUsers.set(socket.userId, currentCount - 1);
                console.log(`User ${socket.userId} disconnected one socket (count: ${currentCount - 1})`);
            } else {
                onlineUsers.delete(socket.userId);
                io.emit("users-online", Array.from(onlineUsers.keys()));
                io.emit("user-offline-status", socket.userId);
                console.log(`User ${socket.userId} went offline`);
            }
        }
    });

    // WebRTC Signaling
    socket.on("join-video-room", ({ roomId, userId }) => {
        socket.join(roomId);
        socket.to(roomId).emit("user-joined", { userId });
        console.log(`User ${userId} joined video room ${roomId}`);
    });

    socket.on("video-offer", ({ roomId, offer }) => {
        socket.to(roomId).emit("video-offer", { offer });
    });

    socket.on("video-answer", ({ roomId, answer }) => {
        socket.to(roomId).emit("video-answer", { answer });
    });

    socket.on("ice-candidate", ({ roomId, candidate }) => {
        socket.to(roomId).emit("ice-candidate", { candidate });
    });

    socket.on("leave-video-room", ({ roomId }) => {
        socket.leave(roomId);
        socket.to(roomId).emit("user-left");
    });
    
    socket.on("call-user", ({ roomId, targetUserId, callerName }) => {
        io.to(`user_${targetUserId}`).emit("incoming-call", { roomId, callerName });
    });
});

// Listen for malicious detection from worker
eventEmitter.on('malicious-detected', (userId) => {
    io.to(`user_${userId}`).emit("force-disconnect", {
        reason: "Malicious discussion detected by AI moderator. Call terminated."
    });
});

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // disable if it blocks frontend assets
}));
app.use(cors());
app.use(compression());
app.use(express.json());
// app.use(mongoSanitize()); // Disabled due to Express 5 compatibility issue (Cannot set property query of #<IncomingMessage> which has only a getter)
app.use(generalLimiter); // Apply general rate limiter
app.use(require('express-session')({ secret: process.env.JWT_SECRET || 'secret', resave: false, saveUninitialized: false }));
app.use(require('./config/passport').initialize());

// Routes
app.use("/api/auth", authLimiter, authRoutes); // Apply auth limiter here
app.use("/api/auth", oauthRoutes);
app.use("/api/skills", skillRoutes);
app.use("/api/user", userRoutes);
app.use("/api/trust", trustRoutes);
app.use("/api/geo", geoRoutes);
app.use("/api/video", videoRoutes);
app.use("/api/connections", connectionRoutes);

// Serve Frontend statically (combined origin) if present
const fs = require("fs");
const frontendDistPath = path.join(__dirname, "../frontend/dist");
const frontendDistPathAlt = path.join(__dirname, "../FrontEnd/dist");
let indexHtmlPath = "";

if (fs.existsSync(path.join(frontendDistPath, "index.html"))) {
    indexHtmlPath = path.join(frontendDistPath, "index.html");
    app.use(express.static(frontendDistPath, { extensions: ['html'] }));
} else if (fs.existsSync(path.join(frontendDistPathAlt, "index.html"))) {
    indexHtmlPath = path.join(frontendDistPathAlt, "index.html");
    app.use(express.static(frontendDistPathAlt, { extensions: ['html'] }));
}

if (indexHtmlPath) {
    app.use((req, res, next) => {
        if (req.url.startsWith('/api')) return next();
        res.sendFile(indexHtmlPath);
    });
} else {
    // Separate deployment mode: Render only hosts the Backend API
    app.get("/", (req, res) => {
        res.json({ message: "SkillSwap API Server is running successfully." });
    });
    
    // API welcome/fallback routes
    app.use((req, res, next) => {
        if (req.url.startsWith('/api')) return next();
        res.status(404).json({ error: "Not Found", message: "API endpoint not found. Frontend is deployed separately." });
    });
}

// Global Error Handler (must be last)
app.use(errorHandler);

// DB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.log("DB Error:", err));

// Server — use server.listen instead of app.listen for Socket.IO
const PORT = process.env.PORT || 8000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});