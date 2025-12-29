import { Request, Response, NextFunction } from 'express';
import authService from '../services/authService';

class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, fullName, role } = req.body;

      const result = await authService.register(email, password, fullName, role);

      res.status(201).json({
        message: 'User registered successfully',
        user: result.user,
        token: result.token,
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'User already exists with this email') {
        return res.status(409).json({ error: error.message });
      }
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      const result = await authService.login(email, password);

      res.json({
        message: 'Login successful',
        user: result.user,
        token: result.token,
      });
    } catch (error: unknown) {
      if (error instanceof Error && (error.message.includes('Invalid') || error.message.includes('inactive'))) {
        return res.status(401).json({ error: error.message });
      }
      next(error);
    }
  }

  async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const user = await authService.getUserById(userId);
      res.json({ user });
    } catch (error) {
      next(error);
    }
  }
}

export default new AuthController();
