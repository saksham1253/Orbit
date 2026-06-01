const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/auth");

const {
    submitRating,
    getUserRatings,
    getMyTrustScore,
    reportUser
} = require("../controllers/trustController");

// Submit a rating for another user (protected)
router.post("/rate", auth, submitRating);

// Get ratings for a specific user (public)
router.get("/ratings/:userId", getUserRatings);

// Get my own trust score + breakdown (protected)
router.get("/my-score", auth, getMyTrustScore);

// Report a user (protected)
router.post("/report", auth, reportUser);

module.exports = router;
