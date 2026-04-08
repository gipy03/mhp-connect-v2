declare module "express-session" {
  interface SessionData {
    userId: string;
    role: "member" | "admin";
    impersonatedBy?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
      features?: Set<string>;
    }
  }
}

export {};
