const express = require("express");
const router = express.Router();

const {
    addSkill,
    getAllSkills,
    getMySkills,
    updateSkill,
    deleteSkill,
    getMatches
} = require("../controllers/skillController");

const auth = require("../middleware/auth");

// ================= ROUTES =================

// Add skill (protected)
router.post("/add", auth, addSkill);

// Get all skills (protected)
router.get("/all", auth, getAllSkills);

// Get logged-in user's skills (protected)
router.get("/my", auth, getMySkills);

// Get skill matches for logged-in user (protected)
router.get("/matches", auth, getMatches);

// Update a skill (protected)
router.put("/:id", auth, updateSkill);

// Delete a skill (protected)
router.delete("/:id", auth, deleteSkill);

module.exports = router;
