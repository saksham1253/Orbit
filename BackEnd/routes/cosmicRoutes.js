const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/auth");

const { getLeaderboard, getMentorCosmic } = require("../controllers/cosmicController");

// Local cosmic leaderboard for the requested scope (protected)
router.get("/leaderboard", auth, getLeaderboard);

// A single mentor's cosmic profile (protected)
router.get("/mentor/:id", auth, getMentorCosmic);

module.exports = router;
