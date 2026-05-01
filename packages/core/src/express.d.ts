// Augment Express Request with fields set by our middleware.
declare namespace Express {
  interface Request {
    /** Set by requireAuth middleware after JWT verification */
    userId?: string;
  }
}
