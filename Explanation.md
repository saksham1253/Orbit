# SkillSwap - Deep Technical Architecture & Code Explanation

This document serves as an exhaustive, line-by-line technical breakdown of the SkillSwap platform. It explores not just *what* the code does, but *why* specific architectural decisions were made, how the underlying protocols operate, and the exact flow of data from the database to the DOM.

---

## 1. Architectural Overview & Core Paradigms

SkillSwap is built on a **Client-Server Architecture** utilizing a hybrid communication model:
1. **RESTful HTTP (Stateless)**: Used for standard CRUD operations (creating skills, updating profiles).
2. **WebSockets via Socket.IO (Stateful)**: Used for low-latency, real-time push events (video call ringing, live status).

By separating the stateful (video signaling) from the stateless (fetching skills), the application can scale horizontally (using Redis for Socket.IO if needed later) while keeping standard API calls lightweight and cacheable.

---

## 2. Core Technologies: The "Why" and the "How"

### Node.js & Express.js
* **Why Node?** Node operates on a single-threaded, non-blocking Event Loop. This makes it exceptionally good at handling thousands of simultaneous I/O operations (like database reads or WebSocket connections) without eating up RAM by spawning new threads per user.
* **Why Express?** Express provides a robust routing pipeline via **Middleware**. Middleware functions (like `auth.js` and `safetyCheck.js`) intercept requests before they hit the controller, allowing us to enforce security at a systemic level.

### MongoDB & Mongoose
* **Why MongoDB?** Traditional SQL databases require rigid table structures. MongoDB stores data as BSON (Binary JSON), which maps perfectly to JavaScript objects. It also has natively built-in **Geospatial Indexing** (2dsphere), which is mathematically required for our "Nearby Users" radius search.
* **Why Mongoose?** Mongoose acts as an ODM (Object Data Modeling) layer. It enforces schema validation (e.g., ensuring `trustScore` defaults to 100 and cannot be manipulated by client requests).

### Socket.IO
* **Why not native WebSockets?** Native WebSockets (`ws://`) do not have automatic reconnection, room multiplexing, or fallback to HTTP long-polling if a user is behind a strict corporate firewall. Socket.IO provides all of this out of the box, ensuring 99.9% delivery of our "incoming call" packets.

### Jitsi Meet WebRTC Infrastructure
* **Why Jitsi?** WebRTC requires signaling (which we built via Socket.IO) but also requires STUN servers (to discover public IPs) and TURN servers (to relay video if firewalls block peer-to-peer traffic). Managing a TURN server is incredibly expensive and complex. Jitsi handles the heavy lifting of video relaying through their public SFU (Selective Forwarding Unit), allowing us to embed enterprise-grade video in an iframe securely.

---

## 3. Deep Dive: The Security & Authentication Pipeline

### Passwords & Bcrypt
```javascript
// models/User.js
userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});
```
**In-Depth:** Before a user is ever saved to the database, a Mongoose `pre('save')` hook intercepts the operation. `bcrypt.genSalt(10)` generates a random string (salt) using 10 rounds of cryptographic processing. This ensures that even if two users have the password "password123", their database hashes will look completely different, rendering pre-computed "Rainbow Table" hacking attacks useless.

### Stateless JWT Verification
```javascript
// middleware/auth.js
const token = req.header("Authorization").replace("Bearer ", "");
const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.user = decoded.user;
```
**In-Depth:** SkillSwap does not use server-side sessions (which take up memory). Instead, upon login, the server cryptographically signs a JWT containing the `userId`. For all subsequent requests, the frontend sends this token. The `auth.js` middleware runs `jwt.verify()`. Because the secret key (`JWT_SECRET`) only exists on the server, a hacker cannot forge a token. Once verified, the middleware injects `req.user` into the request, allowing downstream controllers (like `skillController.js`) to know exactly who is making the request without doing a database lookup.

### The Strike & Ban System
```javascript
// controllers/authController.js
if (user.strikes >= 3) {
    const hoursSinceBan = (new Date() - user.banExpiresAt) / (1000 * 60 * 60);
    if (hoursSinceBan < 10) {
        return res.status(403).json({ message: `Account banned. Try again in ${Math.ceil(10 - hoursSinceBan)} hours.` });
    }
}
```
**In-Depth:** This block calculates the delta between the current timestamp and the ban timestamp. `new Date() - user.banExpiresAt` returns milliseconds. Dividing by `(1000 * 60 * 60)` converts milliseconds to hours. If the result is less than 10, the server actively blocks token generation. By keeping this logic on the backend, a malicious user cannot bypass the ban by simply clearing their local storage or cookies.

---

## 4. Deep Dive: Geographic Mathematics & Privacy (Leaflet)

### Coordinate Fuzzing (Privacy Protection)
```javascript
// controllers/geoController.js
const offsetLat = (Math.random() - 0.5) * 0.01;
const offsetLng = (Math.random() - 0.5) * 0.01;
user.location = {
    type: "Point",
    coordinates: [lng + offsetLng, lat + offsetLat]
};
```
**In-Depth:** Exposing exact GPS coordinates in a P2P app is a massive privacy risk. In latitude/longitude terms, `0.01` degrees is roughly equal to 1.1 kilometers. By applying a random offset between `-0.005` and `+0.005`, we permanently shift the user's saved location in the database by a random distance up to ~1km. They will still show up accurately in city-level searches, but stalkers cannot reverse-engineer their exact home address.

### The `$geoWithin` Radius Search
```javascript
// controllers/geoController.js
const radiusInRadians = radiusKm / 6378.1;
const nearbyUsers = await User.find({
    "location.coordinates": {
        $geoWithin: { $centerSphere: [[req.query.lng, req.query.lat], radiusInRadians] }
    }
});
```
**In-Depth:** Standard Euclidean geometry (Pythagorean theorem) fails on a global scale because the Earth is a sphere (latitude lines get closer together at the poles). MongoDB's `$centerSphere` uses Haversine calculations to compute accurate distances along the curvature of the Earth. We divide our desired `radiusKm` (e.g., 50km) by the equatorial radius of the Earth (`6378.1` km) to convert the distance into radians, which MongoDB mathematically requires to sweep the database index and return geographically relevant peers.

---

## 5. Deep Dive: Socket.IO Video Signaling Architecture

Video calling requires two completely separate devices to instantly communicate without refreshing.

### Step 1: The Race Condition Fix & Socket Initialization
```javascript
// FrontEnd/app.js
document.addEventListener('DOMContentLoaded', async () => {
  if (token) {
    await loadProfile(); // CRITICAL WAIT
    initSocket();
  }
});
```
**In-Depth:** Originally, `initSocket()` fired immediately while `loadProfile()` was still asking the server for the user's ID. This resulted in the socket connection succeeding, but the `register` payload being sent with a `null` ID. By marking the DOM loader as `async` and `await`ing `loadProfile`, we halt JavaScript execution on the main thread until the backend responds with the user's DB profile. Only then do we execute `initSocket()`.

### Step 2: Server-Side Registration
```javascript
// BackEnd/server.js
socket.on("register", (userId) => {
    socket.join(`user_${userId}`);
});
```
**In-Depth:** In Socket.IO, every connection receives a random `socket.id` (e.g., `5iawZ1OzM3...`). If a user refreshes the page, that ID changes. To map a persistent Database User to an ephemeral Socket, we use "Rooms". The backend forces the specific socket into a room named `user_{their_database_id}`. Now, the backend can safely route packets to that database ID, regardless of what their temporary socket ID is.

### Step 3: Pinging the Receiver (Checking if Offline)
```javascript
// BackEnd/routes/videoRoutes.js
const room = io.sockets.adapter.rooms.get(`user_${targetUserId}`);
if (!room || room.size === 0) {
    await CallHistory.findByIdAndDelete(callRecord._id);
    return res.status(400).json({ message: "User is not available online right now" });
}
io.to(`user_${targetUserId}`).emit("incoming-call", { ... });
```
**In-Depth:** When User A attempts to call User B, the backend accesses the raw Socket.IO adapter memory map (`io.sockets.adapter.rooms`). It looks for the room `user_B`. If `room.size === 0` (or undefined), it mathematically guarantees that User B does not have any active browser tabs open. The server immediately aborts the call, deletes the "ringing" record from MongoDB, and returns an HTTP 400 error, which triggers the red toast notification on User A's screen.

### Step 4: Jitsi Room Generation & The iFrame
```javascript
// BackEnd/routes/videoRoutes.js
const hash = crypto.createHash("sha256").update([userId1, userId2].sort().join("-")).digest("hex").slice(0, 12);
const roomName = `SkillSwap-${hash}`;
```
**In-Depth:** Jitsi relies on unique string identifiers for meeting rooms. If the string is easily guessable, strangers could drop into the private call. We concatenate the two MongoDB ObjectIDs, `sort()` them alphabetically (so A calling B produces the same string as B calling A), and run it through a SHA-256 cryptographic hashing algorithm. The first 12 characters form a mathematically unique, unguessable room URL.

---

## 6. Deep Dive: UI Hydration and Connection State Locking

The most complex part of the frontend is dynamically deciding whether a user is allowed to Video Call or Rate another user.

### Connection Aggregation
```javascript
// FrontEnd/app.js - fetchConnectedUsers()
connectedUserIds = connections
    .filter(c => c.status === 'accepted')
    .map(c => {
        const reqId = typeof c.requester === 'object' ? c.requester._id : c.requester;
        const recId = typeof c.receiver === 'object' ? c.receiver._id : c.receiver;
        return reqId === userProfile._id ? recId : reqId;
    });
```
**In-Depth:** `fetchConnectedUsers` hits `/api/connections/all`. Because a user could either be the `requester` (they sent the invite) or the `receiver` (they accepted the invite), we must iterate through all accepted relationships. The map function uses a ternary operator: "If I am the requester, extract the receiver's ID. Otherwise, extract the requester's ID." This results in a clean, flat 1D array of strings (e.g., `["user2_id", "user5_id"]`) representing all globally trusted peers.

### Conditional Template Injection (DOM Hydration)
```javascript
// FrontEnd/app.js - skillCardHTML()
${connectedUserIds.includes(skill.userId._id) ? `
    <!-- Unlock Video & Rate Buttons -->
    <div class="video-call-link" onclick="startVideoCall('${skill.userId._id}')">Video Call</div> 
` : `
    <!-- Lock behind Request Button -->
    <button class="btn btn-primary" onclick="requestConnection(...)">Connect Request</button>
`}
```
**In-Depth:** We use ES6 Template Literals to generate HTML strings dynamically. By wrapping the HTML inside a JavaScript ternary evaluation `${ condition ? true_HTML : false_HTML }`, the browser calculates the state *before* touching the DOM. It checks if the `userId` of the skill card exists in the `connectedUserIds` array we built earlier. If true, it injects the highly privileged Video/Rate DOM nodes. If false, those buttons fundamentally do not exist in the HTML structure, making client-side tampering impossible.
