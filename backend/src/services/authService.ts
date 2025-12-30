import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../config/database';
import logger from '../config/logger';
import { logErrors } from '../utils/errorLogging';

interface User {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: string;
  is_active: boolean;
  email_verified: boolean;
  created_at: Date;
}

class AuthService {
  /**
   * Generate JWT token for authenticated user
   */
  private generateToken(userId: string, email: string, role: string): string {
    return jwt.sign(
      { userId, email, role },
      process.env.JWT_SECRET as string,
      { expiresIn: '7d' }
    );
  }

  /**
   * Check if database query returned rows, throw error if not
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private checkRowExists<T>(rows: any[], errorMessage: string): T {
    if (rows.length === 0) {
      throw new Error(errorMessage);
    }
    return rows[0] as T;
  }

  @logErrors('AuthService.register')
  async register(email: string, password: string, fullName: string, role: string = 'kb_owner') {
    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      throw new Error('User already exists with this email');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await db.query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, role, created_at`,
      [email, passwordHash, fullName, role]
    );

    const user = result.rows[0] as unknown as User;

    // Create free subscription for new kb_owners
    if (role === 'kb_owner') {
      await db.query(
        `INSERT INTO subscriptions (user_id, tier, monthly_message_limit, current_period_start, current_period_end)
         VALUES ($1, 'free', 100, NOW(), NOW() + INTERVAL '30 days')`,
        [user.id]
      );
    }

    // Generate JWT token
    const token = this.generateToken(user.id, user.email, user.role);

    logger.info(`New user registered: ${email}`);

    return { user, token };
  }

  @logErrors('AuthService.login')
  async login(email: string, password: string) {
    // Find user
    const result = await db.query(
      'SELECT id, email, password_hash, full_name, role, is_active FROM users WHERE email = $1',
      [email]
    );

    const user = this.checkRowExists<User>(result.rows, 'Invalid email or password');

    if (!user.is_active) {
      throw new Error('Account is inactive');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Generate JWT token
    const token = this.generateToken(user.id, user.email, user.role);

    logger.info(`User logged in: ${email}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
      token,
    };
  }

  @logErrors('AuthService.getUserById')
  async getUserById(userId: string) {
    const result = await db.query(
      'SELECT id, email, full_name, role, is_active, email_verified, created_at FROM users WHERE id = $1',
      [userId]
    );

    return this.checkRowExists<User>(result.rows, 'User not found');
  }
}

export default new AuthService();
