const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/auth");

const { getMyOrbit, claimMission, buyFreeze, setPrefs } = require("../controllers/orbitController");
const constellation = require("../controllers/constellationController");
const { getMyLeague } = require("../controllers/leagueController");
const shop = require("../controllers/shopController");

// The viewer's Orbit state — streak, Gravity Assist freezes, Stardust, missions.
// Self-heals the weekly rollovers on read (protected).
router.get("/me", auth, getMyOrbit);

// Claim a completed weekly mission's Stardust reward (protected).
router.post("/missions/:key/claim", auth, claimMission);

// Spend Stardust to bank one extra Gravity Assist freeze (protected).
router.post("/freeze/buy", auth, buyFreeze);

// Update engagement preferences (e.g. decay-reminder opt-out — protected).
router.post("/prefs", auth, setPrefs);

// ── Constellations (co-op Binary Star streaks, Tier 2) ─────────────────────
router.get("/constellations", auth, constellation.getMine);
router.post("/constellations/invite", auth, constellation.invite);
router.post("/constellations/:id/respond", auth, constellation.respond);
router.post("/constellations/:id/dissolve", auth, constellation.dissolve);

// Weekly League — the viewer's division + live group standings (protected).
router.get("/league", auth, getMyLeague);

// ── Stardust Cosmetics Shop (Tier 3) ───────────────────────────────────────
router.get("/shop", auth, shop.getShop);
router.post("/shop/buy", auth, shop.buy);
router.post("/shop/equip", auth, shop.equip);

module.exports = router;
