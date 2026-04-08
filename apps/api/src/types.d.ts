// Global session augmentation — automatically picked up by TypeScript for all
// files in this compilation unit without needing an explicit import.
declare module "express-session" {
  interface SessionData {
    userId: string;
    role: import("@mhp/shared").UserRole;
  }
}
