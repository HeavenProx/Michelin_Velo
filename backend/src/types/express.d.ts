import type { User } from '../users/user.entity';

declare module 'express' {
  interface Request {
    user?: User;
  }
}
