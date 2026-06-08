const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/auth");

const {
    submitRating,
    getUserRatings,
    getMyTrustScore,
    getMyGivenRatings,
    reportUser
} = require("../controllers/trustController");

// Submit a rating for another user (protected)
router.post("/rate", auth, submitRating);

// Get ratings for a specific user (public)
router.get("/ratings/:userId", getUserRatings);

// Get my own trust score + breakdown (protected)
router.get("/my-score", auth, getMyTrustScore);

// Get ratings I have given to others (protected)
router.get("/my-given", auth, getMyGivenRatings);

// Report a user (protected)
router.post("/report", auth, reportUser);

module.exports = router;
