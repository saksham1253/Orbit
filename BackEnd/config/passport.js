const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const LinkedInStrategy = require('passport-linkedin-oauth2').Strategy;
const User = require('../models/user');
require('dotenv').config();

// Helper to find or create user
async function findOrCreateUser(profile, provider) {
    try {
        let email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;
        if (!email) {
            email = `${provider}_${profile.id}@example.com`; // Fallback
        }

        let isNewUser = false;
        let user = await User.findOne({ email });
        if (!user) {
            isNewUser = true;
            user = new User({
                name: profile.displayName || profile.username || 'OAuth User',
                email: email,
                password: Math.random().toString(36).slice(-8), // random dummy password
                isEmailVerified: true,
            });
            await user.save();
        }
        return { user, isNewUser };
    } catch (err) {
        throw err;
    }
}

// GOOGLE
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/api/auth/google/callback"
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const { user, isNewUser } = await findOrCreateUser(profile, 'google');
            return done(null, user, { isNewUser });
        } catch (err) { return done(err, null); }
    }));
}

// GITHUB
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(new GitHubStrategy({
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: "/api/auth/github/callback"
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const { user, isNewUser } = await findOrCreateUser(profile, 'github');
            return done(null, user, { isNewUser });
        } catch (err) { return done(err, null); }
    }));
}

// LINKEDIN
if (process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET) {
    passport.use(new LinkedInStrategy({
        clientID: process.env.LINKEDIN_CLIENT_ID,
        clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
        callbackURL: "/api/auth/linkedin/callback",
        scope: ['r_emailaddress', 'r_liteprofile']
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const user = await findOrCreateUser(profile, 'linkedin');
            return done(null, user);
        } catch (err) { return done(err, null); }
    }));
}

module.exports = passport;
