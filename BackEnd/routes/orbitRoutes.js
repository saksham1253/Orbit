const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/auth");

const { getMyOrbit, claimMission, buyFreeze } = require("../controllers/orbitController");
const shop = require("../controllers/shopController");

// The viewer's Orbit state — streak, Gravity Assist freezes, Stardust, missions.
// Self-heals the weekly rollovers on read (protected).
router.get("/me", auth, getMyOrbit);

// Claim a completed weekly mission's Stardust reward (protected).
router.post("/missions/:key/claim", auth, claimMission);

// Spend Stardust to bank one extra Gravity Assist freeze (protected).
router.post("/freeze/buy", auth, buyFreeze);

// ── Stardust Cosmetics Shop (Tier 3) ───────────────────────────────────────
router.get("/shop", auth, shop.getShop);
router.post("/shop/buy", auth, shop.buy);
router.post("/shop/equip", auth, shop.equip);

module.exports = router;
