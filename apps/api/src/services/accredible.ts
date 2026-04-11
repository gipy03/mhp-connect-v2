import crypto from "crypto";
import { and, eq, ilike, inArray, or } from "drizzle-orm";
import {
  accredibleCredentials,
  programEnrollments,
  programFeatureGrants,
  programOverrides,
  userProfiles,
  users,
  type AccredibleCredential,
} from "@mhp/shared";
import { db } from "../db.js";
import { queueBoth } from "./notification.js";
import { logger } from "../lib/logger.js";

// ---------------------------------------------------------------------------
// Webhook payload types
// ---------------------------------------------------------------------------

export interface AccredibleCredentialPayload {
  id: number;
  recipient: { name: string; email: string };
  group: { name: string } | null;
  name: string;
  description?: string | null;
  issued_at: string | null;
  expires_at?: string | null;
  badge?: { url: string } | null;
  certificate?: { url: string } | null;
  url?: string | null;
}

export interface AccredibleWebhookPayload {
  event: string; // "credential.issued" | "credential.revoked" | etc.
  data: { credential: AccredibleCredentialPayload };
}

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

export function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string,
  secret: string
): boolean {
  try {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    // Accredible may send the signature with or without a "sha256=" prefix
    const normalized = signature.startsWith("sha256=")
      ? signature.slice(7)
      : signature;
    if (expected.length !== normalized.length) return false;
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(normalized, "hex")
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// handleWebhook — main entry point
// ---------------------------------------------------------------------------

export async function handleWebhook(
  payload: AccredibleWebhookPayload
): Promise<{ stored: boolean; userId: string | null }> {
  const { event, data } = payload;
  const cred = data?.credential;

  if (!cred) return { stored: false, userId: null };

  if (event === "credential.issued") {
    return handleIssued(cred);
  }

  if (event === "credential.revoked") {
    return handleRevoked(cred);
  }

  // Unknown event — acknowledge and ignore
  return { stored: false, userId: null };
}

// ---------------------------------------------------------------------------
// handleIssued — the full cascade (SPEC §10)
// ---------------------------------------------------------------------------

async function handleIssued(
  cred: AccredibleCredentialPayload
): Promise<{ stored: boolean; userId: string | null }> {
  // 1. Store (upsert) the credential record
  const stored = await upsertCredential(cred);

  // 2. Resolve user by email
  const recipientEmail = cred.recipient.email?.toLowerCase().trim();
  if (!recipientEmail) return { stored: true, userId: null };

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(ilike(users.email, recipientEmail))
    .limit(1);

  if (!user) {
    logger.info({ email: recipientEmail }, "Accredible webhook: no portal user found");
    return { stored: true, userId: null };
  }

  // Patch accredibleCredentials.userId if not already set
  if (!stored.userId) {
    await db
      .update(accredibleCredentials)
      .set({ userId: user.id })
      .where(eq(accredibleCredentials.id, stored.id));
  }

  // 3. Derive programCode from the credential group name
  const programCode = await resolveProgramCode(
    cred.group?.name ?? null,
    cred.name
  );

  // 4. Update directory visibility: hidden → internal if user qualifies
  await maybeUpgradeDirectoryVisibility(user.id, programCode);

  // 5. Update enrollment status → "completed" for matching active enrollment
  if (programCode) {
    await db
      .update(programEnrollments)
      .set({ status: "completed", updatedAt: new Date() })
      .where(
        and(
          eq(programEnrollments.userId, user.id),
          eq(programEnrollments.programCode, programCode),
          eq(programEnrollments.status, "active")
        )
      );
  }

  // 6. Fire credential_issued notification (email + internal bell)
  const [profile] = await db
    .select({ firstName: userProfiles.firstName })
    .from(userProfiles)
    .where(eq(userProfiles.userId, user.id))
    .limit(1);

  await queueBoth("credential_issued", user.id, {
    firstName: profile?.firstName ?? "",
    credentialName: cred.name,
    groupName: cred.group?.name ?? cred.name,
    badgeUrl: cred.badge?.url ?? "",
    credentialUrl: cred.url ?? "",
  }).catch((err) =>
    logger.error({ err }, "Failed to queue credential_issued notification")
  );

  return { stored: true, userId: user.id };
}

// ---------------------------------------------------------------------------
// handleRevoked
// ---------------------------------------------------------------------------

async function handleRevoked(
  cred: AccredibleCredentialPayload
): Promise<{ stored: boolean; userId: string | null }> {
  const credentialId = String(cred.id);

  const [existing] = await db
    .select()
    .from(accredibleCredentials)
    .where(eq(accredibleCredentials.accredibleCredentialId, credentialId))
    .limit(1);

  if (!existing) return { stored: false, userId: null };

  // Remove the credential record
  await db
    .delete(accredibleCredentials)
    .where(eq(accredibleCredentials.id, existing.id));

  const userId = existing.userId;
  if (!userId) return { stored: true, userId: null };

  // Recalculate directory visibility — if user has no remaining credentials
  // that qualify for the directory feature, downgrade to "hidden"
  await maybeDowngradeDirectoryVisibility(userId);

  return { stored: true, userId };
}

// ---------------------------------------------------------------------------
// Directory visibility helpers
// ---------------------------------------------------------------------------

async function maybeUpgradeDirectoryVisibility(
  userId: string,
  programCode: string | null
): Promise<void> {
  const [profile] = await db
    .select({ directoryVisibility: userProfiles.directoryVisibility })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  if (!profile || profile.directoryVisibility !== "hidden") return;

  // Check if the user has a directory feature grant (credentialRequired = true)
  // for ANY program they're enrolled in
  const enrollments = await db
    .select({ programCode: programEnrollments.programCode })
    .from(programEnrollments)
    .where(eq(programEnrollments.userId, userId));

  const enrolledCodes = enrollments.map((e) => e.programCode);
  if (enrolledCodes.length === 0) return;

  const codesToCheck = programCode
    ? [...new Set([programCode, ...enrolledCodes])]
    : enrolledCodes;

  const grants = await db
    .select({ id: programFeatureGrants.id })
    .from(programFeatureGrants)
    .where(
      and(
        eq(programFeatureGrants.featureKey, "directory"),
        inArray(programFeatureGrants.programCode, codesToCheck)
      )
    )
    .limit(1);

  if (grants.length > 0) {
    await db
      .update(userProfiles)
      .set({ directoryVisibility: "internal", updatedAt: new Date() })
      .where(eq(userProfiles.userId, userId));
    logger.info({ userId }, "Accredible webhook: upgraded directory visibility to internal");
  }
}

async function maybeDowngradeDirectoryVisibility(userId: string): Promise<void> {
  // Count remaining credentials for this user
  const remaining = await db
    .select({ id: accredibleCredentials.id })
    .from(accredibleCredentials)
    .where(eq(accredibleCredentials.userId, userId))
    .limit(1);

  if (remaining.length > 0) return; // Still has credentials — keep visibility

  const [profile] = await db
    .select({ directoryVisibility: userProfiles.directoryVisibility })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  // Only downgrade if currently internal (don't touch "public" — admin set that deliberately)
  if (profile?.directoryVisibility === "internal") {
    await db
      .update(userProfiles)
      .set({ directoryVisibility: "hidden", updatedAt: new Date() })
      .where(eq(userProfiles.userId, userId));
    logger.info({ userId }, "Accredible revocation: downgraded directory visibility to hidden");
  }
}

// ---------------------------------------------------------------------------
// Credential storage
// ---------------------------------------------------------------------------

async function upsertCredential(
  cred: AccredibleCredentialPayload
): Promise<AccredibleCredential> {
  const credentialId = String(cred.id);
  const issuedAt = cred.issued_at ? new Date(cred.issued_at) : null;
  const expiresAt = cred.expires_at ? new Date(cred.expires_at) : null;

  const [existing] = await db
    .select()
    .from(accredibleCredentials)
    .where(eq(accredibleCredentials.accredibleCredentialId, credentialId))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(accredibleCredentials)
      .set({
        recipientEmail: cred.recipient.email,
        recipientName: cred.recipient.name ?? null,
        groupName: cred.group?.name ?? null,
        credentialName: cred.name,
        description: cred.description ?? null,
        issuedAt,
        expiresAt,
        badgeUrl: cred.badge?.url ?? null,
        certificateUrl: cred.certificate?.url ?? null,
        url: cred.url ?? null,
      })
      .where(eq(accredibleCredentials.id, existing.id))
      .returning();
    return updated!;
  }

  const [created] = await db
    .insert(accredibleCredentials)
    .values({
      accredibleCredentialId: credentialId,
      recipientEmail: cred.recipient.email,
      recipientName: cred.recipient.name ?? null,
      groupName: cred.group?.name ?? null,
      credentialName: cred.name,
      description: cred.description ?? null,
      issuedAt,
      expiresAt,
      badgeUrl: cred.badge?.url ?? null,
      certificateUrl: cred.certificate?.url ?? null,
      url: cred.url ?? null,
    })
    .returning();
  return created!;
}

// ---------------------------------------------------------------------------
// Program code resolution
// ---------------------------------------------------------------------------

async function resolveProgramCode(
  groupName: string | null,
  credentialName: string
): Promise<string | null> {
  const candidates = [groupName, credentialName].filter(Boolean) as string[];
  if (candidates.length === 0) return null;

  const overrides = await db
    .select({ programCode: programOverrides.programCode, displayName: programOverrides.displayName })
    .from(programOverrides);

  for (const candidate of candidates) {
    const lc = candidate.toLowerCase();
    for (const o of overrides) {
      if (
        o.programCode.toLowerCase() === lc ||
        o.displayName?.toLowerCase() === lc ||
        lc.includes(o.programCode.toLowerCase()) ||
        (o.displayName && lc.includes(o.displayName.toLowerCase()))
      ) {
        return o.programCode;
      }
    }
  }

  return null;
}
