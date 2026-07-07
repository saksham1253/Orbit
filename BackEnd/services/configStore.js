/**
 * configStore.js — runtime config store for namespaced gameplay/economy values,
 * backing the admin Economy / Progression / Store config editors.
 *
 * Same proven shape as services/flagStore.js: overrides live in Mongo (AppConfig)
 * and are cached IN-MEMORY so hot-path gameplay reads stay synchronous; a periodic
 * refresh + immediate write-through make edits apply without a redeploy (instantly
 * on the writing instance, within one refresh interval across replicas).
 *
 * The hard-coded JS constants remain the DEFAULTS. A module exposes its defaults
 * to admin by reading them through `resolveConfig(namespace, DEFAULTS)`, which
 * overlays any stored overrides on top. A missing override → the JS default, so
 * an empty collection == current behavior and nothing crashes on a missing key.
 */

const AppConfig = require("../models/AppConfig");

// namespace -> { key -> value }. Seeded empty; filled by refresh().
const cache = new Map();

function _group(namespace) {
    if (!cache.has(namespace)) cache.set(namespace, {});
    return cache.get(namespace);
}

/** Sync read of a single override (or undefined if not set). Hot-path safe. */
function get(namespace, key) {
    const g = cache.get(namespace);
    return g ? g[key] : undefined;
}

/** Sync read of a whole namespace's overrides as a plain object (may be empty). */
function getGroup(namespace) {
    return { ...(cache.get(namespace) || {}) };
}

/**
 * Overlay stored overrides for `namespace` on top of a JS `defaults` object and
 * return the effective config. Only keys present in `defaults` are honored, so a
 * stale/unknown override can never inject a surprise key into gameplay. This is
 * the function hard-coded modules call to become admin-editable.
 */
function resolveConfig(namespace, defaults) {
    const overrides = cache.get(namespace) || {};
    const out = Array.isArray(defaults) ? [...defaults] : { ...defaults };
    for (const k of Object.keys(defaults)) {
        if (Object.prototype.hasOwnProperty.call(overrides, k) && overrides[k] !== undefined) {
            out[k] = overrides[k];
        }
    }
    return out;
}

/** Refresh the whole cache from Mongo. Best-effort — keep the old cache on error. */
async function refresh() {
    try {
        const rows = await AppConfig.find().lean();
        const next = new Map();
        for (const r of rows) {
            if (!next.has(r.namespace)) next.set(r.namespace, {});
            next.get(r.namespace)[r.key] = r.value;
        }
        cache.clear();
        for (const [ns, g] of next) cache.set(ns, g);
    } catch (_) { /* keep previous cache */ }
}

/** Validate-lite + persist one override, and write through the cache immediately. */
async function set(namespace, key, value, updatedBy = "") {
    if (!namespace || !key) throw new Error("namespace and key are required");
    if (value === undefined) throw new Error("value is required (use clear() to remove)");
    await AppConfig.findOneAndUpdate(
        { namespace, key },
        { namespace, key, value, updatedBy },
        { upsert: true }
    );
    _group(namespace)[key] = value;
    return { namespace, key, value };
}

/** Remove an override (restore the JS default) and evict it from cache. */
async function clear(namespace, key) {
    await AppConfig.deleteOne({ namespace, key });
    const g = cache.get(namespace);
    if (g) delete g[key];
    return { namespace, key, cleared: true };
}

/**
 * Admin list view for a namespace: merge the module's DEFAULTS with any overrides
 * so the editor shows current value, default, and whether it's overridden.
 */
function list(namespace, defaults = {}) {
    const overrides = cache.get(namespace) || {};
    return Object.keys(defaults).map((key) => ({
        namespace,
        key,
        default: defaults[key],
        value: Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : defaults[key],
        overridden: Object.prototype.hasOwnProperty.call(overrides, key),
    }));
}

let timer = null;
/** Call once after DB connect. Loads overrides, then refreshes every `ms`. */
function startAutoRefresh(ms = 15000) {
    refresh();
    if (timer) clearInterval(timer);
    timer = setInterval(refresh, ms);
    if (timer.unref) timer.unref();
}

module.exports = { get, getGroup, resolveConfig, set, clear, list, refresh, startAutoRefresh };
