# QA Checklist — `feat/orbit-all`

Run each on **Web** and **APK**. ✅ = expected result. Two accounts (A, B) needed for social/notification checks.

## Part A — app bug fixes

### B-01 · Self excluded from Browse/Matches/Nearby
- Web: log in → `/browse`, `/matches`, `/nearby` → ✅ your own listings/pin never appear (search your own name too).
- APK: same, **including right after a fresh OAuth login** (the boot hydration case) → ✅ still no self.

### B-04 · Route redirects
- Visit `/signup`, `/signin`, `/skills` (web + APK deep link) → ✅ land on `/register`, `/login`, `/browse` (no 404).

### B-06 · Share card (rank-up + session)
- APK: trigger a rank-up (or finish a session) → tap **Share** → ✅ native share sheet opens with the card/text; on cancel → no error toast.
- Web (desktop): tap Share → ✅ PNG downloads **and** a "downloaded & link copied" toast appears.
- Never a silent dead tap on either.

### B-03 · No-JS / SEO
- `curl -s https://<site>/ | grep -i "Orbit — Exchange"` → ✅ noscript hero content present.
- Load with JS disabled → ✅ real content (not blank / not "Something went wrong").

### A5 · Browse CTA honesty
- Logged out: Landing footer + 404 page → ✅ CTA reads "Sign in to browse"; clicking → login → ✅ lands on `/browse` after auth.
- Logged in: → ✅ reads "Browse Skills".

### A10 · Return to intended page
- Logged out, open `/leaderboard` directly → bounced to login → sign in → ✅ land on `/leaderboard` (not `/dashboard`). Web + APK.

### A11 · CORS / security
- `curl -H "Origin: https://evil.vercel.app" -I https://<api>/api/health` → ✅ no `Access-Control-Allow-Origin: https://evil.vercel.app`.
- APK still loads all data (Capacitor origin allowed) → ✅ no CORS errors in Logcat.
- `GET /` → ✅ `{"status":"ok"}` only.

### A2 · Killed-app push (device)
- Kill APK (B logged in) → A sends message / connection request / starts a call → ✅ one system push arrives on B, taps deep-link to the right screen; foreground still shows in-app flash; no duplicates.

## Part B — gamification

### Streak + anti-gaming (B1/B3)
- Send 20 messages to the **same** partner in a day → ✅ streak advances at most 1 day, XP capped (check `/orbit`).
- Complete a swap / leave a review → ✅ streak advances; XP climbs faster than messaging.
- Reach 60-day streak (or seed) → ✅ "Fixed Star" badge, countdown de-emphasised; miss a day → ✅ badge retained, supportive copy.

### Photons rename (B0)
- `/orbit`, shop, missions, dashboard widget → ✅ all say "Photons ✨"; league tier still "Stardust".
- `GET /api/orbit/me` → ✅ payload has both `photons` and `stardust` (equal).

### Leagues (B2/B8)
- Earn XP; check `/orbit` league panel ranks by weekly XP; Monday rollover → ✅ top promote / bottom relegate, XP resets.
- Set `ORBIT_TIER2=false` → ✅ League + Constellations panels hidden; `ORBIT_TIER3=false` → shop hidden.

### Ethical copy (B4)
- `npx jest tests/notificationCopy.test.js` → ✅ passes (no shame phrases).
- Settings/`POST /api/orbit/prefs {decayReminders:false}` → ✅ decay reminders stop.

### Signal clarity (B6)
- `/orbit` → ✅ legend shows Photons / CosmicScore / Orbit XP with distinct icon+colour+one-liner.

## Regression gate
- `cd BackEnd && npx jest` → ✅ 162/162.
- `cd FrontEnd && npm run build` → ✅ succeeds.
