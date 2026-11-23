import type { AuthenticatedPrincipal } from '../auth/authorization.js';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth: AuthenticatedPrincipal;
    }
  }
}

export {};
