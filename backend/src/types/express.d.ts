import { JwtPayload } from '../middleware/auth';

declare global {
  namespace Express {
    // Define User interface to match our JwtPayload
    interface User extends JwtPayload {}
  }
}

export {};
