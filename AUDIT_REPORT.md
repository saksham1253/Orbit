# Orbit — Master Audit Report (Phase 1)

Branch: `feat/orbit-all` · Backend: Express (multi-host) · Frontend: React/Vite (Vercel) · Mobile: Capacitor Android APK.

Legend: ✅ Pass · ❌ Fail · ⚠️ Needs-info / partial. Runtime-only items (live APK, WebRTC media, OAuth round-trips) are marked ⚠️ where they can't be proven from source alone.

---

## Executive summary

- **Part B (gamification refinements B0–B8) is already implemented** on `feat/orbit-all` (prior commits `53e3e20`, `d9e66fc`, `1d67fcc`, `5ed0790`, + FCM-gitignore). 162 backend tests pass.
- **Two of the "top priority" Part-A bugs are effectively already resolved in code:** A1 (self-exclusion) and A2/B-02 (killed-app FCM push).
- **Genuine open bugs found:** **A13/B-06 (Share dead in the APK WebView)**, **A4/B-04 (missing route redirects)**, **A3/B-03 (no prerender/noscript body)**. A1 warrants a defensive client-side filter.

---

## PART A — findings

### A1 · Browse shows your own profile (B-01) — ✅ server-side / ⚠️ APK
- `getAllSkills` excludes self: `BackEnd/controllers/skillController.js:186` → `{ $match: { userId: { $ne: ObjectId(req.user.id) } } }`.
- `getMatches` excludes self: `skillController.js:344` (same `$ne`).
- **Root cause of the APK report is most likely stale client cache** (react-query) or a pre-fix build, not a server bug.
- **Recommended fix:** add a defensive client-side `.filter(s => ownerId !== me._id)` in Browse/Matches so a cached/edge case never leaks self. Low risk, additive.

### A2 · No push when APK killed (B-02) — ✅ (implemented; needs live verification)
- FCM is wired **end-to-end**:
  - FE registration: `FrontEnd/src/utils/pushNotify.js` — `@capacitor/push-notifications` (`package.json:19`), requests permission, `register()`, posts token to `POST /device/token`, wires `pushNotificationActionPerformed` deep-link, and `unregisterPush()` on logout.
  - BE storage: `controllers/deviceController.js` (`$addToSet`/`$pull` on `user.fcmTokens`).
  - BE send + prune: `services/fcm.js` (`sendToUser`, dead-token pruning).
  - Fan-out: `services/notify.js` calls `fcm.sendToUser` for **every** `createNotification`, so message / connection / call / Binary-Star / decay events already push while killed.
- ⚠️ Verify on a real device: Android 13 `POST_NOTIFICATIONS` prompt, per-category channels, Doze delivery, dedupe vs foreground. The Capacitor plugin covers permission + channels; confirm at runtime.
- Security: `google-services.json` now git-ignored (`.gitignore`), inject via CI.

### A3 · No-JS / crawler render (B-03) — ⚠️ partial
- `FrontEnd/index.html` has a correct static `<title>` + `meta description` + OG/Twitter tags (`index.html:9-30`) → crawlers **do** get title/meta.
- BUT body is only `<div id="root">` (`index.html:70`) with **no static hero content and no `<noscript>`** → no-JS clients see an empty page.
- The "Something went wrong" claim is unverified: without JS, React (and thus the ErrorBoundary) can't execute — the symptom is more likely a prerender service or a hydration throw. **Needs a repro with the exact crawler UA.**
- **Recommended fix:** add a `<noscript>` hero block + static prerender of the landing route (e.g. `vite-plugin-prerender` / `react-snap` for `/`), keep the ErrorBoundary for genuine runtime errors only.

### A4 · Guessed URLs 404 (B-04) — ❌ Fail
- No redirect routes exist for `/signup`, `/signin`, `/skills` (`App.jsx` only has real routes + a `*` NotFound/AdminGate). `vercel.json` rewrites all paths to `index.html` (SPA fallback), so these alias URLs fall through to NotFound.
- **Fix:** add `<Route path="/signup" element={<Navigate to="/register" replace/>}>` (and `/signin`→`/login`, `/skills`→`/browse`). SPA rewrite already covers direct hits, so client `<Navigate>` is sufficient; no `vercel.json` change needed.

### A5 · Public "Browse Skills" CTA vs login gate (B-05) — ⚠️ design decision
- `/browse` is under `ProtectedRoute` (`App.jsx:408`), yet public CTAs advertise browsing. **Pick Option A** (public read-only `/browse`, gate only connect/message/call) or **Option B** (relabel CTAs "Sign in to browse"). Needs product call.

### A6 · Leaderboard — ⚠️ (code looks correct; runtime spot-check needed)
- Deterministic ranking + "you" row exist (`services/leaderboardService.js` `rankEntries`, cosmic controller `you`). Empty/tie/self-outside-topN handled in code. Verify number formatting, emoji names, APK layout at runtime.

### A7 · Video call / WebRTC — ✅ TURN present / ⚠️ media runtime
- `FrontEnd/src/pages/VideoCall.jsx:87-104`: ICE list = Google STUN **plus** a configurable `VITE_TURN_URL` **and** an OpenRelay TURN fallback (`turn:openrelay.metered.ca:80/443/443?tcp`). Cross-NAT calls have relay coverage.
- ⚠️ **OpenRelay's free tier is unreliable for production** — provision a dedicated TURN (Metered/Twilio paid, or self-host coturn) via `VITE_TURN_URL`.
- ⚠️ Runtime: stream release on end (camera light off), decline notify, dual-incoming, backgrounded-mid-call — verify live.

### A8 · Connections / matching / messaging — ⚠️ runtime
- Self excluded (A1). Duplicate-request guard exists (`Connection` unique index). Real-time via socket + durable `Message`. Verify unread count + timezone rendering at runtime.

### A9 · Notifications matrix — ✅ infra / ⚠️ runtime
- Foreground in-app + durable center + FCM background all present. Verify one-push-per-event dedupe and the mute toggle (now `orbit.prefs.decayReminders` for decay) on device.

### A10 · Auth & routing — ⚠️ (verify Enter-submit + OAuth)
- Protected routes redirect when logged out (`ProtectedRoute`). OAuth routes exist (`oauthRoutes`). Verify: login form `type="submit"`/Enter, register confirm-password + strength, "return to originally requested page" after login.

### A11 · Backend & security — ⚠️ mixed
- Auth middleware on protected routes ✅ (`middleware/auth.js`). Rate limiters present (`authLimiter`, `generalLimiter`, `server.js`). Helmet + mongoSanitize + hpp present.
- Verify: CORS locked to prod origin; API-root info message trimmed in prod; no secrets in bundle; anti-gaming on Trust/CosmicScore (review-ring detection exists in `seasonService`/`cosmicScore`).

### A12 · Cross-platform parity — ⚠️ runtime (APK back-button, deep links, offline).

### A13 · Rank-Up / session card "Share" does nothing (B-06) — ❌ Fail (real bug, APK)
- The share **is** wired: `LiftoffOverlay.handleShare` (`LiftoffOverlay.jsx:135`) → `buildShareCard` + `shareOrDownload` (`cosmic/shareCard.js:74`); `RankMomentCard` exposes `onShare` (`RankMomentCard.jsx:79`).
- **Root cause:** `shareOrDownload` uses Web Share (`navigator.canShare({files})`) then falls back to an `<a download>` click. In the **Android WebView**, `canShare({files})` is typically false **and** anchor-download is a silent no-op → the button appears dead. There is also **no user feedback** (no spinner/toast) and **no native Android share intent**.
- **Fix (one shared util for both cards):** native tier via `@capacitor/share` (or an `Intent.ACTION_SEND image/png` bridge) → Web Share files → text/URL share → desktop download + copy-link; always show a spinner + success/failure/cancel toast. Session card (`cosmic/sessionCard.js`) must route through the same util.

---

## PART B — gamification (already delivered on `feat/orbit-all`)

| Item | Status | Evidence |
|---|---|---|
| B0 Photons rename | ✅ | dual-emit API + FE `photons ?? stardust`; tier "Stardust" untouched (`commit 1d67fcc`) |
| B1 Anti-gaming | ✅ | `services/orbitAntiGame.js` + tests (distinct-partner, taper, midnight) |
| B2 League XP re-weight | ✅ | `orbitConfig.js` weights + weekly per-source cap; "message-only can't promote" test |
| B3 Graduation phases | ✅ | `orbitEngine.graduationStatus` + tests; sticky "Fixed Star" |
| B4 Ethical copy | ✅ | supportive nudges; `orbit.prefs.decayReminders` toggle; `tests/notificationCopy.test.js` shame-lint |
| B5 Mastery bias | ✅ | "recognized with +N ✨ Photons"; mastery bars on skill cards |
| B6 Signal clarity | ✅ | `cosmic/SignalLegend.jsx` |
| B7 Push (= A2) | ✅ | shared FCM infra |
| B8 Staged rollout | ✅ | `services/orbitFlags.js` (+tests) + `orbitAnalytics.js`; flags on `GET /orbit/me` |

Backend tests: **162 / 14 suites** (was ~137).

---

## Recommended Phase-2 order (only the genuinely-open items)

1. **A13 / B-06** — Share dead in APK: shared util (`@capacitor/share` + feedback). *Real, high-visibility.*
2. **A4 / B-04** — route redirects `/signup`→`/register`, `/signin`→`/login`, `/skills`→`/browse`. *Trivial.*
3. **A1 / B-01** — defensive client-side self-filter in Browse/Matches. *Low risk.*
4. **A3 / B-03** — `<noscript>` hero + prerender the landing route.
5. **A7** — swap OpenRelay for a dedicated TURN in prod (`VITE_TURN_URL`).
6. **A11** — confirm CORS origin lock + trim API-root message.
7. **A5** — decide public-browse vs CTA relabel.
8. **A2, A6, A8–A10, A12** — live device/QA verification (no code gap identified).
