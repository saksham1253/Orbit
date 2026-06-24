# Orbit — Mobile (APK + PWA)

Orbit ships to phones two ways, both **free** and from the **same web build**:

- **Android → `.apk`** wrapped with **Capacitor**, built in the cloud by **GitHub Actions**.
- **iPhone (+ Android) → PWA** — install from the browser ("Add to Home Screen").

Normal web development is unchanged. After any feature change, just `git push` —
CI rebuilds the APK and PWA users auto-update on next launch.

---

## Get the Android APK (no local tools)

1. Push to `main` (or run the **Build Android APK** workflow from the GitHub **Actions** tab → *Run workflow*).
2. Open the finished run → **Artifacts** → download **`Orbit-apk`** → unzip to get `Orbit.apk`.
3. Send `Orbit.apk` over WhatsApp / Drive. On the phone: tap it → allow **"install from unknown sources"** once → install.

> The CI build is a **debug** APK — installable and shareable immediately. For a
> Play Store listing later, switch to a signed **release** APK (free keystore in
> repo secrets).

## Build the APK locally (optional)

Needs Android Studio (free) or the Android SDK + JDK 17.

```bash
cd FrontEnd
npm ci
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk
# or: npx cap open android  (build from Android Studio)
```

## iPhone / Android PWA (free, link-shareable)

1. Open the deployed site (Vercel URL) in **Safari** (iPhone) or Chrome (Android).
2. **Share → Add to Home Screen.** It installs with the Orbit icon and launches fullscreen.
3. Share the link on WhatsApp — recipients install the same way. No store, $0.

---

## How it's wired

- **Capacitor** (`FrontEnd/capacitor.config.json`, `FrontEnd/android/`) wraps `dist/`
  and serves it from `https://localhost`, so the existing router + API client work as-is.
- **API/sockets**: production builds use `FrontEnd/.env.production`
  (`VITE_API_URL=…onrender.com/api`); `api.js`/`socket.js` also fall back to the
  Render URL in PROD.
- **Backend CORS** (`BackEnd/server.js`) allows `https://localhost` + `capacitor://localhost`.
- **Social login**: in the app the Google/GitHub buttons open the **system browser**
  (`?client=app`); the backend redirects to `orbit://oauth/callback?token=…`
  (`BackEnd/routes/oauthRoutes.js`), caught by the deep-link listener in
  `FrontEnd/src/services/nativeAuth.js`. Web login is unchanged.
- **Icons/splash**: regenerate after a logo change with
  `npx @capacitor/assets generate --android` (masters in `FrontEnd/assets/`),
  and PWA icons with `npx pwa-assets-generator --preset minimal-2023 public/orbit-icon.svg`.

### OAuth provider note
Add these redirect URIs in the Google/GitHub OAuth consoles (the callback URL is
unchanged — only the final hop differs), and they already point at the Render backend:
`https://skillswap-backend-mb4k.onrender.com/api/auth/google/callback` and `.../github/callback`.
No console changes are required for the app flow because the deep-link redirect
happens **after** the provider callback.

## App identity
- `appId`: **`app.orbit.mobile`** (package name — effectively permanent once published).
- Deep-link scheme: **`orbit://`** (overridable via backend env `APP_DEEPLINK_SCHEME`).

## Native iOS later (not free)
`npx cap add ios` needs a **Mac + Xcode**; distribution needs an **Apple Developer
account ($99/yr)** (TestFlight/App Store). Until then the **PWA** covers iPhone for free.
