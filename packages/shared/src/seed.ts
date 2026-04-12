/**
 * db:seed — idempotent database bootstrap script
 *
 * Usage:
 *   pnpm db:seed               (from repo root)
 *
 * Required environment variables:
 *   DATABASE_URL               PostgreSQL connection string
 *   SEED_ADMIN_PASSWORD        Admin password (required, no default)
 *
 * Optional environment variables:
 *   SEED_ADMIN_EMAIL           (default: admin@mhp-hypnose.com)
 */

import { execSync } from "node:child_process";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { users, userProfiles, notificationTemplates, adminUsers } from "./schema.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@mhp-hypnose.com";

function getAdminPassword(): string {
  const explicit = process.env.SEED_ADMIN_PASSWORD;
  if (explicit) return explicit;
  const generated = crypto.randomBytes(16).toString("base64url");
  console.log(`\n  ⚠ No SEED_ADMIN_PASSWORD set — generated one-time password: ${generated}`);
  console.log(`  ⚠ Store this securely; it will not be shown again.\n`);
  return generated;
}

function getSuperAdminPassword(): string {
  const isProd = process.env.NODE_ENV === "production";
  const key = isProd ? "SUPERADMIN_PROD_PASSWORD" : "SUPERADMIN_DEV_PASSWORD";
  const pw = process.env[key];
  if (pw) return pw;
  const fallback = process.env.ADMIN_PASSWORD;
  if (fallback) return fallback;
  const generated = crypto.randomBytes(16).toString("base64url");
  console.log(`\n  ⚠ No ${key} set — generated one-time password: ${generated}`);
  return generated;
}

const ADMIN_PASSWORD = getAdminPassword();
const SUPERADMIN_PASSWORD = getSuperAdminPassword();
const BCRYPT_ROUNDS = 12;

const __dirname = dirname(fileURLToPath(import.meta.url));
// drizzle.config.ts lives one level up from src/
const SHARED_ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Step 1 — Push schema to the database
// ---------------------------------------------------------------------------

function pushSchema() {
  console.log("\n── Step 1/3 · Pushing schema with drizzle-kit ──────────────");
  execSync("pnpm exec drizzle-kit push --force", {
    cwd: SHARED_ROOT,
    stdio: "inherit",
    env: { ...process.env },
  });
  console.log("✓ Schema up to date.\n");
}

// ---------------------------------------------------------------------------
// Step 2 — Seed admin user
// ---------------------------------------------------------------------------

async function seedAdminUser(db: ReturnType<typeof drizzle>) {
  console.log("── Step 2/3 · Seeding admin user ────────────────────────────");

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL))
    .limit(1);

  if (existing.length > 0) {
    console.log(`  ↳ User ${ADMIN_EMAIL} already exists — skipped.\n`);
    return existing[0].id;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);

  const [created] = await db
    .insert(users)
    .values({
      email: ADMIN_EMAIL,
      passwordHash,
      role: "admin",
      emailVerified: true,
    })
    .returning({ id: users.id });

  await db.insert(userProfiles).values({
    userId: created.id,
    firstName: "Admin",
    lastName: "MHP",
    directoryVisibility: "hidden",
  });

  console.log(`  ✓ Created admin user: ${ADMIN_EMAIL}`);
  console.log(`  ✓ Password: [set via ADMIN_PASSWORD env var]\n`);
  return created.id;
}

// ---------------------------------------------------------------------------
// Step 2b — Seed superadmin in admin_users table
// ---------------------------------------------------------------------------

async function seedSuperAdmin(db: ReturnType<typeof drizzle>) {
  console.log("── Step 2b · Seeding superadmin (admin_users) ────────────────");

  const existing = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(eq(adminUsers.email, ADMIN_EMAIL))
    .limit(1);

  const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, BCRYPT_ROUNDS);

  if (existing.length > 0) {
    await db
      .update(adminUsers)
      .set({ passwordHash })
      .where(eq(adminUsers.id, existing[0].id));
    console.log(`  ↳ Superadmin ${ADMIN_EMAIL} already exists — password updated.\n`);
    return;
  }

  await db.insert(adminUsers).values({
    email: ADMIN_EMAIL,
    passwordHash,
    displayName: "Admin MHP",
    isSuperAdmin: true,
  });

  console.log(`  ✓ Created superadmin: ${ADMIN_EMAIL}\n`);
}

// ---------------------------------------------------------------------------
// Step 3 — Seed notification templates
// ---------------------------------------------------------------------------

const TEMPLATES = [
  {
    eventType: "registration_confirmation",
    subject: "Confirmation de votre inscription — {{programName}}",
    body: `Bonjour {{firstName}},

Nous avons bien enregistré votre inscription au programme **{{programName}}** (réf. {{programCode}}).

Date d'inscription : {{enrolledAt}}

Vous recevrez prochainement votre facture ainsi que les informations pratiques concernant vos sessions.

À bientôt,
L'équipe MHP Hypnose`,
  },
  {
    eventType: "invoice_sent",
    subject: "Votre facture N° {{documentNr}} — {{programName}}",
    body: `Bonjour {{firstName}},

Veuillez trouver ci-joint votre facture N° {{documentNr}} d'un montant de {{amount}} CHF pour le programme **{{programName}}**.

Pour toute question concernant votre facture, n'hésitez pas à nous contacter.

Cordialement,
L'équipe MHP Hypnose`,
  },
  {
    eventType: "session_reminder",
    subject: "Rappel — votre session {{programName}} approche",
    body: `Bonjour {{firstName}},

Nous vous rappelons que votre prochaine session du programme **{{programName}}** aura lieu le {{sessionDate}}.

Référence session : {{sessionId}}

N'hésitez pas à nous contacter si vous avez des questions.

À très bientôt,
L'équipe MHP Hypnose`,
  },
  {
    eventType: "session_rescheduled",
    subject: "Modification de session — {{programName}}",
    body: `Bonjour {{firstName}},

Nous vous informons qu'une session du programme **{{programName}}** a été modifiée.

Ancienne session : {{oldSessionId}}
Nouvelle session : {{newSessionId}}

Nous nous excusons pour la gêne occasionnée et restons disponibles pour toute question.

Cordialement,
L'équipe MHP Hypnose`,
  },
  {
    eventType: "credential_issued",
    subject: "Votre certificat {{credentialName}} est disponible",
    body: `Bonjour {{firstName}},

Félicitations ! Votre certification **{{credentialName}}** a été émise le {{issuedAt}}.

Vous pouvez accéder à vos documents via les liens suivants :
- Badge numérique : {{badgeUrl}}
- Certificat PDF : {{certificateUrl}}

Nous vous souhaitons beaucoup de succès dans la suite de votre parcours.

L'équipe MHP Hypnose`,
  },
  {
    eventType: "refund_update",
    subject: "Mise à jour de votre demande de remboursement — {{programName}}",
    body: `Bonjour {{firstName}},

Votre demande de remboursement pour le programme **{{programName}}** a été mise à jour.

Statut : {{refundStatus}}
{{adminNote}}

Pour toute question, contactez-nous directement.

Cordialement,
L'équipe MHP Hypnose`,
  },
  {
    eventType: "community_mention",
    subject: "{{mentionedBy}} vous a mentionné dans {{channelName}}",
    body: `Bonjour {{firstName}},

{{mentionedBy}} vous a mentionné dans le canal **{{channelName}}**.

Voir le message : {{postUrl}}

L'équipe MHP Hypnose`,
  },
];

async function seedNotificationTemplates(db: ReturnType<typeof drizzle>) {
  console.log("── Step 3/3 · Seeding notification templates ────────────────");

  let created = 0;
  let skipped = 0;

  for (const tpl of TEMPLATES) {
    const existing = await db
      .select({ id: notificationTemplates.id })
      .from(notificationTemplates)
      .where(eq(notificationTemplates.eventType, tpl.eventType))
      .limit(1);

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    await db.insert(notificationTemplates).values({
      eventType: tpl.eventType,
      subject: tpl.subject,
      body: tpl.body,
      active: true,
    });
    created++;
  }

  console.log(`  ✓ Templates: ${created} created, ${skipped} already existed.\n`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("✗ DATABASE_URL is not set. Cannot run seed.");
    process.exit(1);
  }

  console.log("╔══════════════════════════════════════════╗");
  console.log("║  mhp | connect 2.0 — database seed       ║");
  console.log("╚══════════════════════════════════════════╝");

  // Step 1 — push schema
  pushSchema();

  // Connect to DB for data seeding
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    // Step 2 — admin user (legacy users table)
    await seedAdminUser(db);

    // Step 2b — superadmin (admin_users table)
    await seedSuperAdmin(db);

    // Step 3 — notification templates
    await seedNotificationTemplates(db);
  } finally {
    await pool.end();
  }

  console.log("╔══════════════════════════════════════════╗");
  console.log("║  Seed complete. App is ready to start.   ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log(`\n  Admin login: ${ADMIN_EMAIL}`);
  console.log(`  Password:    [set via ADMIN_PASSWORD env var]\n`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
