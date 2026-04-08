import { and, eq, inArray } from "drizzle-orm";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import {
  programEnrollments,
  programFeatureGrants,
} from "@mhp/shared";
import { db } from "../db.js";

// ---------------------------------------------------------------------------
// Feature key messages shown in 403 responses
// ---------------------------------------------------------------------------

const FEATURE_MESSAGES: Record<string, string> = {
  directory:
    "L'accès à l'annuaire des praticiens nécessite une certification OMNI Praticien.",
  community:
    "L'accès à la communauté nécessite une formation MHP complétée.",
  supervision:
    "L'accès à la supervision nécessite une certification OMNI Praticien.",
  offers:
    "L'accès aux offres professionnelles nécessite une certification OMNI Praticien.",
};

// ---------------------------------------------------------------------------
// resolveUserFeatures
//
// Algorithm (SPEC §3.3):
//   1. Fetch user's programEnrollments with status "active" or "completed".
//   2. Fetch programFeatureGrants for those program codes.
//   3. For each grant:
//        credentialRequired=false → any active/completed enrollment unlocks it
//        credentialRequired=true  → only a "completed" enrollment unlocks it
//                                   ("completed" is set by the Accredible webhook)
//   4. Admins: full feature set without DB queries (caller's responsibility to
//      short-circuit before calling this function).
// ---------------------------------------------------------------------------

export async function resolveUserFeatures(
  userId: string
): Promise<Set<string>> {
  const enrollments = await db
    .select({
      programCode: programEnrollments.programCode,
      status: programEnrollments.status,
    })
    .from(programEnrollments)
    .where(
      and(
        eq(programEnrollments.userId, userId),
        inArray(programEnrollments.status, ["active", "completed"])
      )
    );

  if (enrollments.length === 0) return new Set();

  const enrolledCodes = enrollments.map((e) => e.programCode);

  const grants = await db
    .select({
      programCode: programFeatureGrants.programCode,
      featureKey: programFeatureGrants.featureKey,
      credentialRequired: programFeatureGrants.credentialRequired,
    })
    .from(programFeatureGrants)
    .where(inArray(programFeatureGrants.programCode, enrolledCodes));

  const features = new Set<string>();

  for (const grant of grants) {
    const enrollment = enrollments.find(
      (e) => e.programCode === grant.programCode
    );
    if (!enrollment) continue;

    if (!grant.credentialRequired) {
      // Paid enrollment suffices (community, etc.)
      features.add(grant.featureKey);
    } else if (enrollment.status === "completed") {
      // Credential-gated: enrollment is "completed" iff Accredible webhook fired
      features.add(grant.featureKey);
    }
  }

  return features;
}

// ---------------------------------------------------------------------------
// requireFeature — Express middleware factory
//
// - Admins bypass the check entirely.
// - If req.features is already populated (by a prior resolveCallerContext or
//   another requireFeature call), it is reused to avoid a second DB round-trip.
// - Attaches the resolved Set to req.features for downstream handlers.
// ---------------------------------------------------------------------------

export function requireFeature(featureKey: string): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      res.status(401).json({ error: "Non authentifié." });
      return;
    }

    // Admins have all features
    if (req.session.role === "admin") {
      next();
      return;
    }

    try {
      if (!req.features) {
        req.features = await resolveUserFeatures(req.session.userId);
      }

      if (!req.features.has(featureKey)) {
        res.status(403).json({
          error:
            FEATURE_MESSAGES[featureKey] ??
            "Accès refusé. Cette fonctionnalité n'est pas disponible.",
          featureKey,
          locked: true,
        });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
