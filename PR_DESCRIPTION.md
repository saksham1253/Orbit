# PR: Orbit engagement engine + Gravity & Glow refinements + app-bug fixes

Branch `feat/orbit-all` → `main` · 25 commits · ~68 files, +4.8k/−43 · **162 backend tests (14 suites) green, frontend builds clean.**

Everything is **additive & default-safe** for existing users, gated by feature flags/env where noted. Verified on **both web and the Capacitor APK**.

---

## 1. Orbit gamification engine (six tiers)
A support-and-pride engagement system, each engine with a pure, I/O-free core + unit tests:
- **Tier 1** — Orbit Streak (real-progress days, not app-opens), Gravity Assist freezes, weekly rotating Missions, **Photons** soft currency.
- **Tier 2** — co-op **Binary Star** shared streaks (Constellations); weekly **Leagues** with promotion/relegation on fresh Orbit XP.
- **Tier 3** — Photon **cosmetics shop**, per-skill **Mastery** ladders ("Guitar Mentor"), post-session **ritual** + shareable session card.

## 2. Gravity & Glow refinements (B0–B8)
- **B0 Photons rename** — currency renamed from "Stardust" (collided with a league tier). **Zero-migration**: DB field stays `orbit.stardust`; API dual-emits `photons`/`stardust` for one deprecation window; UI reads `photons ?? stardust`. League tier "Stardust" untouched.
- **B1 Anti-gaming** — messages earn credit only from a *new distinct partner/day* (taper past `ORBIT_MSG_XP_CAP`), never from spam. Pure core + tests.
- **B2 League XP re-weight** — config-driven weights + weekly per-source cap; a test proves *message-only play can't promote*.
- **B3 Graduation phases** — Formation→Consistency→Graduation; sticky "Fixed Star" pride badge; pressure eases with maturity.
- **B4 Ethical copy** — supportive nudges, user-toggleable decay reminders, guilt-free dissolve, shared Gravity Assist; a **shame-phrase lint test** fails the build on confirmshaming copy.
- **B5 Recognition framing** — "recognized with +N ✨ Photons"; mastery is the emotional centre; cosmetics-only spend (no pay-to-win).
- **B6 Signal clarity** — a "Your Progress" legend distinguishing Photons / CosmicScore / Orbit XP.
- **B8 Staged rollout** — per-tier feature flags + deterministic % cohorts (`orbitFlags.js`) + structured analytics events (`orbitAnalytics.js`).

## 3. App-bug fixes (Part A)
- **B-01 self in Browse** — already excluded server-side; added defensive client filters (Browse/Matches/Nearby) + **boot-time user hydration** so the APK's native session always has a reliable `user._id`.
- **B-02 killed-app push** — verified FCM is fully wired (`@capacitor/push-notifications` + `fcm.js` + `notify.js` fan-out); secured `google-services.json` via `.gitignore`.
- **B-03 no-JS/SEO** — `<noscript>` hero + on-brand first-paint splash; confirmed ErrorBoundary only fires on real errors.
- **B-04 redirects** — `/signup→/register`, `/signin→/login`, `/skills→/browse`.
- **B-06 share dead in APK** — rebuilt `shareOrDownload` as file-share → text/URL-share (rescues the WebView) → download+copy, always with a feedback toast; both rank-up and session cards fixed.
- **A5** — honest "Sign in to browse" CTA (keeps `/browse` destination so login returns there).
- **A10** — return to the originally-requested page after login.
- **A11** — CORS scoped to own prod+preview origins (APK origins preserved); API-root trimmed.

## Rollback / config
- Currency: no DB migration to roll back; drop the dual-emit next release.
- Flags: `ORBIT_TIER1/2/3` (+`_PCT`), `ORBIT_MSG_XP_CAP`, `ORBIT_DECAY_REMINDERS`, `ORBIT_ANALYTICS`, `CORS_ORIGIN`, `VITE_TURN_URL`.

## Known follow-ups (not in this PR)
Dedicated TURN server for prod (A7, ops); full prerender beyond noscript (A3); rename the `stardust` DB column after the deprecation window; live-device QA (A2/A6/A8/A9/A12).
