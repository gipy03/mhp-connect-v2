import { Router } from "express";
import { and, eq, gte, lte, or, isNull, sql } from "drizzle-orm";
import { offers } from "@mhp/shared";
import { requireAuth } from "../middleware/auth.js";
import { resolveUserFeatures } from "../middleware/featureAccess.js";
import { db } from "../db.js";

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(offers)
      .where(
        and(
          eq(offers.published, true),
          or(isNull(offers.validUntil), gte(offers.validUntil, sql`now()`)),
          or(isNull(offers.validFrom), lte(offers.validFrom, sql`now()`))
        )
      )
      .orderBy(offers.sortOrder);

    if (req.session.adminUserId) {
      res.json(rows);
      return;
    }

    const features = await resolveUserFeatures(req.session.userId!);

    const filtered = rows.filter((offer) => {
      if (offer.visibility === "all") return true;
      if (offer.visibility === "feature_gated") {
        if (!offer.requiredFeature) return false;
        return features.has(offer.requiredFeature);
      }
      return false;
    });

    res.json(filtered);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/track-click", async (req, res, next) => {
  try {
    const [offer] = await db
      .select({
        id: offers.id,
        published: offers.published,
        visibility: offers.visibility,
        requiredFeature: offers.requiredFeature,
        validFrom: offers.validFrom,
        validUntil: offers.validUntil,
      })
      .from(offers)
      .where(eq(offers.id, req.params.id))
      .limit(1);

    if (!offer || !offer.published) {
      res.status(404).json({ error: "Offre introuvable." });
      return;
    }

    const now = new Date();
    if (offer.validUntil && new Date(offer.validUntil) < now) {
      res.status(404).json({ error: "Offre expirée." });
      return;
    }
    if (offer.validFrom && new Date(offer.validFrom) > now) {
      res.status(404).json({ error: "Offre pas encore disponible." });
      return;
    }

    if (offer.visibility === "feature_gated" && !req.session.adminUserId) {
      if (!offer.requiredFeature) {
        res.status(403).json({ error: "Accès refusé." });
        return;
      }
      const features = await resolveUserFeatures(req.session.userId!);
      if (!features.has(offer.requiredFeature)) {
        res.status(403).json({ error: "Accès refusé." });
        return;
      }
    }

    await db
      .update(offers)
      .set({ clickCount: sql`${offers.clickCount} + 1` })
      .where(eq(offers.id, req.params.id));

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
