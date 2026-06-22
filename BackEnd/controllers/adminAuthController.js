/**
 * adminAuthController.js — hardened admin authentication.
 *
 * Flow:  login(email+password) → [enroll-totp on first login] → verify-totp
 *        → full admin session.  Every step is rate-limited (IP) + per-account
 *        locked-out (failedAttempts/lockoutUntil with exponential backoff) and
 *        written to the append-only AuditLog. Generic errors never reveal which
 *        field was wrong.
 *
 * Cookies:
 *   ssctl_pending — short-lived, HttpOnly: between password and TOTP.
 *   ssctl_sid     — admin session, HttpOnly: full access.
 *   ssctl_csrf    — readable by JS: double-submit CSRF token.
 */
const bcrypt = require("bcrypt");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const User = require("../models/user");
const { audit } = require("../utils/adminAudit");
const {
    encrypt, decrypt, signAdminToken, verifyAdminToken, randomToken,
} = require("../utils/adminCrypto");
const { SESSION_COOKIE, CSRF_COOKIE } = require("../middleware/adminAuth");

const PENDING_COOKIE = "ssctl_pending";
const PROD = process.env.NODE_ENV === "production";
const SESSION_TTL_MIN = 30;        // absolute admin-session lifetime
const PENDING_TTL_MIN = 10;        // time allowed to complete TOTP
const LOCKOUT_THRESHOLD = 5;       // failed attempts before lockout kicks in
const LOCKOUT_MAX_MIN = 60;        // cap backoff at 1h

// SameSite policy. Default "strict" (combined-origin deploy). Split deployments
// (frontend and backend on different domains, e.g. Vercel + Render) MUST set
// ADMIN_COOKIE_SAMESITE=none, which forces Secure. The double-submit CSRF token
// remains the active CSRF defense regardless of this value.
const SAMESITE = (process.env.ADMIN_COOKIE_SAMESITE || "strict").toLowerCase();
const SECURE = PROD || SAMESITE === "none";

const baseCookie = { httpOnly: true, secure: SECURE, sameSite: SAMESITE, path: "/" };
const csrfCookieOpts = { httpOnly: false, secure: SECURE, sameSite: SAMESITE, path: "/" };

function setPending(res, token) {
    res.cookie(PENDING_COOKIE, token, { ...baseCookie, maxAge: PENDING_TTL_MIN * 60 * 1000 });
}
function clearPending(res) { res.clearCookie(PENDING_COOKIE, { ...baseCookie }); }

function issueSession(res, user) {
    const token = signAdminToken(
        { sub: String(user._id), tv: user.admin?.tokenVersion || 0, purpose: "session" },
        { expiresIn: `${SESSION_TTL_MIN}m` }
    );
    res.cookie(SESSION_COOKIE, token, { ...baseCookie, maxAge: SESSION_TTL_MIN * 60 * 1000 });
    const csrf = randomToken();
    res.cookie(CSRF_COOKIE, csrf, { ...csrfCookieOpts, maxAge: SESSION_TTL_MIN * 60 * 1000 });
    return csrf;
}

function clearAll(res) {
    res.clearCookie(SESSION_COOKIE, { ...baseCookie });
    res.clearCookie(CSRF_COOKIE, { ...csrfCookieOpts });
    clearPending(res);
}

const generic = (res) => res.status(401).json({ message: "Invalid credentials." });

// ── Step 1: email + password ───────────────────────────────────────────────
exports.login = async (req, res) => {
    const email = (req.body?.email || "").toLowerCase().trim();
    const password = req.body?.password || "";
    try {
        const user = await User.findOne({ email }).select("+admin");
        // Uniform handling whether or not the account exists / is admin.
        if (!user || user.role !== "admin" || !user.admin?.passwordHash || user.status !== "active") {
            await audit(req, { actorEmail: email, action: "auth.login.fail", success: false, reason: "no-admin" });
            return generic(res);
        }

        // Per-account lockout.
        if (user.admin.lockoutUntil && user.admin.lockoutUntil > new Date()) {
            await audit(req, { actorId: user._id, actorEmail: email, action: "auth.login.locked", success: false });
            return res.status(429).json({ message: "Temporarily locked. Try again later." });
        }

        const ok = await bcrypt.compare(password, user.admin.passwordHash);
        if (!ok) {
            const attempts = (user.admin.failedAttempts || 0) + 1;
            const update = { "admin.failedAttempts": attempts };
            if (attempts >= LOCKOUT_THRESHOLD) {
                const backoffMin = Math.min(LOCKOUT_MAX_MIN, 2 ** (attempts - LOCKOUT_THRESHOLD));
                update["admin.lockoutUntil"] = new Date(Date.now() + backoffMin * 60 * 1000);
            }
            await User.updateOne({ _id: user._id }, { $set: update });
            await audit(req, { actorId: user._id, actorEmail: email, action: "auth.login.fail", success: false, reason: "bad-password" });
            return generic(res);
        }

        // Password OK → reset counters, issue a short-lived pending token.
        await User.updateOne({ _id: user._id }, { $set: { "admin.failedAttempts": 0, "admin.lockoutUntil": null } });
        const needsEnroll = !user.admin.totpEnabled;
        const pending = signAdminToken(
            { sub: String(user._id), tv: user.admin.tokenVersion || 0, purpose: "totp_pending", enroll: needsEnroll },
            { expiresIn: `${PENDING_TTL_MIN}m` }
        );
        setPending(res, pending);
        await audit(req, { actorId: user._id, actorEmail: email, action: "auth.login.password_ok", success: true });
        return res.json({ step: needsEnroll ? "enroll_totp" : "verify_totp" });
    } catch (err) {
        console.error("[admin login]", err.message);
        return generic(res);
    }
};

// Resolve and validate the pending cookie → returns the user or null.
async function loadPending(req) {
    const cookies = require("../middleware/adminAuth").parseCookies(req);
    const token = cookies[PENDING_COOKIE];
    if (!token) return null;
    let decoded;
    try { decoded = verifyAdminToken(token); } catch { return null; }
    if (!decoded || decoded.purpose !== "totp_pending") return null;
    const user = await User.findById(decoded.sub).select("+admin");
    if (!user || user.role !== "admin" || user.status !== "active") return null;
    if ((user.admin?.tokenVersion || 0) !== (decoded.tv || 0)) return null;
    return { user, decoded };
}

// ── Step 2a: enrol TOTP (first login only) ─────────────────────────────────
exports.enrollTotp = async (req, res) => {
    const p = await loadPending(req);
    if (!p) return res.status(404).end();
    const { user } = p;
    if (user.admin.totpEnabled) return res.status(400).json({ message: "Already enrolled." });
    try {
        const secret = speakeasy.generateSecret({ name: `Orbit Admin (${user.email})`, length: 20 });
        // Store the secret encrypted but NOT yet enabled — enabled only after the
        // first valid code is verified.
        await User.updateOne({ _id: user._id }, { $set: { "admin.totpSecretEnc": encrypt(secret.base32) } });
        const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);
        await audit(req, { actorId: user._id, actorEmail: user.email, action: "auth.totp.enroll_started", success: true });
        return res.json({ qr: qrDataUrl, otpauthUrl: secret.otpauth_url });
    } catch (err) {
        console.error("[admin enrollTotp]", err.message);
        return res.status(500).json({ message: "Enrolment failed." });
    }
};

function generateBackupCodes(n = 8) {
    const codes = [];
    for (let i = 0; i < n; i++) codes.push(randomToken(5).slice(0, 10).toUpperCase());
    return codes;
}

// ── Step 2b: verify TOTP → issue full session ──────────────────────────────
exports.verifyTotp = async (req, res) => {
    const p = await loadPending(req);
    if (!p) return res.status(404).end();
    const { user } = p;
    const code = (req.body?.code || "").replace(/\s/g, "");
    try {
        const secretEnc = user.admin.totpSecretEnc;
        if (!secretEnc) return res.status(400).json({ message: "No TOTP secret." });
        const secret = decrypt(secretEnc);
        const valid = speakeasy.totp.verify({ secret, encoding: "base32", token: code, window: 1 });

        if (!valid) {
            // TOTP failures also count toward lockout.
            const attempts = (user.admin.failedAttempts || 0) + 1;
            const update = { "admin.failedAttempts": attempts };
            if (attempts >= LOCKOUT_THRESHOLD) {
                const backoffMin = Math.min(LOCKOUT_MAX_MIN, 2 ** (attempts - LOCKOUT_THRESHOLD));
                update["admin.lockoutUntil"] = new Date(Date.now() + backoffMin * 60 * 1000);
            }
            await User.updateOne({ _id: user._id }, { $set: update });
            await audit(req, { actorId: user._id, actorEmail: user.email, action: "auth.totp.fail", success: false });
            return res.status(401).json({ message: "Invalid code." });
        }

        // First-time enrolment → enable TOTP + mint backup codes (shown once).
        let backupCodes = null;
        const set = {
            "admin.failedAttempts": 0,
            "admin.lockoutUntil": null,
            "admin.lastAdminLoginAt": new Date(),
        };
        if (!user.admin.totpEnabled) {
            set["admin.totpEnabled"] = true;
            backupCodes = generateBackupCodes();
            set["admin.backupCodeHashes"] = await Promise.all(backupCodes.map((c) => bcrypt.hash(c, 10)));
        }
        await User.updateOne({ _id: user._id }, { $set: set });
        // Reload tokenVersion for the session token.
        const fresh = await User.findById(user._id).select("+admin");
        const csrf = issueSession(res, fresh);
        clearPending(res);
        await audit(req, { actorId: user._id, actorEmail: user.email, action: "auth.login.success", success: true });
        return res.json({
            ok: true,
            csrfToken: csrf,
            admin: { id: fresh._id, name: fresh.name, email: fresh.email, role: fresh.role },
            backupCodes, // non-null only on first enrolment; client must show once
        });
    } catch (err) {
        console.error("[admin verifyTotp]", err.message);
        return res.status(500).json({ message: "Verification failed." });
    }
};

// ── Session helpers ────────────────────────────────────────────────────────
exports.me = async (req, res) => {
    const u = req.adminUser;
    // Refresh CSRF token alongside identity.
    const csrf = req.adminCookies?.[CSRF_COOKIE] || randomToken();
    if (!req.adminCookies?.[CSRF_COOKIE]) {
        res.cookie(CSRF_COOKIE, csrf, { ...csrfCookieOpts });
    }
    return res.json({
        admin: { id: u._id, name: u.name, email: u.email, role: u.role, lastAdminLoginAt: u.admin?.lastAdminLoginAt },
        csrfToken: csrf,
    });
};

exports.logout = async (req, res) => {
    clearAll(res);
    if (req.adminUser) {
        await audit(req, { actorId: req.adminUser._id, actorEmail: req.adminUser.email, action: "auth.logout", success: true });
    }
    return res.json({ ok: true });
};

// "Log out everywhere" — bump tokenVersion, invalidating all admin sessions.
exports.revokeAll = async (req, res) => {
    const u = req.adminUser;
    await User.updateOne({ _id: u._id }, { $inc: { "admin.tokenVersion": 1 } });
    clearAll(res);
    await audit(req, { actorId: u._id, actorEmail: u.email, action: "auth.revoke_all", success: true });
    return res.json({ ok: true });
};
