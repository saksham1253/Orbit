/**
 * adminAuth.js — server-side RBAC for every admin API request.
 *
 * Security posture: ANY failure returns a plain 404 (never 401/403) so the admin
 * surface is indistinguishable from a non-existent route. The admin session is a
 * short-lived JWT in an HttpOnly/Secure/SameSite=Strict cookie (`ssctl_sid`),
 * fully separate from the user JWT. State-changing requests additionally require
 * a matching CSRF token (double-submit: cookie `ssctl_csrf` === header
 * `x-ssctl-csrf`).
 */
const User = require("../models/user");
const { verifyAdminToken } = require("../utils/adminCrypto");

const SESSION_COOKIE = "ssctl_sid";
const CSRF_COOKIE = "ssctl_csrf";

// Minimal dependency-free cookie parser (avoids adding cookie-parser).
function parseCookies(req) {
    const header = req.headers.cookie;
    const out = {};
    if (!header) return out;
    header.split(";").forEach((part) => {
        const idx = part.indexOf("=");
        if (idx === -1) return;
        const k = part.slice(0, idx).trim();
        const v = part.slice(idx + 1).trim();
        if (k) out[k] = decodeURIComponent(v);
    });
    return out;
}

const notFound = (res) => res.status(404).end();

/**
 * requireAdmin — gate for all authenticated admin endpoints.
 * On success sets req.adminUser (the full user doc) and req.adminCookies.
 */
async function requireAdmin(req, res, next) {
    try {
        const cookies = parseCookies(req);
        req.adminCookies = cookies;

        const token = cookies[SESSION_COOKIE];
        if (!token) return notFound(res);

        let decoded;
        try {
            decoded = verifyAdminToken(token);
        } catch {
            return notFound(res);
        }
        if (!decoded || decoded.purpose !== "session" || !decoded.sub) return notFound(res);

        const user = await User.findById(decoded.sub).select("+admin");
        if (!user) return notFound(res);
        if (user.role !== "admin") return notFound(res);
        if (user.status !== "active") return notFound(res);
        // tokenVersion mismatch → session was revoked ("log out everywhere").
        if ((user.admin?.tokenVersion || 0) !== (decoded.tv || 0)) return notFound(res);

        // CSRF double-submit on state-changing verbs.
        if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
            const csrfCookie = cookies[CSRF_COOKIE];
            const csrfHeader = req.headers["x-ssctl-csrf"];
            if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) return notFound(res);
        }

        req.adminUser = user;
        next();
    } catch (err) {
        console.error("[adminAuth] error:", err.message);
        return notFound(res);
    }
}

/** requireRole — further restrict an endpoint to specific roles (admin always allowed). */
function requireRole(...roles) {
    return (req, res, next) => {
        const r = req.adminUser?.role;
        if (r === "admin" || roles.includes(r)) return next();
        return notFound(res);
    };
}

module.exports = { requireAdmin, requireRole, parseCookies, SESSION_COOKIE, CSRF_COOKIE };
