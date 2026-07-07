/**
 * economyConfig.js — the admin-editable overlay for Orbit economy constants.
 *
 * The pure math engine (services/orbitEngine.js) stays pure and unit-testable —
 * it never reads config. Instead the I/O layer (controllers, activity hook) reads
 * effective values THROUGH this bridge, which overlays any admin overrides
 * (services/configStore.js, namespace "economy") on top of the hard-coded JS
 * defaults. No override → the default, so an empty AppConfig collection is
 * exactly current behavior. Edits apply live (configStore hot-reloads).
 *
 * DEFAULTS mirror the shipped constants so the admin editor can show default vs
 * current, and clearing an override restores the original value.
 */
const configStore = require("./configStore");
const engine = require("./orbitEngine");
const { XP } = require("./orbitConfig");

const NS = "economy";

// Flat, admin-friendly default map (numbers only — the simple, safe-to-edit set).
// The milestone payout map is exposed separately (nested) below.
const DEFAULTS = Object.freeze({
    FREEZE_CAP:            engine.FREEZE_CAP,
    WEEKLY_FREEZE_GRANT:   engine.WEEKLY_FREEZE_GRANT,
    FREEZE_STARDUST_COST:  engine.FREEZE_STARDUST_COST,
    ACTIVE_DAY_STARDUST:   engine.ACTIVE_DAY_STARDUST,
    XP_SWAP:               XP.swap,
    XP_REVIEW:             XP.review,
    XP_MESSAGE:            XP.message,
    XP_MISSION:            XP.missionClaim,
    XP_MILESTONE:          XP.milestone,
});

/** Effective (override-or-default) value for one economy key. */
function value(key) {
    const v = configStore.get(NS, key);
    return v === undefined ? DEFAULTS[key] : v;
}

/** The full effective economy config (defaults overlaid with overrides). */
function all() {
    return configStore.resolveConfig(NS, DEFAULTS);
}

/** Admin list rows: key, default, current value, overridden flag. */
function list() {
    return configStore.list(NS, DEFAULTS);
}

module.exports = { NS, DEFAULTS, value, all, list };
