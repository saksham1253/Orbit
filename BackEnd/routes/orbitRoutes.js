const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/auth");

const { getMyOrbit, claimMission, buyFreeze } = require("../controllers/orbitController");
const constellation = require("../controllers/constellationController");

// The viewer's Orbit state — streak, Gravity Assist freezes, Stardust, missions.
// Self-heals the weekly rollovers on read (protected).
router.get("/me", auth, getMyOrbit);

// Claim a completed weekly mission's Stardust reward (protected).
router.post("/missions/:key/claim", auth, claimMission);

// Spend Stardust to bank one extra Gravity Assist freeze (protected).
router.post("/freeze/buy", auth, buyFreeze);

// ── Constellations (co-op Binary Star streaks, Tier 2) ─────────────────────
router.get("/constellations", auth, constellation.getMine);
router.post("/constellations/invite", auth, constellation.invite);
router.post("/constellations/:id/respond", auth, constellation.respond);
router.post("/constellations/:id/dissolve", auth, constellation.dissolve);

module.exports = router;
