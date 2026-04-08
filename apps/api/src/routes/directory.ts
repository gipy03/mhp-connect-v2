import { Router, type Request, type Response, type NextFunction } from "express";
import { requireAuth } from "../middleware/auth.js";
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
// Optional auth middleware — resolves caller context without blocking
// unauthenticated requests. Member context is granted to any logged-in user.
// ---------------------------------------------------------------------------

function resolveCallerContext(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  // Session populated by the global session middleware — just read it
  (req as Request & { callerContext: CallerContext }).callerContext =
    req.session.userId ? "member" : "public";
  next();
}

// ---------------------------------------------------------------------------
// Public + member routes
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
    const entry = await getEntry(req.params.userId, ctx);
    res.json(entry);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Authenticated member: self-service visibility and contact toggle management
// ---------------------------------------------------------------------------

// PATCH /api/directory/me/visibility
router.patch("/me/visibility", requireAuth, async (req, res, next) => {
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
});

// PATCH /api/directory/me/contact-toggles
router.patch("/me/contact-toggles", requireAuth, async (req, res, next) => {
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
});

export default router;
