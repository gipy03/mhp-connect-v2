import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  DIGIFORMA_API_KEY: z.string().optional(),
  BEXIO_API_TOKEN: z.string().optional(),
  ACCREDIBLE_WEBHOOK_SECRET: z.string().optional(),
  SMTP_USER: z.string().email().optional(),
  SMTP_APP_PASSWORD: z.string().optional(),
  GOOGLE_GEOCODING_API_KEY: z.string().optional(),
  BASE_URL: z.string().optional(),
  UPLOAD_DIR: z.string().optional(),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.string().default("3001"),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("Environment validation failed. Missing or invalid variables:");
    const fieldErrors = result.error.flatten().fieldErrors;
    for (const key of Object.keys(fieldErrors)) {
      console.error(`  - ${key}`);
    }
    process.exit(1);
  }

  if (result.data.NODE_ENV !== "production") {
    console.log("=== mhp | connect 2.0 ===");
    console.log(`Environment: ${result.data.NODE_ENV}`);
    console.log(`SMTP: ${result.data.SMTP_USER ? "configured" : "not configured"}`);
    console.log(`Bexio: ${result.data.BEXIO_API_TOKEN ? "configured" : "not configured"}`);
    console.log(`DigiForma: ${result.data.DIGIFORMA_API_KEY ? "configured" : "not configured"}`);
    console.log(`Geocoding: ${result.data.GOOGLE_GEOCODING_API_KEY ? "configured" : "not configured"}`);
    console.log(`Accredible webhook: ${result.data.ACCREDIBLE_WEBHOOK_SECRET ? "configured" : "not configured"}`);
    console.log("=========================");
  }

  return result.data;
}
