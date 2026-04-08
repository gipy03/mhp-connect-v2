import { and, asc, eq } from "drizzle-orm";
import {
  programFeatureGrants,
  programOverrides,
  programPricing,
  type ProgramFeatureGrant,
  type ProgramOverride,
  type ProgramPricing,
} from "@mhp/shared";
import {
  getAllPrograms,
  getAllTrainingSessions,
  type DigiformaCalendarSession,
  type DigiformaProgram,
} from "@mhp/integrations/digiforma";
import { fetchArticles, type BexioArticle } from "@mhp/integrations/bexio";
import { db } from "../db.js";
import { TTLCache } from "../lib/cache.js";
import { AppError } from "../lib/errors.js";

// ---------------------------------------------------------------------------
// Cache — shared across all requests, invalidated on admin sync
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const digiformaCache = new TTLCache<
  | DigiformaProgram[]
  | DigiformaCalendarSession[]
>(CACHE_TTL_MS);

const bexioCache = new TTLCache<BexioArticle[]>(CACHE_TTL_MS);

export function invalidateExternalCache(): void {
  digiformaCache.invalidate();
  bexioCache.invalidate();
}

// ---------------------------------------------------------------------------
// Internal data fetchers with caching
// ---------------------------------------------------------------------------

async function cachedDigiformaPrograms(): Promise<DigiformaProgram[]> {
  const cached = digiformaCache.get("programs") as DigiformaProgram[] | null;
  if (cached) return cached;
  const programs = await getAllPrograms();
  digiformaCache.set("programs", programs);
  return programs;
}

async function cachedDigiformaSessions(): Promise<DigiformaCalendarSession[]> {
  const cached = digiformaCache.get("sessions") as DigiformaCalendarSession[] | null;
  if (cached) return cached;
  const sessions = await getAllTrainingSessions();
  digiformaCache.set("sessions", sessions);
  return sessions;
}

async function cachedBexioArticles(): Promise<BexioArticle[]> {
  const cached = bexioCache.get("articles");
  if (cached) return cached;
  const articles = await fetchArticles();
  bexioCache.set("articles", articles);
  return articles;
}

// ---------------------------------------------------------------------------
// Public catalogue types
// ---------------------------------------------------------------------------

export type CatalogueProgram = {
  programCode: string;
  digiformaId: string | null;
  // Editorial (from override, falls back to DigiForma values)
  name: string;
  description: string | null;
  imageUrl: string | null;
  tags: string[];
  category: string | null;
  sortOrder: number;
  highlightLabel: string | null;
  published: boolean;
  // From DigiForma
  sessions: DigiformaCalendarSession[];
  durationInDays: number | null;
  durationInHours: number | null;
  // Pricing
  pricingTiers: ProgramPricing[];
  // Feature grants
  featureGrants: ProgramFeatureGrant[];
  // Raw sources (for admin views)
  override: ProgramOverride | null;
  digiforma: DigiformaProgram | null;
};

export type CatalogueByCategory = {
  category: string;
  programs: CatalogueProgram[];
}[];

// ---------------------------------------------------------------------------
// getPublishedPrograms — public catalogue, grouped by category
// ---------------------------------------------------------------------------

export async function getPublishedPrograms(): Promise<CatalogueByCategory> {
  const [dfPrograms, dfSessions, overrides, pricing] = await Promise.all([
    cachedDigiformaPrograms(),
    cachedDigiformaSessions(),
    db
      .select()
      .from(programOverrides)
      .where(eq(programOverrides.published, true))
      .orderBy(asc(programOverrides.sortOrder)),
    db
      .select()
      .from(programPricing)
      .where(eq(programPricing.active, true))
      .orderBy(asc(programPricing.pricingType)),
  ]);

  const dfByCode = new Map(
    dfPrograms
      .filter((p) => p.code)
      .map((p) => [p.code as string, p])
  );

  const sessionsByProgramCode = new Map<string, DigiformaCalendarSession[]>();
  for (const s of dfSessions) {
    const code = s.program?.code;
    if (code) {
      if (!sessionsByProgramCode.has(code)) sessionsByProgramCode.set(code, []);
      sessionsByProgramCode.get(code)!.push(s);
    }
  }

  const pricingByCode = new Map<string, ProgramPricing[]>();
  for (const tier of pricing) {
    if (!pricingByCode.has(tier.programCode))
      pricingByCode.set(tier.programCode, []);
    pricingByCode.get(tier.programCode)!.push(tier);
  }

  const merged: CatalogueProgram[] = overrides.map((override) => {
    const df = dfByCode.get(override.programCode) ?? null;
    return {
      programCode: override.programCode,
      digiformaId: df?.id ?? null,
      name: override.displayName ?? df?.name ?? override.programCode,
      description: override.description ?? df?.description ?? null,
      imageUrl: override.imageUrl ?? df?.image?.url ?? null,
      tags: override.tags ?? [],
      category: override.category ?? null,
      sortOrder: override.sortOrder,
      highlightLabel: override.highlightLabel ?? null,
      published: override.published,
      sessions: sessionsByProgramCode.get(override.programCode) ?? [],
      durationInDays: df?.durationInDays ?? null,
      durationInHours: df?.durationInHours ?? null,
      pricingTiers: pricingByCode.get(override.programCode) ?? [],
      featureGrants: [], // not loaded at list level — loaded per-program
      override,
      digiforma: df,
    };
  });

  // Group by category, preserving sortOrder within each group
  const grouped = new Map<string, CatalogueProgram[]>();
  for (const program of merged) {
    const key = program.category ?? "Autres";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(program);
  }

  return Array.from(grouped.entries()).map(([category, programs]) => ({
    category,
    programs,
  }));
}

// ---------------------------------------------------------------------------
// getProgramByCode — full detail including feature grants
// ---------------------------------------------------------------------------

export async function getProgramByCode(
  code: string
): Promise<CatalogueProgram> {
  const [dfPrograms, dfSessions, [override], pricing, grants] =
    await Promise.all([
      cachedDigiformaPrograms(),
      cachedDigiformaSessions(),
      db
        .select()
        .from(programOverrides)
        .where(eq(programOverrides.programCode, code))
        .limit(1),
      db
        .select()
        .from(programPricing)
        .where(eq(programPricing.programCode, code))
        .orderBy(asc(programPricing.pricingType)),
      db
        .select()
        .from(programFeatureGrants)
        .where(eq(programFeatureGrants.programCode, code)),
    ]);

  if (!override) {
    throw new AppError(`Programme "${code}" introuvable.`, 404);
  }

  const df =
    dfPrograms.find((p) => p.code === code) ?? null;

  const sessions = dfSessions.filter((s) => s.program?.code === code);

  return {
    programCode: override.programCode,
    digiformaId: df?.id ?? null,
    name: override.displayName ?? df?.name ?? code,
    description: override.description ?? df?.description ?? null,
    imageUrl: override.imageUrl ?? df?.image?.url ?? null,
    tags: override.tags ?? [],
    category: override.category ?? null,
    sortOrder: override.sortOrder,
    highlightLabel: override.highlightLabel ?? null,
    published: override.published,
    sessions,
    durationInDays: df?.durationInDays ?? null,
    durationInHours: df?.durationInHours ?? null,
    pricingTiers: pricing,
    featureGrants: grants,
    override,
    digiforma: df,
  };
}

// ---------------------------------------------------------------------------
// Admin: programOverrides CRUD
// ---------------------------------------------------------------------------

export async function upsertOverride(
  programCode: string,
  data: Partial<Omit<ProgramOverride, "id" | "programCode" | "createdAt" | "updatedAt">>
): Promise<ProgramOverride> {
  const now = new Date();

  const [existing] = await db
    .select({ id: programOverrides.id })
    .from(programOverrides)
    .where(eq(programOverrides.programCode, programCode))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(programOverrides)
      .set({ ...data, updatedAt: now })
      .where(eq(programOverrides.programCode, programCode))
      .returning();
    return updated!;
  }

  const [created] = await db
    .insert(programOverrides)
    .values({ programCode, ...data })
    .returning();
  return created!;
}

export async function togglePublished(
  programCode: string,
  published: boolean
): Promise<ProgramOverride> {
  const [updated] = await db
    .update(programOverrides)
    .set({ published, updatedAt: new Date() })
    .where(eq(programOverrides.programCode, programCode))
    .returning();

  if (!updated) {
    throw new AppError(`Override pour "${programCode}" introuvable.`, 404);
  }
  return updated;
}

// ---------------------------------------------------------------------------
// Admin: programPricing CRUD
// ---------------------------------------------------------------------------

export async function createPricingTier(
  programCode: string,
  data: Omit<ProgramPricing, "id" | "programCode" | "createdAt" | "updatedAt">
): Promise<ProgramPricing> {
  const [created] = await db
    .insert(programPricing)
    .values({ programCode, ...data })
    .returning();
  return created!;
}

export async function updatePricingTier(
  tierId: string,
  data: Partial<Omit<ProgramPricing, "id" | "programCode" | "createdAt" | "updatedAt">>
): Promise<ProgramPricing> {
  const [updated] = await db
    .update(programPricing)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(programPricing.id, tierId))
    .returning();

  if (!updated) throw new AppError("Tarif introuvable.", 404);
  return updated;
}

export async function deletePricingTier(tierId: string): Promise<void> {
  const deleted = await db
    .delete(programPricing)
    .where(eq(programPricing.id, tierId))
    .returning({ id: programPricing.id });

  if (!deleted.length) throw new AppError("Tarif introuvable.", 404);
}

// ---------------------------------------------------------------------------
// Admin: programFeatureGrants CRUD
// ---------------------------------------------------------------------------

export async function createFeatureGrant(
  programCode: string,
  featureKey: string,
  credentialRequired: boolean,
  createdBy: string
): Promise<ProgramFeatureGrant> {
  // Prevent duplicates
  const [existing] = await db
    .select({ id: programFeatureGrants.id })
    .from(programFeatureGrants)
    .where(
      and(
        eq(programFeatureGrants.programCode, programCode),
        eq(programFeatureGrants.featureKey, featureKey)
      )
    )
    .limit(1);

  if (existing) {
    throw new AppError(
      `Un accès "${featureKey}" est déjà configuré pour ce programme.`,
      409
    );
  }

  const [created] = await db
    .insert(programFeatureGrants)
    .values({ programCode, featureKey, credentialRequired, createdBy })
    .returning();
  return created!;
}

export async function deleteFeatureGrant(grantId: string): Promise<void> {
  const deleted = await db
    .delete(programFeatureGrants)
    .where(eq(programFeatureGrants.id, grantId))
    .returning({ id: programFeatureGrants.id });

  if (!deleted.length) throw new AppError("Accès introuvable.", 404);
}

// ---------------------------------------------------------------------------
// Admin: list raw DigiForma programs (for override setup UI)
// ---------------------------------------------------------------------------

export async function getAllDigiformaPrograms(): Promise<DigiformaProgram[]> {
  return cachedDigiformaPrograms();
}

export async function getBexioArticles(): Promise<BexioArticle[]> {
  return cachedBexioArticles();
}
