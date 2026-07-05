/**
 * notificationCopy.test.js — ethics guardrail (Part 4).
 *
 * Scans every source file that emits user-facing Orbit notifications and asserts
 * none contain "confirmshaming" / guilt-based dark-pattern phrases. Motivation
 * must come from support and pride, never anxiety. Extend BANNED as needed; this
 * test fails the build if shaming copy is ever introduced.
 */
const fs = require("fs");
const path = require("path");

// Files that build notification titles/bodies.
const SOURCES = [
    "services/orbitActivity.js",
    "services/constellationActivity.js",
    "services/masteryActivity.js",
    "controllers/constellationController.js",
    "workers/orbitWorker.js",
    "workers/leagueWorker.js",
].map((p) => path.join(__dirname, "..", p));

// Forbidden guilt/shame patterns (case-insensitive).
const BANNED = [
    /let(?:ting)?\s+(?:your\s+)?(?:partner|friend|team|them)\s+down/i,
    /don'?t\s+(?:you\s+)?(?:want\s+to\s+)?(?:let|quit|give\s+up)/i,
    /winners?\s+don'?t\s+quit/i,
    /you\s+(?:lost|ruined|wasted|destroyed)\s+(?:everything|it\s+all)/i,
    /\bdisappoint(?:ed|ing|ment)?\b/i,
    /\bshame(?:ful)?\b/i,
    /you'?ll\s+regret/i,
    /you\s+failed/i,
];

describe("notification copy — no confirmshaming (Part 4)", () => {
    for (const file of SOURCES) {
        it(`${path.basename(file)} contains no guilt/shame phrases`, () => {
            const src = fs.readFileSync(file, "utf8");
            // Only inspect string literals that look like user copy (title/body lines)
            // — but scanning the whole file is a safe superset.
            for (const rx of BANNED) {
                const hit = src.match(rx);
                expect(hit ? `${path.basename(file)} → "${hit[0]}"` : null).toBeNull();
            }
        });
    }
});
