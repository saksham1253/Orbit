# 🛠 Backend Developer 1: Technical Breakdown & Guide

Welcome to the Core API & Data Architecture role! As Backend Developer 1, you are the foundational architect of the SkillSwap platform. You are responsible for designing the database structures, securing user data through cryptography, building the primary API highways that the frontend consumes, and enforcing strict community safety rules.

This document breaks down your exact responsibilities, explaining the overarching Computer Science theories, the specific tools used, and a line-by-line analysis of your code.

---

## 💾 1. Database Design (Mongoose Schemas)

**Tools Used:** `mongoose`, `bcryptjs`
**Purpose:** MongoDB is a "schema-less" NoSQL database. While flexible, this can lead to chaotic data if users submit unexpected JSON. You use Mongoose to enforce strict schemas, ensuring required fields exist, data types are correct, and pre-save hooks (like password hashing) run automatically.

### The Code: User Schema & Password Hashing
**File:** `BackEnd/models/User.js`

```javascript
// 1. Defining the Schema
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    trustScore: { type: Number, default: 100 },
    strikes: { type: Number, default: 0 },
    banExpiresAt: { type: Date, default: null },
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] }
    }
}, { timestamps: true });

// 2. Geospatial Indexing
userSchema.index({ location: '2dsphere' });

// 3. Cryptographic Pre-Save Hook
userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});
```

### Line-by-Line Breakdown:
* `const userSchema = new mongoose.Schema({...})`: We define the exact blueprint for a User object.
* `email: { ..., unique: true }`: Mongoose will automatically build a unique index in MongoDB for the email field. If two users try to register with the same email, MongoDB will block the second insert at the engine level, preventing duplicate accounts.
* `trustScore: { ..., default: 100 }`: By setting default values here, we ensure that even if the frontend forgets to send a `trustScore` during registration, the database automatically initializes the user with a perfect score.
* `userSchema.index({ location: '2dsphere' })`: **Crucial Step.** MongoDB cannot mathematically search for "users nearby" unless the field is indexed specifically as a 2D sphere. This command builds an internal geospatial tree map in the database, allowing ultra-fast geographic queries.
* `userSchema.pre("save", async function(...) { ... })`: This is a Mongoose Middleware hook. Before Mongoose executes the `db.collection.insert()` command, it intercepts the data.
* `if (!this.isModified("password")) return next()`: If a user is just updating their bio, their password hasn't changed. We skip hashing to prevent double-hashing their already hashed password (which would break their login).
* `const salt = await bcrypt.genSalt(10)`: We use Bcrypt to generate a random string (a salt) using a cost factor of 10. This makes the hashing process computationally expensive. If a hacker steals the database, the computational cost prevents them from running brute-force dictionary attacks.
* `this.password = await bcrypt.hash(this.password, salt)`: We permanently replace the plain-text password (e.g., `password123`) with a 60-character cryptographic hash before it touches the hard drive.

---

## 🔐 2. Authentication & JWT (Stateless Sessions)

**Tools Used:** `jsonwebtoken`, `bcryptjs`
**Purpose:** Traditional sessions save a user's login state in server memory, which limits scalability. By using JSON Web Tokens (JWT), you shift the session state to the client, keeping the server completely stateless.

### The Code: Login & Token Generation
**File:** `BackEnd/controllers/authController.js`

```javascript
exports.login = async (req, res) => {
    const { email, password } = req.body;
    
    // 1. Verify User
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    // 2. Cryptographic Password Comparison
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    // 3. JWT Signing
    const payload = { user: { id: user.id } };
    jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: "5h" },
        (err, token) => {
            if (err) throw err;
            res.json({ token, user: { id: user.id, name: user.name } });
        }
    );
};
```

### Line-by-Line Breakdown:
* `const { email, password } = req.body`: Express parses the incoming HTTP JSON payload into `req.body`. We destructure the fields.
* `const user = await User.findOne({ email })`: We scan the MongoDB index for this email. We `await` it because database I/O is asynchronous and we don't want to block the Node Event Loop.
* `if (!user) ... "Invalid credentials"`: Notice we do not say "Email not found." This is a security best practice to prevent attackers from discovering which emails are registered on our platform.
* `const isMatch = await bcrypt.compare(password, user.password)`: Bcrypt mathematically combines the plain-text password they just typed with the salt stored in `user.password` and hashes them again. If the output matches the stored hash, they typed the correct password.
* `const payload = { user: { id: user.id } }`: We construct a tiny object containing *only* the database ID. We do not put the password or email in the token payload because tokens can be easily decoded (Base64) by anyone on the internet.
* `jwt.sign(...)`: We cryptographically sign the payload using `process.env.JWT_SECRET`. Because only the backend knows this secret key, if a user modifies their token in the browser to pretend to be an admin, the signature validation will instantly fail later.
* `{ expiresIn: "5h" }`: We enforce a strict Time-To-Live (TTL). After 5 hours, the token self-destructs, requiring the user to log in again. This limits the damage of stolen tokens.

---

## 🛡 3. Security & The Ban Logic

**Tools Used:** JavaScript Date Math
**Purpose:** To enforce community standards by mathematically locking out users who receive 3 safety strikes.

### The Code: Temporal Ban Enforcement
**File:** `BackEnd/controllers/authController.js` (Inside the `login` function)

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

### Line-by-Line Breakdown:
* `if (user.strikes >= 3)`: If the user was flagged 3 times by our `safetyCheck.js` middleware, this block activates on every login attempt.
* `new Date()`: Grabs the server's current UTC timestamp in milliseconds.
* `user.banExpiresAt`: The timestamp stored in MongoDB when they received their 3rd strike.
* `(new Date() - user.banExpiresAt)`: Subtracting two JavaScript dates yields the difference in raw milliseconds.
* `/ (1000 * 60 * 60)`: We mathematically convert milliseconds to hours. (1000ms = 1 sec, 60 sec = 1 min, 60 min = 1 hr).
* `if (hoursSinceBan < 10)`: If they have not served their 10-hour sentence, we block them.
* `res.status(403)`: 403 Forbidden indicates that the server understands the request but refuses to authorize it.
* `Math.ceil(10 - hoursSinceBan)`: We subtract the hours served from the 10-hour total, and round up (`ceil`) to give them a clean integer (e.g., "Try again in 4 hours").
* `else { ... await user.save() }`: If 10 hours have passed, we reset their strikes and clear the ban timer, saving the "forgiven" state back to MongoDB.

---

## 🛣 4. Core REST APIs (Skills Routing)

**Tools Used:** `express.Router`, Mongoose `.populate()`
**Purpose:** To build the CRUD (Create, Read, Update, Delete) pathways that the frontend relies on to display content.

### The Code: Fetching All Skills
**File:** `BackEnd/routes/skillRoutes.js`

```javascript
router.get("/all", auth, async (req, res) => {
    try {
        const skills = await Skill.find({ userId: { $ne: req.user.id } })
            .populate("userId", "name location trustScore")
            .sort({ createdAt: -1 });

        // Filter out banned users or low trust scores
        const safeSkills = skills.filter(skill => {
            if (!skill.userId) return false;
            if (skill.userId.strikes >= 3) return false;
            if (skill.userId.trustScore <= 35) return false;
            return true;
        });

        // Sort by trust score (highest first)
        safeSkills.sort((a, b) => b.userId.trustScore - a.userId.trustScore);

        res.json(safeSkills);
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});
```

### Line-by-Line Breakdown:
* `router.get("/all", auth, async ...)`: We define a GET endpoint. We inject the `auth` middleware first. If the user doesn't have a valid JWT, this code never runs.
* `Skill.find({ userId: { $ne: req.user.id } })`: We fetch all skills, but use the MongoDB `$ne` (Not Equal) operator to filter out the user's *own* skills. They shouldn't see their own postings in the public feed.
* `.populate("userId", "name location trustScore")`: The `Skill` document only stores the `userId` as a raw string (ObjectId). The frontend needs the user's name to render the UI card. `.populate()` performs an inner join, grabbing the corresponding User document and injecting just the `name`, `location`, and `trustScore` fields.
* `const safeSkills = skills.filter(...)`: We run a JavaScript array filter. If a user is banned (`strikes >= 3`) or untrusted (`trustScore <= 35`), their skills are scrubbed from the public feed to protect the community.
* `safeSkills.sort((a, b) => b.userId.trustScore - a.userId.trustScore)`: We use JavaScript's native sort function. By returning `b - a`, we sort the array in descending order, guaranteeing that the most trusted, reputable users always appear at the very top of the Browse feed.
* `res.json(safeSkills)`: We serialize the final, safe array into JSON and send it over the network to the frontend.
