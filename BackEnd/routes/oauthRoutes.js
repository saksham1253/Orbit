const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');

function generateToken(user) {
    return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

function handleCallback(req, res) {
    if (!req.user) {
        // Redirect back to frontend login page
        return res.redirect('http://localhost:8000/index.html?error=oauth_failed');
    }
    const token = generateToken(req.user);
    const isNew = req.authInfo && req.authInfo.isNewUser ? 'true' : 'false';
    // Redirect to frontend dashboard with token in query params
    res.redirect(`http://localhost:8000/dashboard.html?token=${token}&isNew=${isNew}`);
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

router.get('/oauth-fail', (req, res) => res.redirect('http://localhost:8000/index.html?error=oauth_failed'));

module.exports = router;
