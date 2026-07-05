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
const users = require("../controllers/adminUsersController");
const cosmic = require("../controllers/adminCosmicController");
const records = require("../controllers/adminRecordsController");
const system = require("../controllers/adminSystemController");

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

// Users management
router.get("/users", adminApiLimiter, requireAdmin, users.listUsers);
router.get("/users/:id", adminApiLimiter, requireAdmin, users.getUser);
router.patch("/users/:id", adminApiLimiter, requireAdmin, users.updateUser);
router.post("/users/:id/role", adminApiLimiter, requireAdmin, users.setRole);
router.post("/users/:id/status", adminApiLimiter, requireAdmin, users.setStatus);
router.post("/users/:id/reset-password", adminApiLimiter, requireAdmin, users.triggerPasswordReset);

// Cosmic observability
router.get("/cosmic/rank-events", adminApiLimiter, requireAdmin, cosmic.listRankEvents);
router.get("/cosmic/quasar", adminApiLimiter, requireAdmin, cosmic.quasarRegistry);
router.get("/cosmic/score/:userId", adminApiLimiter, requireAdmin, cosmic.scoreInspector);
router.post("/cosmic/score/:userId/recompute", adminApiLimiter, requireAdmin, cosmic.recompute);
router.post("/cosmic/score/:userId/override", adminApiLimiter, requireAdmin, cosmic.overrideTier);

// Records browser + safe deletion
router.get("/records/users/:id/delete-preview", adminApiLimiter, requireAdmin, records.deletePreview);
router.post("/records/users/:id/soft-delete", adminApiLimiter, requireAdmin, records.softDelete);
router.post("/records/users/:id/restore", adminApiLimiter, requireAdmin, records.restore);
router.post("/records/users/:id/hard-delete", adminApiLimiter, requireAdmin, records.hardDelete);
router.get("/records/:collection", adminApiLimiter, requireAdmin, records.listRecords);

// Audit log viewer (append-only; no delete route exists by design)
router.get("/audit", adminApiLimiter, requireAdmin, records.listAudit);

// ── Mission Control: Orbit demo seeder + time-travel (C2 / §5) ──────────────
// Fill an account so every gamification tier renders at once, warp time-gated
// features, and undo exactly. Prod-guarded + audited inside the controller.
const missionControl = require("../controllers/missionControlController");
// C1 Flag Cockpit — live feature flags (no redeploy)
router.get("/mission-control/flags", adminApiLimiter, requireAdmin, missionControl.listFlags);
router.patch("/mission-control/flags", adminApiLimiter, requireAdmin, missionControl.setFlag);
router.post("/mission-control/seed", adminApiLimiter, requireAdmin, missionControl.seed);
router.post("/mission-control/warp", adminApiLimiter, requireAdmin, missionControl.warp);
router.post("/mission-control/teardown", adminApiLimiter, requireAdmin, missionControl.teardown);
// C5 Player Inspector · C3 Anti-Gaming Simulator · C8 Pre-Flight · C9 Push Bench
router.get("/mission-control/users/:id/orbit", adminApiLimiter, requireAdmin, missionControl.inspectUser);
router.post("/mission-control/sim/anti-gaming", adminApiLimiter, requireAdmin, missionControl.simAntiGaming);
router.post("/mission-control/preflight/run", adminApiLimiter, requireAdmin, missionControl.preflight);
router.get("/mission-control/push/tokens/:userId", adminApiLimiter, requireAdmin, missionControl.pushTokens);
router.post("/mission-control/push/test", adminApiLimiter, requireAdmin, missionControl.pushTest);

// Moderation
router.get("/reports", adminApiLimiter, requireAdmin, system.listReports);
router.post("/reports/:id/resolve", adminApiLimiter, requireAdmin, system.resolveReport);
router.get("/flags", adminApiLimiter, requireAdmin, system.listFlags);

// Season / system / storage
router.get("/seasons", adminApiLimiter, requireAdmin, system.listSeasons);
router.post("/system/recompute-dry-run", adminApiLimiter, requireAdmin, system.recomputeDryRun);
router.get("/system/storage-stats", adminApiLimiter, requireAdmin, system.storageStats);
router.get("/system/archive-status", adminApiLimiter, requireAdmin, system.archiveStatus);
router.post("/system/run-archive", adminApiLimiter, requireAdmin, system.runArchive);

// Exports
router.get("/export/users.csv", adminApiLimiter, requireAdmin, system.exportUsers);
router.get("/export/rank-events.csv", adminApiLimiter, requireAdmin, system.exportRankEvents);

// Anything else under the admin base → 404 (cloak).
router.use((req, res) => res.status(404).end());

module.exports = router;
