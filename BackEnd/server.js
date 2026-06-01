const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
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

const app = express();
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

// Socket.IO connection handling
io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    // User joins their personal room for notifications
    socket.on("register", (userId) => {
        if (userId) {
            socket.join(`user_${userId}`);
            console.log(`User ${userId} registered on socket ${socket.id}`);
        }
    });

    // Real-Time Audio Moderation (Whisper/Groq)
    socket.on("audio-chunk", async (data) => {
        if (!data || !data.audioBuffer) return;

        const lang = data.language || "English";
        const langCodeMap = { "English": "en", "Spanish": "es", "French": "fr", "Hindi": "hi", "German": "de", "Mandarin": "zh", "Japanese": "ja", "Arabic": "ar", "Portuguese": "pt", "Korean": "ko" };
        const langCode = langCodeMap[lang] || "en";

        const mlService = require("./services/mlService");
        const isMalicious = await mlService.analyzeAudioChunkForMalcontent(Buffer.from(data.audioBuffer), langCode);
        
        if (isMalicious) {
            // Force disconnect the offending user
            io.to(`user_${data.userId}`).emit("force-disconnect", {
                reason: "Malicious discussion detected by AI moderator. Call terminated."
            });
            
            // Increment warning/ban count (Optional integration point)
            const User = require("./models/user");
            User.findByIdAndUpdate(data.userId, { 
                $inc: { warningCount: 1 }, 
                isFlagged: true,
                flagReason: "AI Audio Moderation: Malicious intent detected"
            }).catch(console.error);
        }
    });

    socket.on("disconnect", () => {
        console.log("Socket disconnected:", socket.id);
    });
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(require('express-session')({ secret: process.env.JWT_SECRET || 'secret', resave: false, saveUninitialized: false }));
app.use(require('./config/passport').initialize());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/auth", oauthRoutes);
app.use("/api/skills", skillRoutes);
app.use("/api/user", userRoutes);
app.use("/api/trust", trustRoutes);
app.use("/api/geo", geoRoutes);
app.use("/api/video", videoRoutes);
app.use("/api/connections", connectionRoutes);

// Serve Frontend statically (combined origin)
app.use(express.static(path.join(__dirname, "../FrontEnd"), { extensions: ['html'] }));

app.use((req, res, next) => {
    if (req.url.startsWith('/api')) return next();
    res.sendFile(path.join(__dirname, "../FrontEnd", "index.html"));
});

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