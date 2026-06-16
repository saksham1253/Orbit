/**
 * adminAudit.js — single helper for writing the append-only AuditLog. Best-effort
 * (never throws into the request path) but failures are logged to the server.
 */
const AuditLog = require("../models/AuditLog");

function clientIp(req) {
    return (
        (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
        req.ip ||
        req.connection?.remoteAddress ||
        ""
    );
}

/**
 * @param {object} req  express request (for ip/userAgent)
 * @param {object} entry { actorId, actorEmail, action, targetType, targetId,
 *                         reason, before, after, success }
 */
async function audit(req, entry) {
    try {
        await AuditLog.create({
            ip: clientIp(req),
            userAgent: req.headers["user-agent"] || "",
            success: entry.success !== false,
            ...entry,
        });
    } catch (err) {
        console.error("[audit] failed to write audit log:", err.message);
    }
}

module.exports = { audit, clientIp };
