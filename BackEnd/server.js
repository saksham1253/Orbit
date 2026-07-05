const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const compression = require("compression");
const helmet = require("helmet");
const jwt = require("jsonwebtoken");
const hpp = require("hpp");
const mongoSanitize = require("./middleware/sanitize");
require("dotenv").config();
const { createAdapter } = require("@socket.io/redis-adapter");
const Redis = require("ioredis");

// Routes
const authRoutes = require("./routes/authRoutes");
const oauthRoutes = require("./routes/oauthRoutes");
const skillRoutes = require("./routes/skillRoutes");
const userRoutes = require("./routes/userRoutes");
const trustRoutes = require("./routes/trustRoutes");
const geoRoutes = require("./routes/geoRoutes");
const videoRoutes = require("./routes/videoRoutes");
const connectionRoutes = require("./routes/connectionRoutes");
const messageRoutes = require("./routes/messageRoutes");
const cosmicRoutes = require("./routes/cosmicRoutes");

// Middleware
const errorHandler = require("./middleware/errorHandler");
const { generalLimiter, authLimiter } = require("./middleware/rateLimiter");
const { moderationQueue } = require("./services/queueService");
const eventEmitter = require("./utils/events");
const { startArchiveWorker } = require("./workers/archiveWorker");
const { startSentimentWorker } = require("./workers/sentimentWorker");
const { startSeasonWorker } = require("./workers/seasonWorker");
const { startOrbitWorker } = require("./workers/orbitWorker");
const { startLeagueWorker } = require("./workers/leagueWorker");

const app = express();
app.set("trust proxy", 1); // Trust first proxy (needed for express-rate-limit on Render)
const server = http.createServer(app);

const allowedOrigins = [
  "https://react-skill-swap-fully-fledged.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
  // Capacitor mobile app (APK / iOS): the WebView serves from these origins.
  "https://localhost",        // Android (androidScheme: 'https')
  "capacitor://localhost",    // iOS
  // Honour the CORS_ORIGIN env var (comma-separated) so origins can be added
  // from the Render dashboard without a code change.
  ...(process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean)
    : []),
];

// Allow ONLY this project's own Vercel deployments (prod + branch previews like
// react-skill-swap-fully-fledged-git-xyz.vercel.app). The previous
// `origin.endsWith(".vercel.app")` allowed ANY third-party Vercel app to call
// the API (A11). Capacitor APK origins remain in `allowedOrigins`, so the mobile
// app is unaffected.
const VERCEL_ORIGIN = /^https:\/\/react-skill-swap-fully-fledged[a-z0-9-]*\.vercel\.app$/i;

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || VERCEL_ORIGIN.test(origin)) {
        return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

// Socket.IO setup
const io = new Server(server, {
    cors: {
        origin: function(origin, callback) {
            if (!origin || allowedOrigins.includes(origin) || VERCEL_ORIGIN.test(origin)) {
                return callback(null, true);
            }
            return callback(new Error("Not allowed by CORS"));
        },
        credentials: true,
        methods: ["GET", "POST", "OPTIONS"]
    }
});

// ── Socket.IO scaling adapter (OPTIONAL) ───────────────────────────────────
// A SINGLE instance (the free tier) must use Socket.IO's default in-memory
// adapter — that is what shipped and worked before. The Redis adapter is ONLY
// needed to broadcast across MULTIPLE instances. Wiring it to an unhealthy
// REDIS_URL destabilizes the process (ioredis error loops, hung publishes),
// which silently breaks presence, chat and video signaling all at once.
//
// So: stay in-memory by default, and only switch to Redis when explicitly
// opted in (ENABLE_REDIS_ADAPTER=true) WITH a REDIS_URL — and even then use a
// fail-fast ioredis config so Redis problems can never hang or crash the app.
let pubClient = null;
let subClient = null;

if (process.env.ENABLE_REDIS_ADAPTER === "true" && process.env.REDIS_URL) {
    const redisOpts = {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,            // don't pile up commands when Redis is down
        connectTimeout: 5000,
        retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 2000)),
    };
    pubClient = new Redis(process.env.REDIS_URL, redisOpts);
    subClient = pubClient.duplicate();
    pubClient.on("error", (err) => console.error("Redis Pub Client Error:", err.message));
    subClient.on("error", (err) => console.error("Redis Sub Client Error:", err.message));
    io.adapter(createAdapter(pubClient, subClient));
    console.log("Socket.IO Redis adapter ENABLED (multi-instance mode)");
} else {
    console.log("Socket.IO using default in-memory adapter (single instance)");
}

// Make io accessible to routes
app.set("io", io);

// Track online users
const onlineUsers = new Map();
// Expose the live presence map to HTTP routes (e.g. the admin Users list reads
// it to flag who is online right now).
app.set("onlineUsers", onlineUsers);

// ── Socket.IO authentication ──────────────────────────────────────────────
// Derive the trusted userId from a verified JWT on the handshake instead of
// trusting a client-sent id (closes the register/room impersonation hole).
// Connections WITHOUT a valid token are still ALLOWED to connect — so flows
// that don't carry a token (e.g. WebRTC signaling) keep working — but they
// get no socket.userId and therefore cannot perform user-scoped actions
// (register, send-message, mark-read, typing, audio-chunk).
io.use((socket, next) => {
    try {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        if (token && process.env.JWT_SECRET) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded?.id) socket.userId = decoded.id;
        }
    } catch {
        // invalid/expired token → remain unauthenticated (socket.userId unset)
    }
    next();
});

// Socket.IO connection handling
io.on("connection", (socket) => {
    // console.log("Socket connected:", socket.id);

    // User joins their personal room for notifications.
    // Identity comes from the verified JWT (socket.userId), NOT the client arg —
    // so a socket can only ever join its OWN user room.
    socket.on("register", () => {
        const userId = socket.userId;
        if (userId) {
            socket.join(`user_${userId}`);

            const currentCount = onlineUsers.get(userId) || 0;
            onlineUsers.set(userId, currentCount + 1);

            // Broadcast updated online users list
            io.emit("users-online", Array.from(onlineUsers.keys()));
            if (currentCount === 0) {
                io.emit("user-online", userId);
            }

            // console.log(`User ${userId} registered on socket ${socket.id} (count: ${currentCount + 1})`);
        }
    });

    // Provide current online users on demand (for late joiners like ChatDrawer)
    socket.on("get-online-users", () => {
        socket.emit("users-online", Array.from(onlineUsers.keys()));
    });

    // Real-Time Audio Moderation (Whisper/Groq)
    socket.on("audio-chunk", async (data) => {
        if (!socket.userId) return;            // must be an authenticated socket
        if (!data || !data.audioBuffer) return;

        // Feature flag (default OFF). Audio moderation can flag/disconnect users,
        // so it stays disabled until explicitly enabled alongside a consent UI +
        // human-in-the-loop review (see Phase 13 ethics requirements).
        if (process.env.ML_AUDIO_MODERATION_ENABLED !== "true") return;

        const lang = data.language || "English";
        const langCodeMap = { "English": "en", "Spanish": "es", "French": "fr", "Hindi": "hi", "German": "de", "Mandarin": "zh", "Japanese": "ja", "Arabic": "ar", "Portuguese": "pt", "Korean": "ko" };
        const langCode = langCodeMap[lang] || "en";

        // Add to Bull queue (non-blocking). Use the trusted socket.userId so a
        // client cannot enqueue moderation jobs attributed to another user.
        moderationQueue.add({
            audioBuffer: data.audioBuffer,
            langCode,
            userId: socket.userId
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
                
                // Update call history
                const CallHistory = require("./models/callHistory");
                await CallHistory.findOneAndUpdate(
                    { roomName: roomId },
                    { 
                        status: "completed",
                        duration: callDuration,
                        endedAt: new Date()
                    },
                    { sort: { createdAt: -1 } } // Update the most recent one for this room
                );

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

    socket.on("disconnect", async () => {
        // console.log("Socket disconnected:", socket.id);
        
        // Remove user from online list
        if (socket.userId) {
            const currentCount = onlineUsers.get(socket.userId) || 0;
            if (currentCount > 1) {
                onlineUsers.set(socket.userId, currentCount - 1);
                // console.log(`User ${socket.userId} disconnected one socket (count: ${currentCount - 1})`);
            } else {
                onlineUsers.set(socket.userId, 0);
                setTimeout(async () => {
                    if (onlineUsers.get(socket.userId) === 0) {
                        onlineUsers.delete(socket.userId);
                        io.emit("users-online", Array.from(onlineUsers.keys()));
                        io.emit("user-offline-status", socket.userId);
                        // console.log(`User ${socket.userId} went offline`);
                        
                        // Update lastSeen in database
                        try {
                            const User = require("./models/user");
                            await User.findByIdAndUpdate(socket.userId, { lastSeen: new Date() });
                        } catch (err) {
                            console.error("Error updating lastSeen:", err);
                        }
                    }
                }, 3000); // 3 seconds grace period to prevent flicker
            }
        }
    });

    // WebRTC Signaling
    socket.on("join-video-room", async ({ roomId, userId }) => {
        socket.join(roomId);
        socket.to(roomId).emit("user-joined", { userId });
        // console.log(`User ${userId} joined video room ${roomId}`);
        
        try {
            const CallHistory = require("./models/callHistory");
            await CallHistory.findOneAndUpdate(
                { roomName: roomId, status: "ringing" },
                { status: "accepted" },
                { sort: { createdAt: -1 } }
            );
        } catch (err) {
            console.error("Error updating call status:", err);
        }
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
    
    socket.on("call-user", async ({ roomId, targetUserId, callerName, callerId }) => {
        // Forward callerId so the callee can role-guard (never ring the caller's
        // own device) and dedupe duplicate/late events client-side (v5 §3).
        io.to(`user_${targetUserId}`).emit("incoming-call", { roomId, callerName, callerId });

        // If the callee isn't connected, tell the caller they're offline (v7 §3).
        // Previously the client listened for "user-offline" but the server never
        // emitted it, so the dead listener never fired.
        if (targetUserId && callerId && !onlineUsers.has(String(targetUserId))) {
            try {
                const User = require("./models/user");
                const callee = await User.findById(targetUserId).select("name");
                io.to(`user_${callerId}`).emit("user-offline", {
                    userName: callee?.name || "That user"
                });
            } catch (err) {
                console.error("Error emitting user-offline:", err);
            }
        }

        try {
            // The WebRTC call socket connects WITHOUT a token (by design — see the
            // io.use note), so socket.userId is undefined here. Use the caller id
            // carried in the payload as the fallback, otherwise CallHistory.create
            // fails the required `caller` validation and no history is ever
            // written (this was the "call history not updating" bug).
            const caller = socket.userId || callerId;
            if (!caller || !targetUserId || !roomId) return;
            const CallHistory = require("./models/callHistory");
            await CallHistory.create({
                caller,
                receiver: targetUserId,
                roomName: roomId,
                status: "ringing",
                startedAt: new Date()
            });
        } catch (err) {
            console.error("Error creating call history:", err);
        }
    });

    // ===== REAL-TIME CHAT =====
    socket.on("send-message", async ({ receiverId, content }) => {
        if (!socket.userId || !receiverId || !content?.trim()) return;

        try {
            // Chat moderation: block messages with prohibited words and WARN the
            // sender — no account ban here (chat is real-time; a warning + a
            // dropped message is the right weight). Same banned-keyword list as
            // skills/bio, so coverage (incl. Hindi) is identical everywhere.
            const { checkForBannedContent } = require("./utils/bannedKeywords");
            if (!checkForBannedContent(content).isClean) {
                socket.emit("message-blocked", {
                    message: "⚠️ Your message contains prohibited words and was not sent. Please keep it respectful.",
                    content, // echoed back so the client can restore the text for editing
                });
                return;
            }

            const Message = require("./models/Message");
            const message = await Message.create({
                sender: socket.userId,
                receiver: receiverId,
                content: content.trim()
            });

            const populated = await Message.findById(message._id)
                .populate('sender', 'name avatar')
                .populate('receiver', 'name avatar')
                .lean();

            // Emit to the receiver
            io.to(`user_${receiverId}`).emit("new-message", populated);
            // Echo back to the sender (so they see it in real-time too)
            io.to(`user_${socket.userId}`).emit("new-message", populated);
        } catch (err) {
            console.error("Socket send-message error:", err);
            socket.emit("message-error", { error: "Failed to send message" });
        }
    });

    socket.on("mark-read", async ({ senderId }) => {
        if (!socket.userId || !senderId) return;
        try {
            const Message = require("./models/Message");
            const result = await Message.updateMany(
                { sender: senderId, receiver: socket.userId, read: false },
                { $set: { read: true, delivered: true } }
            );
            // Push live read-receipt to the SENDER so their grey ticks turn blue
            // in real time (no reopen). Room broadcast → flows through the adapter.
            if (result.modifiedCount > 0) {
                io.to(`user_${senderId}`).emit("messages-seen", { readerId: socket.userId });
            }
        } catch (err) {
            console.error("mark-read error:", err);
        }
    });

    // Recipient's socket acknowledges it received a message → mark delivered and
    // notify the sender so their single grey tick becomes a double grey tick live.
    socket.on("message-delivered", async ({ messageId, senderId }) => {
        if (!socket.userId || !messageId || !senderId) return;
        try {
            const Message = require("./models/Message");
            // Only the genuine recipient can mark delivered; skip if already set.
            const result = await Message.updateOne(
                { _id: messageId, receiver: socket.userId, delivered: false },
                { $set: { delivered: true } }
            );
            if (result.modifiedCount > 0) {
                io.to(`user_${senderId}`).emit("message-status", { messageId, delivered: true });
            }
        } catch (err) {
            console.error("message-delivered error:", err);
        }
    });

    socket.on("typing-start", ({ receiverId }) => {
        if (!socket.userId || !receiverId) return;
        io.to(`user_${receiverId}`).emit("typing-start", { senderId: socket.userId });
    });

    socket.on("typing-stop", ({ receiverId }) => {
        if (!socket.userId || !receiverId) return;
        io.to(`user_${receiverId}`).emit("typing-stop", { senderId: socket.userId });
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
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
            imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
            connectSrc: ["'self'", "wss:", "ws:", "https://api.groq.com", "https://api-inference.huggingface.co"],
            mediaSrc: ["'self'", "blob:", "data:"],
            workerSrc: ["'self'", "blob:"],
        }
    },
    crossOriginEmbedderPolicy: false, // allow cross-origin images to load if needed
}));
// CORS is already applied at the top of the file
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(mongoSanitize); // Use custom sanitizer for Express 5 compatibility
app.use(hpp()); // Protect against HTTP Parameter Pollution attacks
app.use(generalLimiter); // Apply general rate limiter
app.use(require('express-session')({ secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'secret', resave: false, saveUninitialized: false }));
app.use(require('./config/passport').initialize());

// Lightweight health check — no DB/Redis hit, so the keep-warm self-ping
// (and any external uptime monitor) stays cheap and always-200.
app.get("/api/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        platform: process.env.PLATFORM_NAME || "unknown",
        uptime: process.uptime()
    });
});

// Routes
app.use("/api/auth", authLimiter, authRoutes); // Apply auth limiter here
app.use("/api/auth", oauthRoutes);
app.use("/api/skills", skillRoutes);
app.use("/api/user", userRoutes);
app.use("/api/trust", trustRoutes);
app.use("/api/geo", geoRoutes);
app.use("/api/video", videoRoutes);
app.use("/api/connections", connectionRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/cosmic", cosmicRoutes);
app.use("/api/orbit", require("./routes/orbitRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/device", require("./routes/deviceRoutes"));

// ── Admin Command Center (hardened, hidden) ────────────────────────────────
// Namespaced under an unguessable base; every route 404-cloaks for non-admins.
app.use("/api/__ssctl", require("./routes/adminPortal"));
// Supersede the legacy weakly-guarded /api/admin surface: it now 404s like any
// non-existent route. Its storage/archive tooling is migrated into the portal.
app.use("/api/admin", (req, res) => res.status(404).end());

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
        // Minimal root response in production (A11) — don't advertise the stack.
        // A dedicated health probe lives at /api/health.
        res.status(200).json({ status: "ok" });
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
// maxPoolSize is set explicitly so (instances × pool) stays under the Atlas
// connection cap (M0 free ≈ 500). Default 10; tune via DB_MAX_POOL.
mongoose.connect(process.env.MONGO_URI, {
    maxPoolSize: Number(process.env.DB_MAX_POOL) || 10,
    minPoolSize: Number(process.env.DB_MIN_POOL) || 2,
    serverSelectionTimeoutMS: Number(process.env.DB_TIMEOUT_MS) || 5000,
})
    .then(() => {
        console.log("MongoDB Connected");
        startArchiveWorker(); // Phase 3: Start the nightly archive worker
        startSentimentWorker(); // Cosmic: precompute review sentiment off the request path
        startSeasonWorker(); // Cosmic: monthly season lifecycle + rollover (idempotent)
        startOrbitWorker(io); // Orbit: daily decaying-streak reminders (loss-aversion nudge)
        startLeagueWorker(io); // Orbit: weekly League promotion/relegation + regroup

        // One-time admin bootstrap for hosts without a shell (e.g. Render free
        // tier): set RUN_ADMIN_SEED=true + ADMIN_EMAIL + ADMIN_INITIAL_PASSWORD,
        // deploy once, confirm the log line, then REMOVE the flag. Idempotent and
        // preserves any existing TOTP enrolment.
        if (process.env.RUN_ADMIN_SEED === "true") {
            require("./services/adminSeeder").seedAdminUser()
                .then((r) => console.log(`[admin-seed] ✓ ${r.email} is admin.${r.totpEnabled ? " (TOTP preserved)" : " Enrol TOTP on first login."} You can now remove RUN_ADMIN_SEED.`))
                .catch((e) => console.error("[admin-seed] failed:", e.message));
        }
    })
    .catch(err => console.log("DB Error:", err));

// Server — use server.listen instead of app.listen for Socket.IO
const PORT = process.env.PORT || 8000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    // Eagerly report FCM push status at boot so deploy logs confirm the env vars
    // are wired (isEnabled() triggers the lazy init and prints a [fcm] line).
    try {
        require("./services/fcm").isEnabled();
    } catch (e) {
        console.error("[fcm] status check failed:", e.message);
    }
});

// ── Keep-warm self-ping (OPT-IN, default OFF) ──────────────────────────────
// A self-ping keeps a free instance awake so it never cold-starts. BUT keeping
// a Render free service awake 24/7 burns ~744 of its 750 monthly instance-hours
// → mid-month suspension (exactly what happened). In the multi-backend setup the
// Worker routes to an always-warm primary (Railway) and only fails over to the
// backup (Render) occasionally, so the backup should be allowed to SLEEP and use
// almost no hours. Therefore keep-warm is now OFF unless you explicitly opt in
// with KEEP_WARM=true on a host that genuinely needs to stay warm. We ping only a
// KNOWN-SELF url (Render injects RENDER_EXTERNAL_URL; or set PUBLIC_URL) so a host
// can never accidentally ping a DIFFERENT backend awake. Disabled when fetch is
// unavailable (Node < 18).
const SELF_PING_URL =
    process.env.RENDER_EXTERNAL_URL ||
    process.env.PUBLIC_URL ||
    null;

if (process.env.KEEP_WARM === "true" && SELF_PING_URL && typeof fetch === "function") {
    const KEEP_WARM_MS = 10 * 60 * 1000; // every 10 min — under Render's 15-min sleep threshold
    const ping = () => {
        fetch(`${SELF_PING_URL}/api/health`)
            .then((r) => console.log(`[keep-warm] self-ping ${r.status}`))
            .catch((e) => console.log(`[keep-warm] self-ping failed: ${e.message}`));
    };
    setInterval(ping, KEEP_WARM_MS).unref();
    console.log(`Keep-warm self-ping enabled → ${SELF_PING_URL}/api/health every 10 min`);
} else {
    console.log("Keep-warm self-ping disabled (set KEEP_WARM=true to enable; leave OFF on free Render to conserve instance-hours)");
}

// Graceful Shutdown implementation
const gracefulShutdown = () => {
    console.log("Received kill signal, shutting down gracefully...");
    server.close(() => {
        console.log("Closed out remaining HTTP and Socket.io connections.");
        // Close DB connection
        mongoose.connection.close(false).then(() => {
            console.log("MongoDb connection closed.");
            // Close Redis clients (only created when the adapter is enabled)
            if (pubClient) pubClient.quit();
            if (subClient) subClient.quit();
            process.exit(0);
        });
    });

    // Force close after 10s
    setTimeout(() => {
        console.error("Could not close connections in time, forcefully shutting down");
        process.exit(1);
    }, 10000);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);