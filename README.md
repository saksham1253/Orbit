# SkillSwap - Peer-to-Peer Learning Platform

SkillSwap is a secure, real-time platform where users can exchange skills, connect over video calls, and map nearby learners. Built with a unified Node.js/Express backend and a vanilla JavaScript frontend.

---

## 👥 Team Workflow & Division of Labor

As a team of four developers, we have divided the workload into specialized domains to ensure parallel development, prevent merge conflicts, and maintain high code quality. The architecture is split into Backend (Node.js/Express) and Frontend (Vanilla JS/CSS).

### 🛠 Backend Team (2 Members)

**Backend Developer 1 (Core API & Data Architecture)**
* **Responsibilities:**
  * **Database Design:** Designing Mongoose schemas (`User.js`, `Skill.js`, `Connection.js`, `CallHistory.js`) and ensuring proper indexes.
  * **Authentication:** Implementing Bcrypt for password hashing and JSON Web Tokens (JWT) for stateless session management (`authController.js`, `auth.js` middleware).
  * **Core REST APIs:** Building the CRUD routes for users and skills (`userRoutes.js`, `skillRoutes.js`).
  * **Security:** Implementing the 3-strike ban logic and ensuring input sanitization.

**Backend Developer 2 (Real-Time Systems & Advanced Queries)**
* **Responsibilities:**
  * **WebSocket Server:** Managing the Socket.IO instance, handling user registration to distinct rooms, and maintaining connection stability (`server.js`).
  * **WebRTC Signaling:** Building the video call logic, creating hashed Jitsi rooms, and emitting `incoming-call` events (`videoController.js`, `videoRoutes.js`).
  * **Geospatial Logic:** Using MongoDB `$geoWithin` and `$centerSphere` math to query nearby users and applying privacy coordinate offset fuzzing (`geoController.js`).
  * **Connections System:** Managing the complex logic for sending, accepting, and declining peer requests (`connectionController.js`).

### 🎨 Frontend Team (2 Members)

**Frontend Developer 1 (UI/UX, Layouts & Mapping)**
* **Responsibilities:**
  * **CSS Design System:** Managing the glassmorphism UI, global CSS variables, responsive grids, and animations (`styles.css`, `login.css`).
  * **DOM Structure:** Writing clean, accessible HTML5 for the dashboard, login forms, and modal overlays (`index.html`, `dashboard.html`).
  * **Leaflet Mapping:** Integrating `Leaflet.js`, plotting coordinates on the map, and handling map tile rendering.
  * **Client-Side Auth:** Managing the login/register UI toggles and storing/clearing the JWT in `localStorage`.

**Frontend Developer 2 (State Hydration & Async Integration)**
* **Responsibilities:**
  * **API Fetch Logic:** Writing the asynchronous `fetch()` calls to interact with the backend (fetching skills, matching logic) (`app.js`).
  * **Real-Time Listeners:** Handling Socket.IO client events (e.g., triggering the ringing popup when `socket.on('incoming-call')` fires).
  * **DOM Hydration:** Dynamically generating HTML strings for skill cards using template literals, and securely locking/unlocking the Video Call buttons based on connection state.
  * **Call History & Video UI:** Managing the Jitsi iframe embedding, call timer intervals, and active call UI states.

---

## 🚀 Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript, Leaflet.js
- **Backend**: Node.js, Express.js
- **Database**: MongoDB (Mongoose)
- **Real-Time**: Socket.IO, WebRTC (Jitsi)

## 🔧 How to Run

1. Navigate to the `BackEnd` directory.
2. Run `npm install` to install dependencies.
3. Start the unified server using `node server.js`.
4. The server runs on `http://localhost:8000` and serves both the API and the Frontend.