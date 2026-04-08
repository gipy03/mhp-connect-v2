import { and, eq, inArray } from "drizzle-orm";
import {
  userProfiles,
  users,
  accredibleCredentials,
  type UserProfile,
} from "@mhp/shared";
import { db } from "../db.js";
import { AppError } from "../lib/errors.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type CallerContext = "public" | "member" | null;

export type DirectoryListingParams = {
  search?: string;
  country?: string;
  specialty?: string;
};

export type DirectoryEntry = {
  userId: string;
  slugId: number;
  firstName: string | null;
  lastName: string | null;
  practiceName: string | null;
  city: string | null;
  country: string | null;
  specialties: string[] | null;
  bio: string | null;
  website: string | null;
  profileImageUrl: string | null;
  directoryVisibility: string;
  // Map — coordinates only shown when showOnMap is true
  latitude: number | null;
  longitude: number | null;
  showOnMap: boolean;
  // Contact — only included for member callers per individual toggle settings
  phone?: string | null;
  email?: string | null;
  roadAddress?: string | null;
  // Credential badges
  credentials: Array<{
    credentialName: string;
    badgeUrl: string | null;
    issuedAt: Date | null;
  }>;
};

export type DirectoryFilters = {
  countries: string[];
  specialties: string[];
  credentialNames: string[];
};

// ---------------------------------------------------------------------------
// getListings
// ---------------------------------------------------------------------------

export async function getListings(
  params: DirectoryListingParams,
  callerContext: CallerContext
): Promise<DirectoryEntry[]> {
  const visibleTiers = callerContext === "member"
    ? ["public", "internal"]
    : ["public"];

  const rows = await db
    .select({ profile: userProfiles, email: users.email })
    .from(userProfiles)
    .innerJoin(users, eq(userProfiles.userId, users.id))
    .where(inArray(userProfiles.directoryVisibility, visibleTiers));

  // JS-layer filtering (search, country, specialty) keeps SQL simple and
  // avoids unnest/tsvector complexity for a small directory dataset.
  let filtered = rows;

  if (params.country) {
    const c = params.country.toLowerCase();
    filtered = filtered.filter(
      (r) => r.profile.country?.toLowerCase() === c
    );
  }

  if (params.specialty) {
    const s = params.specialty.toLowerCase();
    filtered = filtered.filter((r) =>
      r.profile.specialties?.some((sp) => sp.toLowerCase().includes(s))
    );
  }

  if (params.search) {
    const q = params.search.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.profile.firstName?.toLowerCase().includes(q) ||
        r.profile.lastName?.toLowerCase().includes(q) ||
        r.profile.practiceName?.toLowerCase().includes(q) ||
        r.profile.city?.toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) return [];

  const userIds = filtered.map((r) => r.profile.userId);
  const creds = await db
    .select({
      userId: accredibleCredentials.userId,
      credentialName: accredibleCredentials.credentialName,
      badgeUrl: accredibleCredentials.badgeUrl,
      issuedAt: accredibleCredentials.issuedAt,
    })
    .from(accredibleCredentials)
    .where(inArray(accredibleCredentials.userId, userIds));

  const credsByUser = groupCredsByUser(creds);

  return filtered.map((r) =>
    serialize(
      r.profile,
      r.email,
      credsByUser.get(r.profile.userId) ?? [],
      callerContext
    )
  );
}

// ---------------------------------------------------------------------------
// getEntry
// ---------------------------------------------------------------------------

export async function getEntry(
  userId: string,
  callerContext: CallerContext
): Promise<DirectoryEntry> {
  const visibleTiers = callerContext === "member"
    ? ["public", "internal"]
    : ["public"];

  const [row] = await db
    .select({ profile: userProfiles, email: users.email })
    .from(userProfiles)
    .innerJoin(users, eq(userProfiles.userId, users.id))
    .where(
      and(
        eq(userProfiles.userId, userId),
        inArray(userProfiles.directoryVisibility, visibleTiers)
      )
    )
    .limit(1);

  if (!row) throw new AppError("Praticien introuvable.", 404);

  const creds = await db
    .select({
      userId: accredibleCredentials.userId,
      credentialName: accredibleCredentials.credentialName,
      badgeUrl: accredibleCredentials.badgeUrl,
      issuedAt: accredibleCredentials.issuedAt,
    })
    .from(accredibleCredentials)
    .where(eq(accredibleCredentials.userId, userId));

  return serialize(row.profile, row.email, creds, callerContext);
}

// ---------------------------------------------------------------------------
// getFilters
// ---------------------------------------------------------------------------

export async function getFilters(
  callerContext: CallerContext
): Promise<DirectoryFilters> {
  const visibleTiers = callerContext === "member"
    ? ["public", "internal"]
    : ["public"];

  const profiles = await db
    .select({
      userId: userProfiles.userId,
      country: userProfiles.country,
      specialties: userProfiles.specialties,
    })
    .from(userProfiles)
    .where(inArray(userProfiles.directoryVisibility, visibleTiers));

  const countries = [...new Set(
    profiles.map((p) => p.country).filter((c): c is string => !!c)
  )].sort();

  const specialtiesSet = new Set<string>();
  for (const p of profiles) {
    for (const s of p.specialties ?? []) {
      if (s) specialtiesSet.add(s);
    }
  }
  const specialties = [...specialtiesSet].sort();

  const userIds = profiles.map((p) => p.userId);
  let credentialNames: string[] = [];
  if (userIds.length > 0) {
    const creds = await db
      .selectDistinct({ credentialName: accredibleCredentials.credentialName })
      .from(accredibleCredentials)
      .where(inArray(accredibleCredentials.userId, userIds));
    credentialNames = creds.map((c) => c.credentialName).sort();
  }

  return { countries, specialties, credentialNames };
}

// ---------------------------------------------------------------------------
// updateVisibility
// ---------------------------------------------------------------------------

export async function updateVisibility(
  userId: string,
  visibility: "hidden" | "internal" | "public"
): Promise<UserProfile> {
  const [updated] = await db
    .update(userProfiles)
    .set({ directoryVisibility: visibility, updatedAt: new Date() })
    .where(eq(userProfiles.userId, userId))
    .returning();

  if (!updated) throw new AppError("Profil introuvable.", 404);
  return updated;
}

// ---------------------------------------------------------------------------
// updateContactToggles
// ---------------------------------------------------------------------------

export async function updateContactToggles(
  userId: string,
  toggles: Partial<{
    showPhone: boolean;
    showEmail: boolean;
    showAddress: boolean;
    showOnMap: boolean;
  }>
): Promise<UserProfile> {
  const [updated] = await db
    .update(userProfiles)
    .set({ ...toggles, updatedAt: new Date() })
    .where(eq(userProfiles.userId, userId))
    .returning();

  if (!updated) throw new AppError("Profil introuvable.", 404);
  return updated;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type CredRow = {
  userId: string | null;
  credentialName: string;
  badgeUrl: string | null;
  issuedAt: Date | null;
};

function groupCredsByUser(creds: CredRow[]): Map<string, CredRow[]> {
  const map = new Map<string, CredRow[]>();
  for (const c of creds) {
    if (!c.userId) continue;
    if (!map.has(c.userId)) map.set(c.userId, []);
    map.get(c.userId)!.push(c);
  }
  return map;
}

function serialize(
  profile: typeof userProfiles.$inferSelect,
  email: string,
  creds: CredRow[],
  callerContext: CallerContext
): DirectoryEntry {
  const isMember = callerContext === "member";

  const entry: DirectoryEntry = {
    userId: profile.userId,
    slugId: profile.slugId,
    firstName: profile.firstName ?? null,
    lastName: profile.lastName ?? null,
    practiceName: profile.practiceName ?? null,
    city: profile.city ?? null,
    country: profile.country ?? null,
    specialties: profile.specialties ?? null,
    bio: profile.bio ?? null,
    website: profile.website ?? null,
    profileImageUrl: profile.profileImageUrl ?? null,
    directoryVisibility: profile.directoryVisibility,
    latitude: profile.showOnMap ? (profile.latitude ?? null) : null,
    longitude: profile.showOnMap ? (profile.longitude ?? null) : null,
    showOnMap: profile.showOnMap,
    credentials: creds.map((c) => ({
      credentialName: c.credentialName,
      badgeUrl: c.badgeUrl ?? null,
      issuedAt: c.issuedAt ?? null,
    })),
  };

  if (isMember) {
    if (profile.showPhone) entry.phone = profile.phone ?? null;
    if (profile.showEmail) entry.email = email;
    if (profile.showAddress) entry.roadAddress = profile.roadAddress ?? null;
  }

  return entry;
}
