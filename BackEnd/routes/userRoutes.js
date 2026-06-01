const express = require("express");
const router = express.Router();

const { getProfile, updateProfile } = require("../controllers/userController");
const auth = require("../middleware/auth");

// Get my profile (protected)
router.get("/profile", auth, getProfile);

// Update my profile (protected)
router.put("/profile", auth, updateProfile);

module.exports = router;
