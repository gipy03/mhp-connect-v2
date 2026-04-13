declare module "express-session" {
  interface SessionData {
    userId: string;
    activePortal?: "member" | "trainer" | "admin";
    impersonatedBy?: string;
    impersonatedByAdminUser?: boolean;
    adminUserId?: string;
    isSuperAdmin?: boolean;
  }
}

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
      features?: Set<string>;
      trainerId?: string;
    }
  }
}

export {};
