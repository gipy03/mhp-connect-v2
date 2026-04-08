#!/usr/bin/env tsx
/**
 * Database seed script.
 *
 * 1. Runs `drizzle-kit push` to create / sync all tables.
 * 2. Creates an admin user (idempotent).
 * 3. Creates notification templates for every event type (idempotent).
 *
 * Required env var : DATABASE_URL
 * Optional env vars: SEED_ADMIN_EMAIL   (default: admin@mhp-hypnose.com)
 *                    SEED_ADMIN_PASSWORD (default: Admin123!)
 *
 * Run from repo root:
 *   pnpm db:seed
 */

import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import { users, userProfiles, notificationTemplates } from "./schema.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error(
    "\n❌  DATABASE_URL is not set.\n" +
      "    Copy .env.example → .env and fill in the values, or set it as a Replit Secret.\n"
  );
  process.exit(1);
}

const ADMIN_EMAIL =
  process.env.SEED_ADMIN_EMAIL ?? "admin@mhp-hypnose.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";
const BCRYPT_ROUNDS = 12;

// ---------------------------------------------------------------------------
// Step 1 — Push schema (drizzle-kit push)
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkgDir = resolve(__dirname, ".."); // packages/shared

console.log("\n📦  Pushing schema to database…");
try {
  execSync("npx drizzle-kit push --config drizzle.config.ts", {
    cwd: pkgDir,
    stdio: "inherit",
    env: { ...process.env },
  });
} catch {
  console.error(
    "\n❌  drizzle-kit push failed.\n" +
      "    Make sure DATABASE_URL is correct and the database server is reachable.\n"
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Step 2 — Seed data
// ---------------------------------------------------------------------------

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool, {
  schema: { users, userProfiles, notificationTemplates },
});

async function seed() {
  // ── Admin user ────────────────────────────────────────────────────────────

  console.log(`\n👤  Admin user: ${ADMIN_EMAIL}`);

  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL));

  let adminId: string;

  if (existingUser.length > 0) {
    adminId = existingUser[0].id;
    console.log("     ℹ  Already exists — skipping.");
  } else {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);

    const [row] = await db
      .insert(users)
      .values({
        email: ADMIN_EMAIL,
        passwordHash,
        role: "admin",
        emailVerified: true,
      })
      .returning({ id: users.id });

    adminId = row.id;

    await db.insert(userProfiles).values({
      userId: adminId,
      firstName: "Admin",
      lastName: "MHP",
    });

    console.log(`     ✅  Created (password: ${ADMIN_PASSWORD})`);
  }

  // ── Notification templates ─────────────────────────────────────────────────

  console.log("\n📧  Notification templates:");

  const TEMPLATES = [
    {
      eventType: "registration_confirmation",
      subject: "Confirmation de votre inscription — {{programName}}",
      body: [
        "Bonjour {{firstName}},",
        "",
        "Nous confirmons votre inscription au programme {{programName}} ({{programCode}}).",
        "",
        "À bientôt,",
        "L'équipe MHP Hypnose",
      ].join("\n"),
    },
    {
      eventType: "invoice_sent",
      subject: "Votre facture N°{{documentNr}} — MHP Hypnose",
      body: [
        "Bonjour {{firstName}} {{lastName}},",
        "",
        "Veuillez trouver ci-joint votre facture N°{{documentNr}}",
        "d'un montant de {{amount}} CHF pour le programme {{programName}}.",
        "",
        "Merci,",
        "L'équipe MHP Hypnose",
      ].join("\n"),
    },
    {
      eventType: "session_reminder",
      subject: "Rappel : votre session {{programName}} — {{sessionDate}}",
      body: [
        "Bonjour {{firstName}},",
        "",
        "Rappel : vous avez une session du programme {{programName}}",
        "le {{sessionDate}} à {{location}}.",
        "",
        "À bientôt,",
        "L'équipe MHP Hypnose",
      ].join("\n"),
    },
    {
      eventType: "session_rescheduled",
      subject: "Votre session {{programName}} a été reprogrammée",
      body: [
        "Bonjour {{firstName}},",
        "",
        "Votre session du programme {{programName}} a été reprogrammée.",
        "",
        "Ancienne date : {{oldSession}}",
        "Nouvelle date : {{newSession}}",
        "",
        "Merci de votre compréhension,",
        "L'équipe MHP Hypnose",
      ].join("\n"),
    },
    {
      eventType: "credential_issued",
      subject: "Votre certification {{credentialName}} est disponible",
      body: [
        "Bonjour {{firstName}} {{lastName}},",
        "",
        "Félicitations ! Votre certification {{credentialName}} a été délivrée.",
        "",
        "Consultez-la ici : {{certificateUrl}}",
        "",
        "L'équipe MHP Hypnose",
      ].join("\n"),
    },
    {
      eventType: "refund_update",
      subject: "Mise à jour de votre remboursement — {{programName}}",
      body: [
        "Bonjour {{firstName}},",
        "",
        "Votre demande de remboursement pour {{programName}} a été mise à jour.",
        "",
        "Statut : {{status}}",
        "{{adminNote}}",
        "",
        "L'équipe MHP Hypnose",
      ].join("\n"),
    },
    {
      eventType: "community_mention",
      subject: "Vous avez été mentionné dans la communauté MHP",
      body: [
        "Bonjour {{firstName}},",
        "",
        "Vous avez été mentionné dans une discussion de la communauté.",
        "",
        "Voir le message : {{communityPostUrl}}",
        "",
        "L'équipe MHP Hypnose",
      ].join("\n"),
    },
  ] as const;

  for (const tmpl of TEMPLATES) {
    const existing = await db
      .select({ id: notificationTemplates.id })
      .from(notificationTemplates)
      .where(eq(notificationTemplates.eventType, tmpl.eventType));

    if (existing.length > 0) {
      console.log(`     ℹ  ${tmpl.eventType} — already exists.`);
    } else {
      await db
        .insert(notificationTemplates)
        .values({ ...tmpl, active: true });
      console.log(`     ✅  ${tmpl.eventType}`);
    }
  }

  console.log("\n✅  Seed complete.\n");
  await pool.end();
}

seed().catch((err) => {
  console.error("\n❌  Seed failed:", err);
  pool.end().catch(() => {});
  process.exit(1);
});
