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

function handleCallback(req, res) {
    if (!req.user) {
        return res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`);
    }
    const token = generateToken(req.user);
    const userName = encodeURIComponent(req.user.name || '');
    const userId = req.user._id;
    // Redirect to the frontend OAuth handler route that stores the token.
    res.redirect(`${FRONTEND_URL}/oauth/callback?token=${token}&name=${userName}&id=${userId}`);
}

// Google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: '/api/auth/oauth-fail' }), handleCallback);

// GitHub
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));
router.get('/github/callback', passport.authenticate('github', { session: false, failureRedirect: '/api/auth/oauth-fail' }), handleCallback);

// LinkedIn
router.get('/linkedin', passport.authenticate('linkedin', { state: true }));
router.get('/linkedin/callback', passport.authenticate('linkedin', { session: false, failureRedirect: '/api/auth/oauth-fail' }), handleCallback);

router.get('/oauth-fail', (req, res) => res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`));

module.exports = router;
