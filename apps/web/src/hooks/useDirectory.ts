import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types — mirror the service layer in apps/api/src/services/directory.ts
// ---------------------------------------------------------------------------

export interface DirectoryCredential {
  credentialName: string;
  badgeUrl: string | null;
  issuedAt: string | null;
}

export interface DirectoryEntry {
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
  latitude: number | null;
  longitude: number | null;
  showOnMap: boolean;
  /** Only present for member-context callers if practitioner enabled toggle */
  phone?: string | null;
  email?: string | null;
  roadAddress?: string | null;
  credentials: DirectoryCredential[];
}

export interface DirectoryFilters {
  countries: string[];
  specialties: string[];
  credentialNames: string[];
}

export interface DirectoryListParams {
  search?: string;
  country?: string;
  specialty?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function fullName(
  entry: Pick<DirectoryEntry, "firstName" | "lastName">
): string {
  return (
    [entry.firstName, entry.lastName].filter(Boolean).join(" ") ||
    "Praticien·ne"
  );
}

export function initials(
  entry: Pick<DirectoryEntry, "firstName" | "lastName">
): string {
  return (
    [entry.firstName?.[0], entry.lastName?.[0]]
      .filter(Boolean)
      .join("")
      .toUpperCase() || "P"
  );
}

function buildQuery(params: DirectoryListParams): string {
  const q = new URLSearchParams();
  if (params.search) q.set("search", params.search);
  if (params.country) q.set("country", params.country);
  if (params.specialty) q.set("specialty", params.specialty);
  const qs = q.toString();
  return qs ? `?${qs}` : "";
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useDirectoryList(params: DirectoryListParams) {
  return useQuery<DirectoryEntry[]>({
    queryKey: ["directory", "list", params],
    queryFn: () =>
      api.get<DirectoryEntry[]>(`/directory${buildQuery(params)}`),
    staleTime: 2 * 60_000,
  });
}

export function useDirectoryFilters() {
  return useQuery<DirectoryFilters>({
    queryKey: ["directory", "filters"],
    queryFn: () => api.get<DirectoryFilters>("/directory/filters"),
    staleTime: 10 * 60_000,
  });
}

export function useDirectoryEntry(userId: string) {
  return useQuery<DirectoryEntry>({
    queryKey: ["directory", "entry", userId],
    queryFn: () => api.get<DirectoryEntry>(`/directory/${userId}`),
    staleTime: 5 * 60_000,
    enabled: !!userId,
  });
}
