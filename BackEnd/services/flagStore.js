/**
 * flagStore.js — runtime config store backing the Flag Cockpit (Mission Control
 * C1). Flags live in Mongo (FeatureFlag) and are cached IN-MEMORY so hot-path
 * reads stay synchronous; a periodic refresh + immediate write-through make
 * flips apply without a redeploy (within one refresh interval across replicas,
 * instantly on the writing instance). Env values are the DEFAULTS, so a missing
 * key never crashes a request and an empty collection == current behavior.
 */

const FeatureFlag = require("../models/FeatureFlag");

const int = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
const bool = (v, d) => (v == null ? d : String(v).toLowerCase() !== "false");
const clampPct = (n) => Math.max(0, Math.min(100, int(n, 0)));

// The flags the cockpit manages, with type + env-derived default + description.
const REGISTRY = Object.freeze({
    ORBIT_TIER1:            { type: "bool", def: bool(process.env.ORBIT_TIER1, true),  description: "Tier 1: streak / missions / Photons" },
    ORBIT_TIER2:            { type: "bool", def: bool(process.env.ORBIT_TIER2, true),  description: "Tier 2: Binary Star + Leagues" },
    ORBIT_TIER3:            { type: "bool", def: bool(process.env.ORBIT_TIER3, true),  description: "Tier 3: cosmetics / mastery / ritual" },
    ORBIT_TIER2_PCT:        { type: "pct",  def: clampPct(process.env.ORBIT_TIER2_PCT ?? 100), description: "Tier 2 rollout %" },
    ORBIT_TIER3_PCT:        { type: "pct",  def: clampPct(process.env.ORBIT_TIER3_PCT ?? 100), description: "Tier 3 rollout %" },
    ORBIT_DECAY_REMINDERS:  { type: "bool", def: bool(process.env.ORBIT_DECAY_REMINDERS, true), description: "Send daily decay reminders" },
    ORBIT_MSG_QUALITY_GATE: { type: "bool", def: bool(process.env.ORBIT_MSG_QUALITY_GATE, true), description: "Ignore empty/low-quality messages for credit" },
    ORBIT_MSG_XP_CAP:       { type: "int",  def: int(process.env.ORBIT_MSG_XP_CAP, 3), description: "Distinct-partner messages/day earning full XP" },
});

function coerce(value, type) {
    if (type === "bool") return value === true || String(value).toLowerCase() === "true";
    if (type === "pct")  return clampPct(value);
    return int(value, 0);
}

// In-memory cache, seeded with defaults so reads work before the first refresh.
const cache = {};
for (const [k, meta] of Object.entries(REGISTRY)) cache[k] = meta.def;

/** Sync read (hot path). Returns the cached override or the env default. */
function get(key) {
    return cache[key] !== undefined ? cache[key] : (REGISTRY[key] && REGISTRY[key].def);
}

/** Refresh the cache from Mongo. Best-effort — keeps the old cache on error. */
async function refresh() {
    try {
        const rows = await FeatureFlag.find().lean();
        const next = {};
        for (const [k, meta] of Object.entries(REGISTRY)) next[k] = meta.def;      // reset to defaults
        for (const r of rows) if (REGISTRY[r.key]) next[r.key] = coerce(r.value, REGISTRY[r.key].type);
        Object.assign(cache, next);
    } catch (_) { /* keep previous cache */ }
}

/** Validate + persist an override, and write through the cache immediately. */
async function set(key, value, updatedBy = "") {
    const meta = REGISTRY[key];
    if (!meta) throw new Error(`unknown flag: ${key}`);
    const coerced = coerce(value, meta.type);
    if (meta.type === "bool" && typeof coerced !== "boolean") throw new Error("value must be boolean");
    await FeatureFlag.findOneAndUpdate({ key }, { key, value: coerced, type: meta.type, updatedBy }, { upsert: true });
    cache[key] = coerced;
    return { key, value: coerced, type: meta.type };
}

/** Full cockpit view: every managed flag with current value + default + meta. */
async function list() {
    let rows = [];
    try { rows = await FeatureFlag.find().lean(); } catch (_) { /* defaults only */ }
    const byKey = new Map(rows.map((r) => [r.key, r]));
    return Object.entries(REGISTRY).map(([key, meta]) => ({
        key, type: meta.type, description: meta.description,
        default: meta.def, value: get(key),
        overridden: byKey.has(key),
        updatedBy: byKey.get(key)?.updatedBy || null,
        updatedAt: byKey.get(key)?.updatedAt || null,
    }));
}

let timer = null;
/** Call once after DB connect. Loads flags, then refreshes every `ms`. */
function startAutoRefresh(ms = 15000) {
    refresh();
    if (timer) clearInterval(timer);
    timer = setInterval(refresh, ms);
    if (timer.unref) timer.unref();
}

module.exports = { REGISTRY, get, set, list, refresh, startAutoRefresh, coerce };
