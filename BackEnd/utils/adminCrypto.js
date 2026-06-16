/**
 * adminCrypto.js — small crypto helpers for the admin portal.
 *
 * - encrypt/decrypt: AES-256-GCM for the TOTP secret at rest. The key is derived
 *   from ADMIN_TOTP_ENC_KEY via scrypt so any sufficiently-long passphrase works.
 * - signAdminToken/verifyAdminToken: short-lived JWTs for the admin session and
 *   the intermediate "TOTP pending" step, signed with ADMIN_JWT_SECRET (separate
 *   from the user JWT_SECRET so the two auth domains never overlap).
 * - constant-time string compare for slug/secret checks.
 */
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const ENC_ALGO = "aes-256-gcm";

function keyFromEnv() {
    const raw = process.env.ADMIN_TOTP_ENC_KEY;
    if (!raw) throw new Error("ADMIN_TOTP_ENC_KEY is not set");
    // Derive a stable 32-byte key from the configured secret.
    return crypto.scryptSync(raw, "skillswap-admin-totp", 32);
}

function encrypt(plaintext) {
    const key = keyFromEnv();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ENC_ALGO, key, iv);
    const enc = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    // iv.tag.ciphertext — all base64
    return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

function decrypt(payload) {
    const key = keyFromEnv();
    const [ivB64, tagB64, dataB64] = String(payload).split(".");
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const data = Buffer.from(dataB64, "base64");
    const decipher = crypto.createDecipheriv(ENC_ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

function adminJwtSecret() {
    const s = process.env.ADMIN_JWT_SECRET;
    if (!s) throw new Error("ADMIN_JWT_SECRET is not set");
    return s;
}

// purpose: "session" (full admin session) | "totp_pending" (after password, before TOTP)
function signAdminToken(payload, { expiresIn }) {
    return jwt.sign(payload, adminJwtSecret(), { expiresIn });
}

function verifyAdminToken(token) {
    return jwt.verify(token, adminJwtSecret());
}

function timingSafeEqual(a, b) {
    const ab = Buffer.from(String(a));
    const bb = Buffer.from(String(b));
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
}

// A random URL-safe CSRF token.
function randomToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString("base64url");
}

module.exports = {
    encrypt, decrypt, signAdminToken, verifyAdminToken, timingSafeEqual, randomToken,
};
