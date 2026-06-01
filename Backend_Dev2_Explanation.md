# 🚀 Backend Developer 2: Technical Breakdown & Guide

Welcome to the Real-Time Systems & Advanced Queries role! As Backend Developer 2, you are responsible for the most complex logic in the platform: WebSockets, WebRTC signaling, Geospatial Mathematics, and the Peer-to-Peer Connection logic. 

This document breaks down every single one of your core functions, explaining the tools used, the computer science theory, and a line-by-line analysis of the code.

---

## 📡 1. WebSocket Server (`server.js`)

**Tools Used:** `socket.io` (Server-side library), `http` (Node core module)
**Purpose:** To establish a persistent, bidirectional TCP connection between the browser and the server. Unlike HTTP, which closes immediately after a response, WebSockets stay open, allowing the server to push events (like incoming calls) to the client at any time.

### The Code: Socket Initialization & Registration
```javascript
// 1. Initializing the Server
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});
app.set("io", io);

// 2. Handling Connections
io.on("connection", (socket) => {
    socket.on("register", (userId) => {
        if (userId) {
            socket.join(`user_${userId}`);
        }
    });
});
```

### Line-by-Line Breakdown:
* `const io = new Server(server, {...})`: We attach Socket.IO to the raw Node HTTP `server`. WebSockets use a completely different protocol (`ws://`) than HTTP, but they start with an HTTP handshake. We also configure CORS to accept connections from any origin.
* `app.set("io", io)`: **Critical Step.** Express is our router, but it doesn't natively know about Socket.IO. By using `app.set`, we inject the `io` instance into Express's global memory. Later, inside your controller files, you can grab this instance to emit events.
* `io.on("connection", (socket) => { ... })`: This listens for a new client connecting. The `socket` parameter is an object representing *that specific user's connection*. Every connection gets a random ID (e.g., `socket.id = 'abc123'`).
* `socket.on("register", (userId) => { ... })`: We set up a listener for a custom event named `"register"`. When the frontend loads, it emits this event and sends the user's MongoDB Database ID.
* `socket.join(\`user_${userId}\`)`: Because a user's `socket.id` changes every time they refresh the page, we cannot reliably send messages to it. Instead, we use `socket.join()`, a built-in feature that puts the socket into a named virtual "room". By naming the room `user_` plus their Database ID, we create a permanent, predictable target. To send a notification to a user, we simply emit a message to this room, and Socket.IO figures out which active `socket.id` (or IDs, if they have multiple tabs open) should receive it.

---

## 🎥 2. WebRTC Signaling (`videoRoutes.js`)

**Tools Used:** `crypto` (Node core module), `socket.io` (for emitting)
**Purpose:** To generate secure, unguessable meeting rooms and "signal" the other user that a call is incoming. WebRTC (via Jitsi) requires both parties to join the exact same URL string to see each other.

### The Code: Room Generation & Ringing
```javascript
// 1. Cryptographic Room Generation
function generateRoomName(userId1, userId2) {
    const sorted = [userId1, userId2].sort();
    const hash = crypto.createHash("sha256").update(sorted.join("-")).digest("hex").slice(0, 12);
    return `SkillSwap-${hash}`;
}

// 2. The API Route
router.post("/create-room", auth, async (req, res) => {
    const { targetUserId } = req.body;
    const currentUserId = req.user.id;
    const roomName = generateRoomName(currentUserId, targetUserId);

    // 3. Offline Verification
    const io = req.app.get("io");
    if (io) {
        const room = io.sockets.adapter.rooms.get(`user_${targetUserId}`);
        if (!room || room.size === 0) {
            return res.status(400).json({ message: "User is not available online right now" });
        }
        
        // 4. Emitting the Signal
        io.to(`user_${targetUserId}`).emit("incoming-call", {
            callId: callRecord._id,
            roomName,
            caller: { id: currentUserId, name: currentUser.name },
            jitsiDomain: "meet.jit.si"
        });
    }
});
```

### Line-by-Line Breakdown:
* `const sorted = [userId1, userId2].sort()`: We sort the IDs alphabetically. This mathematically guarantees that regardless of who calls who (User A calls B, or User B calls A), the resulting array is identical.
* `crypto.createHash("sha256")`: We use a SHA-256 algorithm to hash the sorted IDs. This creates an irreversible, cryptographic string. We slice the first 12 characters to create a unique URL (e.g., `SkillSwap-1a2b3c4d5e6f`) that hackers cannot guess, preventing "zoombombing."
* `const io = req.app.get("io")`: As mentioned in Section 1, we pull the Socket.IO instance out of Express's memory.
* `const room = io.sockets.adapter.rooms.get(\`user_${targetUserId}\`)`: We access the raw memory map of Socket.IO (`adapter.rooms`). We check if the room belonging to the target user exists.
* `if (!room || room.size === 0)`: If the room doesn't exist or is empty, it means the target user does not have our website open in any browser tab. We instantly abort the HTTP request with a `400` status.
* `io.to(...).emit("incoming-call", {...})`: If they are online, we emit the `incoming-call` event directly to their room. The JSON payload includes the secure `roomName` so their frontend knows exactly which Jitsi URL to embed in their iframe.

---

## 🌍 3. Geospatial Logic (`geoController.js`)

**Tools Used:** `MongoDB (Mongoose)` geospatial indexing (`$geoWithin`, `$centerSphere`).
**Purpose:** To calculate distances along the curvature of the Earth and offset exact coordinates to protect user privacy.

### The Code: Nearby Search & Privacy Fuzzing
```javascript
// 1. Privacy Fuzzing (On Save)
const offsetLat = (Math.random() - 0.5) * 0.01;
const offsetLng = (Math.random() - 0.5) * 0.01;
user.location = {
    type: "Point",
    coordinates: [lng + offsetLng, lat + offsetLat]
};

// 2. Geospatial Search
exports.getNearbyUsers = async (req, res) => {
    const { lng, lat, radiusInKm } = req.query;
    const radiusInRadians = parseFloat(radiusInKm) / 6378.1;

    const nearbyUsers = await User.find({
        "location.coordinates": {
            $geoWithin: {
                $centerSphere: [[parseFloat(lng), parseFloat(lat)], radiusInRadians]
            }
        },
        _id: { $ne: req.user.id }
    });
};
```

### Line-by-Line Breakdown:
* `(Math.random() - 0.5) * 0.01`: `Math.random()` generates a decimal between 0 and 1. Subtracting 0.5 shifts it to a range of `-0.5` to `+0.5`. Multiplying by `0.01` gives a maximum variance of roughly ~1.1 kilometers. We add this random offset to their real coordinates before saving to MongoDB, meaning their exact house address is mathematically obscured to protect their privacy.
* `const radiusInRadians = parseFloat(radiusInKm) / 6378.1`: Because the Earth is a sphere, 2D geometry (a flat circle) does not accurately calculate distances (latitude lines compress at the poles). MongoDB requires distance searches to be defined in **radians**. We convert the user's requested kilometer radius by dividing it by the equatorial radius of the Earth (`6378.1` km).
* `$geoWithin`: A MongoDB operator that filters documents completely contained within a specific geometry.
* `$centerSphere`: Defines the geometry as a circle on a spherical surface. It requires an array where the first element is the center coordinate `[longitude, latitude]` and the second is the radius in radians.
* `_id: { $ne: req.user.id }`: `$ne` stands for "Not Equal". We exclude the querying user from the results (you shouldn't see yourself on the map).

---

## 🤝 4. Connections System (`connectionController.js`)

**Tools Used:** `MongoDB` complex querying (`$or`, `.populate()`).
**Purpose:** To manage the social graph of the platform (sending, accepting, and declining peer-to-peer connection requests).

### The Code: Fetching the Social Graph
```javascript
exports.getMyConnections = async (req, res) => {
    try {
        const connections = await Connection.find({
            $or: [{ requester: req.user.id }, { receiver: req.user.id }]
        })
        .populate("requester", "name email trustScore location")
        .populate("receiver", "name email trustScore location")
        .populate("skill", "skillOffered skillWanted level");
        
        res.status(200).json(connections);
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};
```

### Line-by-Line Breakdown:
* `Connection.find({ ... })`: We query the `Connection` collection in MongoDB.
* `$or: [{ requester: req.user.id }, { receiver: req.user.id }]`: A connection involves two people. Because you could have *sent* the request (making you the `requester`) or *received* the request (making you the `receiver`), we must use the `$or` logical operator to fetch all relationships that you are a part of, regardless of who initiated it.
* `.populate("requester", "name email ...")`: MongoDB stores the `requester` and `receiver` as simple ObjectIDs (e.g., `64f1a2b...`). The frontend needs their actual name and email to render the UI. `.populate()` acts like a SQL `JOIN`—Mongoose takes the ID, goes to the `users` collection, pulls out the matching document, and replaces the raw ID with an object containing the requested fields (`name`, `email`, `trustScore`, etc.). We chain `.populate()` three times to expand both users and the specific skill the connection was based on.
* `res.status(200).json(connections)`: We send the fully populated array back to the frontend, where Frontend Developer 2 will use `.filter(c => c.status === 'accepted')` to hydrate the "Friends" list UI.
