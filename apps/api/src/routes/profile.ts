import { Router, type Request } from "express";
import multer from "multer";
import { eq } from "drizzle-orm";
import {
  users,
  userProfiles,
  accredibleCredentials,
  updateProfileSchema,
} from "@mhp/shared";
import { requireUser } from "../middleware/auth.js";
import { db } from "../db.js";
import { AppError } from "../lib/errors.js";
import { pushMemberProfileChanges } from "../services/sync.js";

const router = Router();

router.use(requireUser);

// ---------------------------------------------------------------------------
// Multer — memory storage, images only, 2 MB limit
// ---------------------------------------------------------------------------

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Seules les images sont acceptées.") as unknown as null, false);
    }
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Ensure the user's profile row exists; create a stub if needed. */
async function ensureProfile(userId: string) {
  const [existing] = await db
    .select({ id: userProfiles.id })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  if (!existing) {
    await db.insert(userProfiles).values({ userId });
  }
}

// ---------------------------------------------------------------------------
// GET /api/profile/me
// Returns: { user, profile, credentials }
// ---------------------------------------------------------------------------

router.get("/me", async (req: Request, res, next) => {
  try {
    const userId = req.session.userId!;

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "Utilisateur introuvable." });
      return;
    }

    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    const credentials = await db
      .select()
      .from(accredibleCredentials)
      .where(eq(accredibleCredentials.userId, userId));

    res.json({ user, profile: profile ?? null, credentials });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/profile/me
// Update personal info, address, or practice details
// ---------------------------------------------------------------------------

router.patch("/me", async (req: Request, res, next) => {
  try {
    const userId = req.session.userId!;
    const parsed = updateProfileSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new AppError("Données invalides.", 400);
    }

    const now = new Date();
    await ensureProfile(userId);

    const [updated] = await db
      .update(userProfiles)
      .set({ ...parsed.data, updatedAt: now })
      .where(eq(userProfiles.userId, userId))
      .returning();

    res.json(updated);

    const pushableKeys = [
      "firstName", "lastName", "phone", "roadAddress", "city",
      "cityCode", "countryCode", "birthdate", "nationality", "profession",
    ];
    const changedFields: Record<string, unknown> = {};
    for (const key of pushableKeys) {
      if (key in parsed.data) {
        changedFields[key] = (parsed.data as Record<string, unknown>)[key];
      }
    }
    if (Object.keys(changedFields).length > 0) {
      pushMemberProfileChanges(userId, changedFields).catch(() => {});
    }
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/profile/avatar
// Multipart upload — stores as base64 data URL in profileImageUrl
// ---------------------------------------------------------------------------

router.post(
  "/avatar",
  upload.single("avatar"),
  async (req: Request, res, next) => {
    try {
      const userId = req.session.userId!;

      if (!req.file) {
        throw new AppError("Aucun fichier fourni.", 400);
      }

      // Convert buffer to base64 data URL (MVP — no cloud storage)
      const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

      await ensureProfile(userId);

      await db
        .update(userProfiles)
        .set({ profileImageUrl: dataUrl, updatedAt: new Date() })
        .where(eq(userProfiles.userId, userId));

      res.json({ profileImageUrl: dataUrl });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
