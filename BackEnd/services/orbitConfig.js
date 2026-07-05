/**
 * orbitConfig.js — single source of truth for tunable Orbit Engine constants
 * (Gravity & Glow refinement). Values are env-overridable so weights/caps can be
 * tuned per deploy without a code change (Part 2), read once at boot.
 *
 * Guiding philosophy: reward mastery & genuine connection, never raw activity.
 * Cheap, spammable actions (messages) are deliberately capped so completed swaps
 * and reviews dominate the climb.
 */

const int = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
const bool = (v, d) => (v == null ? d : String(v).toLowerCase() !== "false");

// ── Weekly League / streak XP weights (Part 2) ──────────────────────────────
// Completed swaps, missions and milestones are the EFFICIENT climb path;
// reviews contribute moderately; messages contribute marginally and are capped
// (see MSG below) so no amount of messaging alone can promote.
const XP = Object.freeze({
    swap:        int(process.env.ORBIT_XP_SWAP, 30),
    review:      int(process.env.ORBIT_XP_REVIEW, 15),   // metric key "rating"
    message:     int(process.env.ORBIT_XP_MESSAGE, 5),
    missionClaim:int(process.env.ORBIT_XP_MISSION, 40),
    milestone:   int(process.env.ORBIT_XP_MILESTONE, 50),
});

// ── Message anti-gaming (Part 1) ─────────────────────────────────────────────
const MSG = Object.freeze({
    // Distinct-partner messages/day that earn FULL XP; beyond this, XP tapers to 0.
    dailyXpCap:  int(process.env.ORBIT_MSG_XP_CAP, 3),
    // Hard weekly XP ceiling from the message source (belt-and-suspenders so a
    // single low-value source can never dominate a week — Part 2).
    weeklyXpCap: int(process.env.ORBIT_XP_WEEKLY_CAP_MESSAGE, 60),
    // Ignore empty / sub-threshold messages for credit when enabled.
    qualityGate: bool(process.env.ORBIT_MSG_QUALITY_GATE, true),
    minLength:   int(process.env.ORBIT_MSG_MIN_LEN, 2),
});

// ── Streak graduation phases (Part 3) ────────────────────────────────────────
// After ~30d the behavior is automatic; after ~60d we shift from daily pressure
// to permanent pride. Thresholds align with existing milestones (30 / 60).
const PHASES = Object.freeze({
    formationMax:   int(process.env.ORBIT_PHASE_FORMATION_MAX, 29),   // 0–29  → formation
    consistencyMax: int(process.env.ORBIT_PHASE_CONSISTENCY_MAX, 59), // 30–59 → consistency, 60+ → graduation
});

module.exports = { XP, MSG, PHASES };
