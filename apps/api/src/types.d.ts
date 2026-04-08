// Global session augmentation — automatically picked up by TypeScript for all
// files in this compilation unit without needing an explicit import.
declare module "express-session" {
  interface SessionData {
    userId: string;
    role: import("@mhp/shared").UserRole;
  }
}

// Raw body buffer saved by express.json verify callback — used for webhook
// signature verification (Accredible HMAC-SHA256).
declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}
