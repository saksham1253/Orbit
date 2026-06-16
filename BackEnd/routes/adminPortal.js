/**
 * adminPortal.js — the entire Admin Command Center API, namespaced under an
 * unguessable base (`/api/__ssctl`). Mounted in server.js BEFORE the SPA
 * catch-all. Anything not matched here, and any request that fails RBAC, returns
 * a plain 404 so the portal is indistinguishable from a non-existent route.
 *
 * Later commits extend this router (users, cosmic, records, audit, moderation,
 * system). This commit wires the hardened auth flow.
 */
const express = require("express");
const router = express.Router();

const { adminAuthLimiter, adminApiLimiter } = require("../middleware/adminRateLimit");
const { requireAdmin } = require("../middleware/adminAuth");
const adminAuth = require("../controllers/adminAuthController");
const admin = require("../controllers/adminController");

// Security headers for the whole admin surface: never index, never frame.
router.use((req, res, next) => {
    res.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.set("X-Frame-Options", "DENY");
    res.set("Referrer-Policy", "no-referrer");
    res.set("Cache-Control", "no-store");
    next();
});

// Optional IP allowlist (comma-separated CIDRs/IPs in ADMIN_IP_ALLOWLIST). When
// set, anyone outside the list gets a 404 for the entire portal.
router.use((req, res, next) => {
    const allow = (process.env.ADMIN_IP_ALLOWLIST || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (allow.length === 0) return next();
    const ip = ((req.headers["x-forwarded-for"] || "").split(",")[0].trim()) || req.ip || "";
    const ok = allow.some((a) => ip === a || ip.endsWith(a));
    if (!ok) return res.status(404).end();
    next();
});

// ── Auth (unauthenticated entry points, strictly rate-limited) ──────────────
router.post("/auth/login", adminAuthLimiter, adminAuth.login);
router.post("/auth/enroll-totp", adminAuthLimiter, adminAuth.enrollTotp);
router.post("/auth/verify-totp", adminAuthLimiter, adminAuth.verifyTotp);

// ── Authenticated session endpoints ─────────────────────────────────────────
router.get("/auth/me", adminApiLimiter, requireAdmin, adminAuth.me);
router.post("/auth/logout", adminApiLimiter, requireAdmin, adminAuth.logout);
router.post("/auth/revoke-all", adminApiLimiter, requireAdmin, adminAuth.revokeAll);

// ── Command Center data (all behind RBAC) ───────────────────────────────────
router.get("/overview", adminApiLimiter, requireAdmin, admin.getOverview);

// Anything else under the admin base → 404 (cloak).
router.use((req, res) => res.status(404).end());

module.exports = router;
