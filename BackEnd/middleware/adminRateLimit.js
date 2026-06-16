const rateLimit = require("express-rate-limit");

/**
 * Strict limiter for admin auth endpoints (login / TOTP verify). Independent of
 * the public authLimiter. On trip, returns a *404* (like everything else in the
 * portal) so probing reveals nothing. Per-account lockout/backoff is enforced
 * separately in the auth controller via admin.failedAttempts/lockoutUntil.
 */
exports.adminAuthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,   // 15 minutes
    max: 8,                     // 8 attempts / 15 min / IP
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => res.status(404).end(),
});

/** Looser limiter for authenticated admin data endpoints. */
exports.adminApiLimiter = rateLimit({
    windowMs: 60 * 1000,        // 1 minute
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => res.status(404).end(),
});
