import { Router, Request, Response } from 'express';
import passport from '../config/passport';
import jwt from 'jsonwebtoken';
import logger from '../config/logger';

const router = Router();

// Google OAuth Routes
router.get(
    '/auth/google',
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        session: false,
    })
);

router.get(
    '/auth/google/callback',
    passport.authenticate('google', {
        session: false,
        failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_failed`,
    }),
    (req: Request, res: Response) => {
        try {
            // OAuth returns database user object (id, email, role), not JwtPayload (userId)
            const user = req.user as unknown as Record<string, unknown>;

            if (!user) {
                return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=no_user`);
            }

            // Generate JWT token
            const token = jwt.sign(
                {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                },
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: '7d' }
            );

            // Redirect to frontend with token
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            res.redirect(`${frontendUrl}/oauth/callback?token=${token}`);
        } catch (error) {
            logger.error('Google OAuth callback error:', error);
            res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=server_error`);
        }
    }
);

// GitHub OAuth Routes
router.get(
    '/auth/github',
    passport.authenticate('github', {
        scope: ['user:email'],
        session: false,
    })
);

router.get(
    '/auth/github/callback',
    passport.authenticate('github', {
        session: false,
        failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=oauth_failed`,
    }),
    (req: Request, res: Response) => {
        try {
            // OAuth returns database user object (id, email, role), not JwtPayload (userId)
            const user = req.user as unknown as Record<string, unknown>;

            if (!user) {
                return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=no_user`);
            }

            // Generate JWT token
            const token = jwt.sign(
                {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                },
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: '7d' }
            );

            // Redirect to frontend with token
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            res.redirect(`${frontendUrl}/oauth/callback?token=${token}`);
        } catch (error) {
            logger.error('GitHub OAuth callback error:', error);
            res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=server_error`);
        }
    }
);

export default router;
