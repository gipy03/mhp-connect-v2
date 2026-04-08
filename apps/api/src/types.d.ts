// Global session augmentation — automatically picked up by TypeScript for all
// files in this compilation unit without needing an explicit import.
declare module "express-session" {
  interface SessionData {
    userId: string;
    role: import("@mhp/shared").UserRole;
    /** Set when an admin is impersonating another user. Holds the original admin's userId. */
    impersonatedBy?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      // Raw body buffer saved by express.json verify callback.
      // Used for Accredible webhook HMAC-SHA256 signature verification.
      rawBody?: Buffer;

      // Resolved feature keys for the authenticated user.
      // Populated by resolveUserFeatures() or requireFeature() middleware.
      // Serialise to Array before sending in JSON responses.
      features?: Set<string>;
    }
  }
}
