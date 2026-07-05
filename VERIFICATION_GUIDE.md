# Orbit — Feature Verification Guide (every tier at once)

All engagement UI lives on one page: **`/orbit`** (navbar → "Orbit"). It stacks, top to bottom:
streak-ring hero → Photons wallet + Gravity Assist → Signal legend → Missions → League →
Constellations → Photon shop → milestone ladder. The **navbar** shows a live streak flame,
and the **dashboard** (`/dashboard`, MySkills) shows a compact Orbit widget. Skill cards show a
**Mastery** bar.

## How anything gets "earned" (the 3 triggers)
Every engine is driven by three real actions, each of which calls `recordOrbitAction`:
- **Complete a swap** — Connections page → "Mark completed" (credits BOTH partners).
- **Message a partner** — chat/DM.
- **Leave a review** — after a call / on a partner (rating).

So the fastest way to light up everything: with **two accounts A & B**, connect, exchange a
couple of messages, complete a swap, and leave reviews. Refresh `/orbit`.

> Time-based things (multi-day streaks, milestones ≥7d, graduation ≥60d, weekly league rollover)
> can't be seen in one sitting from the UI alone — to verify those now, seed the Mongo doc
> (`db.users.updateOne({_id}, {$set:{"orbit.streak.current":60,"orbit.streak.longest":90,...}})`)
> or wait. Everything else is visible immediately after an action.

---

# TIER 1 — Streak · Gravity Assist · Missions · Photons

### 1. Orbit Streak
- **What:** a day-count that advances once per **UTC day** you take a real action (not app-opens).
- **Where:** hero ring on `/orbit`; flame badge in navbar; widget on `/dashboard`.
- **Works:** first action → streak = 1. Next UTC day's action → +1. Milestones at **3/7/14/30/60/100** pay Photons once each. `longest` is kept forever.
- **Verify:** do any trigger → `/orbit` shows "1 day orbit", state "Orbit stable". `GET /api/orbit/me` → `streak.current:1, state:"active"`. Repeat actions same day → still 1 (idempotent).

### 2. Gravity Assist (streak freeze)
- **What:** mercy token that auto-bridges a missed day so a long streak survives.
- **Where:** "Gravity Assist" card on `/orbit` (`tokens/cap`, "+1 · 200 ✨" buy button).
- **Works:** **1 free token granted per ISO week** (lazily, on read/action). If you miss day(s) and have enough tokens, the streak survives and a "🛡️ Gravity Assist engaged" notice fires; else it resets to 1 (tokens never wasted). Buyable for **200 Photons**.
- **Verify:** new week → open `/orbit` → tokens = 1. Buy with ≥200 Photons → tokens +1, Photons −200. (Bridge behavior needs a seeded gap: set `lastActionDay` to 2 days ago with a token, then act → streak survives.)

### 3. Weekly Missions
- **What:** 3 rotating goals, claimable for Photons.
- **Where:** "Weekly Missions" panel on `/orbit`.
- **Works:** the 3 missions are picked **deterministically from the ISO week id** (same for everyone that week, reset Monday). Progress fills as you act; when complete, the **Claim** button pays Photons (`POST /orbit/missions/:key/claim`) + weekly League XP.
- **Verify:** act toward a mission (e.g. "message N partners") → progress bar moves; at target → Claim enabled → tap → "+N Photons claimed ✨", wallet rises. Re-claim blocked.

### 4. Photons (currency)  *(renamed from "Stardust" — B0)*
- **What:** cosmetic soft-currency; earned from milestones/missions/active days, spent on freezes + cosmetics. Never affects ranking.
- **Where:** "Photons" wallet on `/orbit`; also in the shop header and dashboard widget.
- **Works:** stored server-side as `orbit.stardust` (no DB migration); the API emits **both** `photons` and `stardust` for one release; UI reads `photons ?? stardust`. The league **tier** named "Stardust" is untouched.
- **Verify:** `GET /api/orbit/me` → `photons` and `stardust` present and equal. UI everywhere says "Photons ✨". Leaderboard's "Stardust" tier still shows its own name.

---

# TIER 2 — Constellations (co-op) · Weekly Leagues

### 5. Constellations (Binary Star co-op streak)
- **What:** two connected partners share a streak that only advances when **both** act the same UTC day.
- **Where:** "Constellations" panel on `/orbit` — "Pair up" picker, incoming/outgoing invites, active binary-star cards.
- **Works:** invite a connected partner (`POST /orbit/constellations/invite`) → they Accept → active. Each day both act → shared streak +1. If only one acts, the other gets a gentle **"It's your turn to shine ✨"** nudge. Shared milestones (Binary Ignition 3 → Eternal Binary 100) pay **both** Photons. Pair has its **own** weekly Gravity Assist. Dissolve is guilt-free.
- **Verify (2 accounts):** A opens `/orbit` → Pair up → invite B. B sees invite → Accept. Both act same day → both panels show shared streak = 1. Only A acts a day → B gets the "your turn" notification.

### 6. Weekly Leagues (promotion / relegation)
- **What:** a weekly XP race inside a ~30-person group; top promote, bottom relegate up a cosmic ladder.
- **Where:** "Weekly League" panel on `/orbit` (division badge, standings, promote/relegate zones, reset countdown).
- **Works:** fresh **Orbit XP** each ISO week — **swap +30, review +15, message +5 (capped), mission +40, milestone +50** (weights in `orbitConfig.js`). Groups seeded by CosmicScore similarity. Monday **rollover worker** ranks each group → **top 5 promote / bottom 5 relegate**, resets XP, re-seeds groups. Divisions: **Asteroid Belt → Comet Run → Nebula → Star Cluster → Galaxy → Supercluster**.
- **Verify:** act → `GET /api/orbit/league` shows your division + your XP rising + your rank; standings list with green "promote" top rows / red "relegate" bottom. (Promotion itself needs the Monday rollover or a manual worker run.)

---

# TIER 3 — Cosmetics shop · Skill Mastery · Post-session ritual

### 7. Photon Cosmetics Shop
- **What:** spend Photons on name-glows + nebula profile backgrounds (cosmetic only, no pay-to-win).
- **Where:** "Photon Shop" panel on `/orbit`.
- **Works:** `GET /orbit/shop` lists catalog with owned/equipped/affordable; **Buy** (`/orbit/shop/buy`) deducts Photons; **Equip/Unequip** (`/orbit/shop/equip`) sets the active name-glow/background, which then render on your profile/name.
- **Verify:** with enough Photons → Buy a glow → toast "Purchased — N Photons spent ✨", wallet drops, card shows Equip → tap → your name renders with the glow.

### 8. Skill Mastery paths
- **What:** each skill you teach climbs a mastery ladder → a named teaching badge.
- **Where:** progress bar on each **skill card** (`/dashboard`, `/browse`, public profile).
- **Works:** completing a swap increments the taught skill's `sessionsTaught`; tiers **Initiate 1 · Apprentice 3 · Mentor 10 · Master 25 · Grandmaster 50** → badge like **"Guitar Mentor"** + a one-time Photon award + notification.
- **Verify:** complete a swap for one of your offered skills → that skill's card shows a mastery bar ("1 taught → Apprentice"), and you get a "🎓 … Mentor" notification at each threshold.

### 9. Post-session ritual + shareable card
- **What:** after a call, a reflection prompt + a shareable "session card".
- **Where:** the rating modal after a video call (`RatingModal`).
- **Works:** the modal adds "one thing you learned"; on submit it can generate a session-card PNG shared via the same robust `shareOrDownload` util (native share → download+copy).
- **Verify:** finish a call → modal → fill rating + learned → Share → native sheet (mobile/APK) or download+copy toast (desktop).

---

# Refinements you can check directly

- **B1 Anti-gaming:** send 20 messages to the **same** partner in one day → streak advances at most 1 day, XP capped. Message 5 **different** partners → first 3 give XP, rest give streak-credit but 0 XP. (`ORBIT_MSG_XP_CAP=3`, weekly message XP cap 60.)
- **B3 Graduation:** seed `streak.current`/`longest` ≥60 → `/orbit` shows a **"Fixed Star"** badge, countdown de-emphasised; a single miss keeps the badge (pride, not loss). `GET /orbit/me` → `streak.phase:"graduation", graduated:true`.
- **B4 Ethics:** decay reminder toggle in Orbit prefs (`POST /orbit/prefs {decayReminders:false}`) silences reminders; `npx jest tests/notificationCopy.test.js` passes (no shame phrases).
- **B6 Signal clarity:** the "Your progress" legend on `/orbit` distinguishes **Photons / CosmicScore / Orbit XP** with distinct icon+colour+one-liner.
- **B8 Flags:** set `ORBIT_TIER2=false` → League + Constellations panels vanish; `ORBIT_TIER3=false` → shop vanishes. Analytics: watch server logs for `[orbit-analytics] {...}` lines.

---

# App-bug fixes (Part A) — quick verify (web + APK)

- **B-01 self-exclusion:** you never appear in Browse / Matches / Nearby (incl. right after native OAuth login).
- **B-04 redirects:** `/signup`,`/signin`,`/skills` → `/register`,`/login`,`/browse`.
- **B-06 share:** rank-up + session card Share always does something (native sheet on APK, download+copy on desktop) with a toast — never a dead tap.
- **B-03 SEO:** `curl -s <site>/ | grep "Orbit — Exchange"` → real noscript content.
- **A5 CTA:** logged-out footer/404 says "Sign in to browse" → after login lands on `/browse`.
- **A10 return-to-page:** open a protected URL logged-out → login → land on that URL, not `/dashboard`.
- **A11 CORS:** `curl -H "Origin: https://evil.vercel.app" -I <api>/api/health` → no allow-origin echo; APK still loads fine.

---

# Regression gate
`cd BackEnd && npx jest` → 162/162 · `cd FrontEnd && npm run build` → succeeds.
