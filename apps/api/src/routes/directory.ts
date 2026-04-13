import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../middleware/auth.js";
import { resolveUserFeatures, requireFeature } from "../middleware/featureAccess.js";
import {
  getListings,
  getEntry,
  getFilters,
  updateVisibility,
  updateContactToggles,
  type CallerContext,
} from "../services/directory.js";
import { AppError } from "../lib/errors.js";

const router = Router();

// ---------------------------------------------------------------------------
// resolveCallerContext — optional auth with feature-aware member detection
//
// - Unauthenticated → "public" (sees only directoryVisibility="public" entries)
// - Admin → "member" always (full directory access)
// - Authenticated member WITH "directory" feature grant → "member"
//   (sees public + internal entries, contact details per toggles)
// - Authenticated member WITHOUT "directory" feature grant → "public"
//   (same view as an anonymous visitor until they earn the credential)
// ---------------------------------------------------------------------------

async function resolveCallerContext(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.session.userId) {
    (req as Request & { callerContext: CallerContext }).callerContext = "public";
    next();
    return;
  }

  if (req.session.adminUserId) {
    (req as Request & { callerContext: CallerContext }).callerContext = "member";
    next();
    return;
  }

  try {
    // Reuse req.features if already populated by a prior middleware
    if (!req.features) {
      req.features = await resolveUserFeatures(req.session.userId);
    }
    (req as Request & { callerContext: CallerContext }).callerContext =
      req.features.has("directory") ? "member" : "public";
    next();
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Public + member read routes
// ---------------------------------------------------------------------------

// GET /api/directory
router.get("/", resolveCallerContext, async (req, res, next) => {
  try {
    const ctx = (req as Request & { callerContext: CallerContext }).callerContext;
    const { search, country, specialty } = req.query as Record<string, string | undefined>;
    const listings = await getListings({ search, country, specialty }, ctx);
    res.json(listings);
  } catch (err) {
    next(err);
  }
});

// GET /api/directory/filters
// Note: defined before /:userId so Express matches this first
router.get("/filters", resolveCallerContext, async (req, res, next) => {
  try {
    const ctx = (req as Request & { callerContext: CallerContext }).callerContext;
    const filters = await getFilters(ctx);
    res.json(filters);
  } catch (err) {
    next(err);
  }
});

// GET /api/directory/:userId
router.get("/:userId", resolveCallerContext, async (req, res, next) => {
  try {
    const ctx = (req as Request & { callerContext: CallerContext }).callerContext;
    const entry = await getEntry(req.params.userId as string, ctx);
    res.json(entry);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Authenticated member: self-service listing management
// Requires directory feature grant — only credentialed practitioners should
// be managing their listing.
// ---------------------------------------------------------------------------

// PATCH /api/directory/me/visibility
router.patch(
  "/me/visibility",
  requireAuth,
  requireFeature("directory"),
  async (req, res, next) => {
    try {
      const { visibility } = req.body as { visibility: unknown };
      if (!["hidden", "internal", "public"].includes(visibility as string)) {
        throw new AppError(
          "`visibility` doit être 'hidden', 'internal' ou 'public'.",
          400
        );
      }
      const profile = await updateVisibility(
        req.session.userId!,
        visibility as "hidden" | "internal" | "public"
      );
      res.json(profile);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/directory/me/contact-toggles
router.patch(
  "/me/contact-toggles",
  requireAuth,
  requireFeature("directory"),
  async (req, res, next) => {
    try {
      const { showPhone, showEmail, showAddress, showOnMap } = req.body as {
        showPhone?: unknown;
        showEmail?: unknown;
        showAddress?: unknown;
        showOnMap?: unknown;
      };

      const toggles: Parameters<typeof updateContactToggles>[1] = {};
      if (typeof showPhone === "boolean") toggles.showPhone = showPhone;
      if (typeof showEmail === "boolean") toggles.showEmail = showEmail;
      if (typeof showAddress === "boolean") toggles.showAddress = showAddress;
      if (typeof showOnMap === "boolean") toggles.showOnMap = showOnMap;

      if (Object.keys(toggles).length === 0) {
        throw new AppError("Aucun toggle fourni.", 400);
      }

      const profile = await updateContactToggles(req.session.userId!, toggles);
      res.json(profile);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
