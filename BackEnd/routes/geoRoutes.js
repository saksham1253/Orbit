const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/auth");

const {
    updateLocation,
    getNearbyUsers,
    getNearbySkills,
    geocode
} = require("../controllers/geoController");

// Update my location (geocodes to lat/lng automatically) (protected)
router.put("/location", auth, updateLocation);

// Get nearby users within radius (protected)
// Query: ?radius=50 (km, default 50)
router.get("/nearby-users", auth, getNearbyUsers);

// Get skills from nearby users (protected)
// Query: ?radius=50
router.get("/nearby-skills", auth, getNearbySkills);

// Geocode helper — convert location string to coords (protected)
// Query: ?q=Dehradun
router.get("/geocode", auth, geocode);

module.exports = router;
