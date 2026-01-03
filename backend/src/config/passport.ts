import passport from 'passport';
import { Strategy as GoogleStrategy, Profile as GoogleProfile } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy, Profile as GitHubProfile } from 'passport-github2';
import db from './database';
import logger from './logger';

// Google OAuth Strategy
if (process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    passport.use(
        new GoogleStrategy(
            // @ts-expect-error - Passport Strategy type inference issue, code works correctly at runtime
            {
                clientID: process.env.GOOGLE_OAUTH_CLIENT_ID,
                clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
                callbackURL: process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:3001/api/oauth/auth/google/callback',
            },
            async (_accessToken: string, _refreshToken: string, profile: GoogleProfile, done: (error: Error | null, user?: unknown) => void) => {
                try {
                    const email = profile.emails?.[0]?.value;
                    const name = profile.displayName;
                    const avatarUrl = profile.photos?.[0]?.value;

                    if (!email) {
                        return done(new Error('No email found in Google profile'));
                    }

                    // Check if user exists
                    const existingUser = await db.query(
                        'SELECT * FROM users WHERE oauth_provider = $1 AND oauth_id = $2',
                        ['google', profile.id]
                    );

                    if (existingUser.rows.length > 0) {
                        // User exists, return it
                        return done(null, existingUser.rows[0]);
                    }

                    // Check if user with this email already exists (email/password auth)
                    const emailUser = await db.query(
                        'SELECT * FROM users WHERE email = $1',
                        [email]
                    );

                    if (emailUser.rows.length > 0) {
                        // Link OAuth to existing account
                        const updated = await db.query(
                            'UPDATE users SET oauth_provider = $1, oauth_id = $2, avatar_url = $3 WHERE id = $4 RETURNING *',
                            ['google', profile.id, avatarUrl, emailUser.rows[0].id]
                        );
                        return done(null, updated.rows[0]);
                    }

                    // Create new user
                    const newUser = await db.query(
                        `INSERT INTO users (email, full_name, oauth_provider, oauth_id, avatar_url, role, is_active, email_verified)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                         RETURNING *`,
                        [email, name, 'google', profile.id, avatarUrl, 'kb_owner', true, true]
                    );

                    // Create free subscription for new user
                    await db.query(
                        'INSERT INTO subscriptions (user_id, tier) VALUES ($1, $2)',
                        [newUser.rows[0].id, 'free']
                    );

                    logger.info('New user registered via Google OAuth', { userId: newUser.rows[0].id, email });

                    return done(null, newUser.rows[0]);
                } catch (error) {
                    logger.error('Google OAuth error:', error);
                    return done(error as Error);
                }
            }
        )
    );
} else {
    logger.warn('Google OAuth not configured - missing GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET');
}

// GitHub OAuth Strategy
if (process.env.GITHUB_OAUTH_CLIENT_ID && process.env.GITHUB_OAUTH_CLIENT_SECRET) {
    passport.use(
        new GitHubStrategy(
            {
                clientID: process.env.GITHUB_OAUTH_CLIENT_ID,
                clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
                callbackURL: process.env.GITHUB_OAUTH_REDIRECT_URI || 'http://localhost:3001/api/oauth/auth/github/callback',
                scope: ['user:email'],
            },
            async (_accessToken: string, _refreshToken: string, profile: GitHubProfile, done: (error: Error | null, user?: unknown) => void) => {
                try {
                    // GitHub returns emails in an array
                    const email = profile.emails?.[0]?.value;
                    const name = profile.displayName || profile.username;
                    const avatarUrl = profile.photos?.[0]?.value;

                    if (!email) {
                        return done(new Error('No email found in GitHub profile'));
                    }

                    // Check if user exists
                    const existingUser = await db.query(
                        'SELECT * FROM users WHERE oauth_provider = $1 AND oauth_id = $2',
                        ['github', profile.id]
                    );

                    if (existingUser.rows.length > 0) {
                        // User exists, return it
                        return done(null, existingUser.rows[0]);
                    }

                    // Check if user with this email already exists (email/password auth)
                    const emailUser = await db.query(
                        'SELECT * FROM users WHERE email = $1',
                        [email]
                    );

                    if (emailUser.rows.length > 0) {
                        // Link OAuth to existing account
                        const updated = await db.query(
                            'UPDATE users SET oauth_provider = $1, oauth_id = $2, avatar_url = $3 WHERE id = $4 RETURNING *',
                            ['github', profile.id, avatarUrl, emailUser.rows[0].id]
                        );
                        return done(null, updated.rows[0]);
                    }

                    // Create new user
                    const newUser = await db.query(
                        `INSERT INTO users (email, full_name, oauth_provider, oauth_id, avatar_url, role, is_active, email_verified)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                         RETURNING *`,
                        [email, name, 'github', profile.id, avatarUrl, 'kb_owner', true, true]
                    );

                    // Create free subscription for new user
                    await db.query(
                        'INSERT INTO subscriptions (user_id, tier) VALUES ($1, $2)',
                        [newUser.rows[0].id, 'free']
                    );

                    logger.info('New user registered via GitHub OAuth', { userId: newUser.rows[0].id, email });

                    return done(null, newUser.rows[0]);
                } catch (error) {
                    logger.error('GitHub OAuth error:', error);
                    return done(error as Error);
                }
            }
        )
    );
} else {
    logger.warn('GitHub OAuth not configured - missing GITHUB_OAUTH_CLIENT_ID or GITHUB_OAUTH_CLIENT_SECRET');
}

export default passport;
