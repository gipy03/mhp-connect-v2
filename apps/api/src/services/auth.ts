import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import {
  authTokens,
  userProfiles,
  users,
  type User,
} from "@mhp/shared";
import {
  sendPasswordResetEmail,
  sendSetPasswordEmail,
} from "@mhp/integrations/email";
import { db } from "../db.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;       // 1 hour
const SET_PASSWORD_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class AuthError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = "AuthError";
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type PublicUser = Omit<User, "passwordHash">;

function omitPassword(user: User): PublicUser {
  const { passwordHash: _pw, ...rest } = user;
  return rest;
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

export async function register(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<PublicUser> {
  const email = data.email.toLowerCase().trim();

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    throw new AuthError("Un compte avec cet email existe déjà.", 409);
  }

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

  const user = await db.transaction(async (tx) => {
    const [newUser] = await tx
      .insert(users)
      .values({ email, passwordHash, role: "member", emailVerified: false })
      .returning();

    await tx.insert(userProfiles).values({
      userId: newUser!.id,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
    });

    return newUser!;
  });

  return omitPassword(user);
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export async function login(
  email: string,
  password: string
): Promise<PublicUser> {
  const normalizedEmail = email.toLowerCase().trim();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  // Deliberate vagueness — don't reveal whether the account exists
  if (!user || !user.passwordHash) {
    throw new AuthError("Identifiants incorrects.", 401);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AuthError("Identifiants incorrects.", 401);
  }

  return omitPassword(user);
}

// ---------------------------------------------------------------------------
// Forgot password — generate token and send reset email
// ---------------------------------------------------------------------------

export async function forgotPassword(
  email: string,
  baseUrl: string
): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  // Always return — never reveal whether the email is registered
  if (!user) return;

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

  await db.insert(authTokens).values({
    userId: user.id,
    token,
    type: "reset_password",
    expiresAt,
  });

  const [profile] = await db
    .select({ firstName: userProfiles.firstName })
    .from(userProfiles)
    .where(eq(userProfiles.userId, user.id))
    .limit(1);

  await sendPasswordResetEmail(
    user.email,
    token,
    profile?.firstName ?? null,
    baseUrl
  );
}

// ---------------------------------------------------------------------------
// Reset password — validate token, update password, invalidate token
// ---------------------------------------------------------------------------

export async function resetPassword(
  token: string,
  newPassword: string
): Promise<void> {
  const now = new Date();

  const [tokenRecord] = await db
    .select()
    .from(authTokens)
    .where(
      and(
        eq(authTokens.token, token),
        eq(authTokens.type, "reset_password"),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, now)
      )
    )
    .limit(1);

  if (!tokenRecord) {
    throw new AuthError("Ce lien est invalide ou a expiré.", 400);
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash, updatedAt: now })
      .where(eq(users.id, tokenRecord.userId));

    await tx
      .update(authTokens)
      .set({ usedAt: now })
      .where(eq(authTokens.id, tokenRecord.id));
  });
}

// ---------------------------------------------------------------------------
// Set password — same as reset but for the initial set-password flow
// (token type: "set_password", 24h expiry, different email template)
// ---------------------------------------------------------------------------

export async function generateSetPasswordToken(
  userId: string,
  email: string,
  firstName: string | null,
  baseUrl: string
): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SET_PASSWORD_EXPIRY_MS);

  await db.insert(authTokens).values({
    userId,
    token,
    type: "set_password",
    expiresAt,
  });

  await sendSetPasswordEmail(email, token, firstName, baseUrl);
}

export async function setPassword(
  token: string,
  newPassword: string
): Promise<void> {
  const now = new Date();

  const [tokenRecord] = await db
    .select()
    .from(authTokens)
    .where(
      and(
        eq(authTokens.token, token),
        eq(authTokens.type, "set_password"),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, now)
      )
    )
    .limit(1);

  if (!tokenRecord) {
    throw new AuthError("Ce lien est invalide ou a expiré.", 400);
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash, emailVerified: true, updatedAt: now })
      .where(eq(users.id, tokenRecord.userId));

    await tx
      .update(authTokens)
      .set({ usedAt: now })
      .where(eq(authTokens.id, tokenRecord.id));
  });
}

// ---------------------------------------------------------------------------
// Change password — requires knowing the current password
// ---------------------------------------------------------------------------

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || !user.passwordHash) {
    throw new AuthError("Utilisateur introuvable.", 404);
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    throw new AuthError("Mot de passe actuel incorrect.", 401);
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

// ---------------------------------------------------------------------------
// Get user by session ID (for /me endpoint)
// ---------------------------------------------------------------------------

export async function getUserById(id: string): Promise<PublicUser | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  return user ? omitPassword(user) : null;
}
