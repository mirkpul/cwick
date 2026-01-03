import { JwtPayload } from '../middleware/auth';

declare global {
  namespace Express {
    // Define User interface to match our JwtPayload
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends JwtPayload { }
  }
}

export { };
