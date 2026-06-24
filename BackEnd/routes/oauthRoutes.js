const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');

// The OAuth flow finishes on the BACKEND, but the token has to land in the
// FRONTEND app. Relative redirects stay on the backend origin (no React there),
// so all post-OAuth redirects are absolute to FRONTEND_URL.
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://react-skill-swap-fully-fledged.vercel.app').replace(/\/$/, '');

function generateToken(user) {
    return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

// The Capacitor APK opens OAuth in the system browser with ?client=app, which
// passport round-trips as the `state` param. On the callback we then redirect
// to the app's custom-scheme deep link instead of the web FRONTEND_URL.
const APP_SCHEME = (process.env.APP_DEEPLINK_SCHEME || 'orbit') + '://oauth/callback';

function handleCallback(req, res) {
    const isApp = req.query.state === 'app';
    if (!req.user) {
        return res.redirect(isApp ? `${APP_SCHEME}?error=oauth_failed` : `${FRONTEND_URL}/login?error=oauth_failed`);
    }
    const token = generateToken(req.user);
    const userName = encodeURIComponent(req.user.name || '');
    const userId = req.user._id;
    const target = isApp ? APP_SCHEME : `${FRONTEND_URL}/oauth/callback`;
    res.redirect(`${target}?token=${token}&name=${userName}&id=${userId}`);
}

// Pass ?client=app through as OAuth `state` so the callback knows to deep-link
// back into the native app (no session/state store needed — it just round-trips).
const appState = (req) => (req.query.client === 'app' ? 'app' : undefined);

// Google
router.get('/google', (req, res, next) =>
    passport.authenticate('google', { scope: ['profile', 'email'], state: appState(req) })(req, res, next));
router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: '/api/auth/oauth-fail' }), handleCallback);

// GitHub
router.get('/github', (req, res, next) =>
    passport.authenticate('github', { scope: ['user:email'], state: appState(req) })(req, res, next));
router.get('/github/callback', passport.authenticate('github', { session: false, failureRedirect: '/api/auth/oauth-fail' }), handleCallback);

// LinkedIn
router.get('/linkedin', passport.authenticate('linkedin', { state: true }));
router.get('/linkedin/callback', passport.authenticate('linkedin', { session: false, failureRedirect: '/api/auth/oauth-fail' }), handleCallback);

router.get('/oauth-fail', (req, res) => res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`));

module.exports = router;
