# 🎓 SkillSwap: The Deep-Dive Masterclass (Extended Edition)

Welcome to the ultimate technical breakdown of the SkillSwap platform. As your instructor and team leader, my goal here is to take you beyond simply reading code. I want you to understand the Computer Science fundamentals, the security implications, and the precise control flow of every single byte of data that moves through our system.

This document provides a painstakingly detailed, line-by-line analysis of the most complex and critical functions in both our frontend and backend. 

---

## 🏗 Function 1: The Authentication & Ban Engine (Backend)
**File:** `BackEnd/controllers/authController.js`
**Function:** `exports.login`

The login function is the first line of defense for the entire application. It doesn't just check a password; it handles rate limiting, security strikes, temporal calculations for bans, and cryptographic token generation. Let's break it down piece by piece.

```javascript
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
```
**The Breakdown:**
* `exports.login`: We attach the `login` function to the `exports` object. In Node.js (CommonJS modules), this makes the function globally accessible to our router files when they use `require()`.
* `async (req, res)`: We declare this as an asynchronous function. Node.js operates on a single-threaded Event Loop. If we did synchronous database queries here, the entire server would freeze for *everyone* while it waited for MongoDB. By using `async`, Node pauses this specific request, goes and serves other users, and comes back when the DB responds.
* `req.body`: Express automatically parses incoming HTTP requests. Thanks to the `express.json()` middleware in our server setup, the raw JSON payload sent by the frontend is converted into a native JavaScript object.
* Destructuring `const { email, password }`: This is ES6 syntax. Instead of writing `const email = req.body.email;`, we elegantly extract both properties in one line.

```javascript
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: "Invalid credentials" });
        }
```
**The Breakdown:**
* `await User.findOne({ email })`: We fire a query to MongoDB using Mongoose. We are searching the `users` collection for a document where the `email` field matches exactly. We `await` this promise because the database sits on the hard drive (or a remote server), which takes milliseconds to retrieve.
* `if (!user)`: If the database returns `null`, the user does not exist.
* `return res.status(400)`: We return a 400 Bad Request status. 
* **Security Note:** Notice how we say `"Invalid credentials"` and not `"User not found"`. If a hacker is trying to guess which emails are registered on our platform, saying "User not found" tells them the email isn't registered. Saying "Invalid credentials" keeps it ambiguous, protecting our users' privacy against enumeration attacks.

```javascript
        if (user.strikes >= 3) {
            const hoursSinceBan = (new Date() - user.banExpiresAt) / (1000 * 60 * 60);
            
            if (hoursSinceBan < 10) {
                return res.status(403).json({ 
                    message: `Account banned. Try again in ${Math.ceil(10 - hoursSinceBan)} hours.` 
                });
            } else {
                user.strikes = 0;
                user.banExpiresAt = null;
                await user.save();
            }
        }
```
**The Breakdown (The Temporal Ban System):**
* `if (user.strikes >= 3)`: The platform enforces strict rules against offensive behavior (checked by `safetyCheck.js`). If a user hits 3 strikes, this logic executes on *every* login attempt.
* `new Date()`: This grabs the exact millisecond timestamp of the server right now.
* `user.banExpiresAt`: This is the timestamp saved in MongoDB when the user committed their 3rd strike.
* `(new Date() - user.banExpiresAt)`: Subtracting two JavaScript Date objects results in an integer representing the difference in **milliseconds**.
* `/ (1000 * 60 * 60)`: We mathematically convert milliseconds to hours. (1000ms in a second, 60s in a minute, 60m in an hour).
* `if (hoursSinceBan < 10)`: We enforce a strict 10-hour cooldown. If they are still within this window, we block them.
* `res.status(403)`: 403 Forbidden is the mathematically correct HTTP status code for a client that is authenticated (or trying to) but fundamentally lacks permission.
* `Math.ceil(10 - hoursSinceBan)`: We calculate the remaining time, invert it, and round up to the nearest whole hour to give the user a clean, readable error message.
* `else { ... }`: If 10 hours *have* passed, we forgive the user. We reset their strikes to `0`, nullify the ban timer, and use `await user.save()` to commit this forgiveness to the database so they can log in freely.

```javascript
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials" });
        }
```
**The Breakdown (Cryptographic Verification):**
* `bcrypt.compare`: We **never** store plain-text passwords. When the user registered, we ran their password through a mathematical hashing algorithm. Hashing is a one-way street; it cannot be reversed.
* To check the password, `bcrypt.compare` takes the plain-text password from the login form, applies the exact same mathematical hashing algorithm and salt that was used during registration, and sees if the resulting gibberish matches the gibberish stored in `user.password`. 
* This operation is intentionally slow and CPU-intensive (taking about ~100ms) to prevent hackers from brute-forcing millions of passwords per second.

```javascript
        const payload = { user: { id: user.id } };
        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: "5h" },
            (err, token) => {
                if (err) throw err;
                res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
            }
        );
```
**The Breakdown (Stateless Session Generation):**
* `const payload`: We create a tiny object containing only the user's database ID. This is what we will encrypt. We do NOT put the password or email in the JWT because JWTs can be decoded by anyone.
* `jwt.sign`: This function takes the payload and signs it using an asymmetric cryptographic signature.
* `process.env.JWT_SECRET`: This is our master key. Because only the server knows this key, if a user tries to modify their token to become an "admin", the mathematical signature will break, and our middleware will reject it later.
* `{ expiresIn: "5h" }`: We enforce a strict lifespan on the token. After 5 hours, the token self-destructs. This limits the damage if a user's computer is stolen and their token is extracted.
* Finally, we return the `token` and some basic user data to the frontend so it can save the token in `localStorage` and render the dashboard.

---

## 🗺 Function 2: Geographic Radius Matching (Backend)
**File:** `BackEnd/controllers/geoController.js`
**Function:** `exports.getNearbyUsers`

Matching users based on distance is incredibly mathematically complex because the Earth is a sphere, not a flat 2D grid. We have to account for curvature.

```javascript
exports.getNearbyUsers = async (req, res) => {
    try {
        const { lng, lat, radiusInKm } = req.query;
        
        if (!lng || !lat || !radiusInKm) {
            return res.status(400).json({ message: "Missing location parameters" });
        }
```
**The Breakdown:**
* We intercept a GET request. Unlike POST requests (where data is in `req.body`), GET requests put variables in the URL (e.g., `?lng=78&lat=30&radiusInKm=50`). We destructure these from `req.query`.
* We perform strict validation. If any variable is missing, we immediately abort to prevent the database from throwing a mathematical NaN error.

```javascript
        const radiusInRadians = parseFloat(radiusInKm) / 6378.1;
```
**The Breakdown (Spherical Mathematics):**
* The user inputs a radius in kilometers (e.g., 50km).
* MongoDB's geospatial indexing (`$centerSphere`) requires distances to be passed in **radians**, not kilometers or miles.
* A radian is the standard unit of angular measure. To convert a distance on the surface of a sphere into radians, you must divide the distance by the radius of the sphere itself.
* `6378.1` is the universally accepted equatorial radius of the Earth in kilometers. By dividing `50 / 6378.1`, we tell the database the exact angular sweep it needs to make across the globe to find users.

```javascript
        const nearbyUsers = await User.find({
            "location.coordinates": {
                $geoWithin: {
                    $centerSphere: [[parseFloat(lng), parseFloat(lat)], radiusInRadians]
                }
            },
            _id: { $ne: req.user.id }
        }).select("-password -email -strikes");
```
**The Breakdown (MongoDB Geospatial Indexing):**
* `User.find`: We initiate a mass database query.
* `"location.coordinates"`: We specifically target the GeoJSON field in our schema.
* `$geoWithin`: This is a native MongoDB operator that acts like a cookie-cutter, carving out a specific shape on the globe and returning only the documents inside that shape.
* `$centerSphere`: This defines the shape as a circle on a spherical surface. It requires an array containing two things: `[ [longitude, latitude], radius ]`.
* Notice we parse the coordinates as floats. Longitude MUST come before Latitude in MongoDB, contrary to standard Google Maps ordering!
* `_id: { $ne: req.user.id }`: `$ne` means "Not Equal". We explicitly exclude the user making the request from the results. It makes no sense to show a user that they are 0km away from themselves.
* `.select("-password -email -strikes")`: Security is paramount. We explicitly filter out sensitive fields before sending the data array to the frontend. The `-` symbol tells Mongoose to exclude these fields.

---

## 🔌 Function 3: The Socket Connection Lifecycle (Frontend)
**File:** `FrontEnd/app.js`
**Function:** `initSocket`

WebSockets are what make SkillSwap feel alive and instantaneous. The `initSocket` function establishes a stateful, persistent TCP connection between the browser and the server.

```javascript
const socket = io();

function initSocket() {
  if (!userProfile) return;
```
**The Breakdown:**
* `const socket = io()`: We call the Socket.IO client library (which we imported via CDN in `dashboard.html`). Because we passed no arguments, the library automatically looks at the browser's URL bar and attempts to open a WebSocket connection to the same domain and port.
* `if (!userProfile) return`: This is our safety valve. Because loading the user's profile from the database takes time (an asynchronous HTTP fetch), if this function fires too early, `userProfile` will be null. If we try to read `userProfile._id`, JavaScript will throw a fatal `TypeError` and crash the entire page.

```javascript
  socket.emit('register', userProfile._id);
```
**The Breakdown (Handshaking):**
* `socket.emit` is how the frontend talks to the backend. We define a custom event name called `'register'`.
* We send our unique Database ID as the payload. 
* On the server side, Node catches this event and immediately forces our socket connection into a private "room" named after our ID. This is the foundation of our peer-to-peer notification system.

```javascript
  socket.on('incoming-call', (data) => {
    console.log('Incoming call:', data);
    incomingCallData = data;
    showIncomingCallPopup(data);
  });
```
**The Breakdown (The Push Notification):**
* `socket.on` sets up an Event Listener. This code sits silently in the background, listening to the TCP stream.
* When the server fires an `'incoming-call'` event directly to our room, this listener wakes up instantly.
* `data` contains the JSON payload the server sent (which includes the caller's name, ID, and the generated Jitsi room URL).
* We save this data into a global variable `incomingCallData` so that if the user clicks the "Accept" button later, the click handler knows which call they are referring to.
* Finally, we trigger the DOM manipulation function `showIncomingCallPopup(data)` to make the screen go dark, slide in the ringing modal, and start playing the audio ringtone.

```javascript
  socket.on('call-ended', (data) => {
    if (activeVideoCall && currentCallId === data.callId) {
      toast("The other person ended the call");
      endVideoCall(true);
    }
  });
}
```
**The Breakdown (Graceful Teardown):**
* If the person we are talking to clicks the red "End Call" button, their client tells the server, and the server emits `'call-ended'` to us.
* `if (activeVideoCall && ...)`: We must verify that we are actually in a call, and that the ID of the call that just ended matches the ID of the call we are currently in. (Imagine a scenario where a user is in a call, but receives an end-call packet from a previous, glitched connection).
* `endVideoCall(true)`: We pass `true` to indicate that this is a "silent" teardown. We don't need to tell the server we are ending the call, because the server already knows (it's the one that told us!). This prevents an infinite loop of clients telling each other they ended the call.

---

## 🎥 Function 4: WebRTC & IFrame Hydration (Frontend)
**File:** `FrontEnd/app.js`
**Function:** `startVideoCall`

This function handles the UX flow when a user clicks the "Video Call" button on a peer's profile card. It negotiates with the backend, receives a cryptographic room hash, and embeds the Jitsi video streaming client dynamically.

```javascript
async function startVideoCall(targetUserId) {
  if (!targetUserId) return toast("No user ID provided", 'error');
  
  try {
    toast("Calling…");
    const res = await fetch(`${API}/video/create-room`, {
      method: 'POST', 
      headers: authHeaders,
      body: JSON.stringify({ targetUserId })
    });
```
**The Breakdown:**
* We accept the `targetUserId` as an argument. This was baked into the HTML button during the DOM hydration phase.
* We immediately show a "Calling..." toast notification to give the user instant feedback that their click was registered, improving perceived performance.
* We initiate a `fetch` request to the backend. This is a POST request, so we must manually attach our `authHeaders` (which contains our JWT token) so the server knows who we are.
* We stringify the `targetUserId` into a JSON body. The server will use this to look up the target user's socket room.

```javascript
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
```
**The Breakdown (Error Handling):**
* We pause and wait for the server to reply, then parse the raw HTTP text stream into a JSON object `data`.
* `res.ok` is a boolean provided by the Fetch API. It is `true` if the HTTP status code is between 200 and 299. 
* If the status is 400 (e.g., the server detected the target user is offline, thanks to our `room.size === 0` check!), `res.ok` is `false`. We immediately `throw new Error()`.
* Throwing an error violently ejects us from the `try` block and throws us straight into the `catch` block below, bypassing all the video setup code. This ensures we never open a video screen if the call failed to connect.

```javascript
    currentCallId = data.callId;
    switchSection('video');
    document.getElementById('videoCallIdle').style.display = 'none';
    document.getElementById('videoCallActive').style.display = 'block';
    document.getElementById('videoCallPartner').textContent = data.targetUser.name;
```
**The Breakdown (DOM Manipulation):**
* We save the database's `callId` into a global variable so we can update the database later when the call ends.
* We execute `switchSection('video')`, a utility function that loops through all main UI sections (like Dashboard, Connections, Profile) and sets their CSS `display` to `none`, while setting the Video section to `block`. This creates a Single Page Application (SPA) feel without actually navigating to a new URL.
* We hide the "Idle" video screen (which tells the user to select someone) and reveal the "Active" video screen (which contains the iframe).
* We update the text content of the header so the user knows exactly who they are talking to.

```javascript
    const displayName = encodeURIComponent(data.currentUser.name);
    const jitsiUrl = `https://${data.jitsiDomain}/${data.roomName}#userInfo.displayName="${displayName}"&config.startWithAudioMuted=false&config.startWithVideoMuted=false&config.prejoinPageEnabled=false&config.disableDeepLinking=true&interfaceConfig.SHOW_JITSI_WATERMARK=false`;
    
    document.getElementById('jitsiFrame').src = jitsiUrl;
    activeVideoCall = true;
    startCallTimer();
```
**The Breakdown (Jitsi IFrame Injection):**
* We must `encodeURIComponent()` our name. If our name is "John & Jane", the `&` symbol would break the URL parameters. Encoding turns spaces into `%20` and `&` into `%26`, making it safe for URLs.
* The `jitsiUrl` is constructed dynamically. It combines the Jitsi domain, the unique cryptographic `roomName` (e.g., `SkillSwap-a8f93c...`) generated by the backend, and a massive list of configuration hashes.
* These configurations (`config.prejoinPageEnabled=false`, `config.disableDeepLinking=true`) are critically important. They instruct the Jitsi iframe to bypass the annoying "Enter your name" screen and jump straight into the video feed, bypassing the "Download the app" prompts on mobile.
* Finally, we inject this URL directly into the `src` attribute of our HTML `<iframe>`. The browser immediately reaches out to Jitsi, negotiates the WebRTC STUN/TURN connections, requests camera permissions, and starts streaming video.
* We set our global `activeVideoCall` flag to true (for socket routing) and trigger `startCallTimer()`, which initiates a `setInterval` loop to update the clock on the screen every 1,000 milliseconds.

```javascript
  } catch (err) {
    toast(err.message, 'error');
  }
}
```
**The Breakdown:**
* If anything goes wrong—if the user is offline, if the network drops, if the JWT token is expired—the execution jumps here. The error message sent by the server is extracted and passed to our custom `toast()` function, which slides a red error banner onto the screen to inform the user exactly what failed.
