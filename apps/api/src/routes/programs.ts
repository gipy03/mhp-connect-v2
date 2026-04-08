import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import {
  getPublishedPrograms,
  getProgramByCode,
  upsertOverride,
  togglePublished,
  createPricingTier,
  updatePricingTier,
  deletePricingTier,
  createFeatureGrant,
  deleteFeatureGrant,
  getAllDigiformaPrograms,
  getBexioArticles,
  invalidateExternalCache,
} from "../services/program.js";
import { AppError } from "../lib/errors.js";
import { db } from "../db.js";
import { programOverrides, programOverrideBodySchema } from "@mhp/shared";

const router = Router();

// ---------------------------------------------------------------------------
// Public catalogue
// ---------------------------------------------------------------------------

// GET /api/programs
router.get("/", async (_req, res, next) => {
  try {
    const catalogue = await getPublishedPrograms();
    res.json(catalogue);
  } catch (err) {
    next(err);
  }
});

// GET /api/programs/:code
router.get("/:code", async (req, res, next) => {
  try {
    const program = await getProgramByCode(req.params.code as string);
    res.json(program);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Admin: DigiForma / Bexio raw data
// ---------------------------------------------------------------------------

// GET /api/programs/admin/digiforma
// Returns all DigiForma programs with an `override` field indicating whether
// a programOverride row exists and whether it is published.
router.get("/admin/digiforma", requireAdmin, async (_req, res, next) => {
  try {
    const [programs, overrides] = await Promise.all([
      getAllDigiformaPrograms(),
      db
        .select({
          programCode: programOverrides.programCode,
          published: programOverrides.published,
        })
        .from(programOverrides),
    ]);

    const overrideMap = new Map(
      overrides.map((o) => [o.programCode, { programCode: o.programCode, published: o.published }])
    );

    const result = programs.map((p) => ({
      ...p,
      override: p.code ? (overrideMap.get(p.code) ?? null) : null,
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/programs/admin/bexio-articles
router.get("/admin/bexio-articles", requireAdmin, async (_req, res, next) => {
  try {
    const articles = await getBexioArticles();
    res.json(articles);
  } catch (err) {
    next(err);
  }
});

// POST /api/programs/admin/sync — invalidate external cache
router.post("/admin/sync", requireAdmin, async (_req, res, next) => {
  try {
    invalidateExternalCache();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Admin: overrides CRUD
// ---------------------------------------------------------------------------

// PUT /api/programs/admin/:code/override
router.put("/admin/:code/override", requireAdmin, async (req, res, next) => {
  try {
    const parsed = programOverrideBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Données invalides.", issues: parsed.error.issues });
      return;
    }
    const override = await upsertOverride(req.params.code as string, parsed.data);
    res.json(override);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/programs/admin/:code/published
router.patch(
  "/admin/:code/published",
  requireAdmin,
  async (req, res, next) => {
    try {
      const { published } = req.body as { published: unknown };
      if (typeof published !== "boolean") {
        throw new AppError("`published` doit être un booléen.", 400);
      }
      const override = await togglePublished(req.params.code as string, published);
      res.json(override);
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Admin: pricing tiers
// ---------------------------------------------------------------------------

// POST /api/programs/admin/:code/pricing
router.post("/admin/:code/pricing", requireAdmin, async (req, res, next) => {
  try {
    const tier = await createPricingTier(req.params.code as string, req.body);
    res.status(201).json(tier);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/programs/admin/pricing/:tierId
router.patch(
  "/admin/pricing/:tierId",
  requireAdmin,
  async (req, res, next) => {
    try {
      const tier = await updatePricingTier(req.params.tierId as string, req.body);
      res.json(tier);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/programs/admin/pricing/:tierId
router.delete(
  "/admin/pricing/:tierId",
  requireAdmin,
  async (req, res, next) => {
    try {
      await deletePricingTier(req.params.tierId as string);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Admin: feature grants
// ---------------------------------------------------------------------------

// POST /api/programs/admin/:code/grants
router.post("/admin/:code/grants", requireAdmin, async (req, res, next) => {
  try {
    const { featureKey, credentialRequired } = req.body as {
      featureKey: unknown;
      credentialRequired: unknown;
    };
    if (typeof featureKey !== "string" || !featureKey) {
      throw new AppError("`featureKey` requis.", 400);
    }
    if (typeof credentialRequired !== "boolean") {
      throw new AppError("`credentialRequired` doit être un booléen.", 400);
    }
    const grant = await createFeatureGrant(
      req.params.code as string,
      featureKey,
      credentialRequired,
      req.session.userId!
    );
    res.status(201).json(grant);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/programs/admin/grants/:grantId
router.delete(
  "/admin/grants/:grantId",
  requireAdmin,
  async (req, res, next) => {
    try {
      await deleteFeatureGrant(req.params.grantId as string);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
