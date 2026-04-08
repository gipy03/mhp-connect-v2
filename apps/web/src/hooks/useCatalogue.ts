import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types — mirrors the CatalogueProgram shape returned by the backend
// ---------------------------------------------------------------------------

export interface PricingTier {
  id: string;
  programCode: string;
  pricingType: string; // standard | retake | earlybird | group | custom
  label: string;
  amount: string; // decimal stored as string in DB
  unit: string; // total | per_day | per_session
  currency: string;
  conditions: { requiresCredential?: boolean; programCodes?: string[] } | null;
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;
}

export interface CalendarSession {
  id: string;
  name: string;
  code: string | null;
  startDate: string | null;
  endDate: string | null;
  place: string | null;
  placeName: string | null;
  remote: boolean;
  inter: boolean;
  program: { id: string; name: string; code: string | null } | null;
  image: { url: string; filename: string } | null;
  dates: { date: string; startTime: string | null; endTime: string | null }[];
}

export interface DigiformaDetail {
  goals: { text: string }[] | null;
  steps: { text: string; substeps: { text: string }[] }[] | null;
  assessments: { text: string }[] | null;
  costs: { cost: number }[] | null;
  capacity: { active: boolean; max: number | null; min: number | null } | null;
  satisfactionRate: { evaluationsCount: number; score: number } | null;
  certificationModality: string | null;
  trainingModality: string | null;
  admissionModality: string | null;
  graduationModality: string | null;
  durationInDays: number | null;
  durationInHours: number | null;
  duration: string | null;
}

export interface CatalogueProgram {
  programCode: string;
  digiformaId: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  tags: string[];
  category: string | null;
  sortOrder: number;
  highlightLabel: string | null;
  published: boolean;
  sessions: CalendarSession[];
  durationInDays: number | null;
  durationInHours: number | null;
  pricingTiers: PricingTier[];
  digiforma: DigiformaDetail | null;
}

export interface CatalogueByCategory {
  category: string;
  programs: CatalogueProgram[];
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Format a date range in French, e.g. "14 – 16 mars 2025" */
export function formatSessionDateRange(
  startDate: string | null,
  endDate: string | null
): string {
  if (!startDate) return "Date à confirmer";
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;

  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("fr-CH", opts).format(d);

  if (!end || start.toDateString() === end.toDateString()) {
    return fmt(start, { day: "numeric", month: "long", year: "numeric" });
  }

  const sameMonth =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth();

  if (sameMonth) {
    return `${fmt(start, { day: "numeric" })} – ${fmt(end, { day: "numeric", month: "long", year: "numeric" })}`;
  }

  const sameYear = start.getFullYear() === end.getFullYear();
  if (sameYear) {
    return `${fmt(start, { day: "numeric", month: "long" })} – ${fmt(end, { day: "numeric", month: "long", year: "numeric" })}`;
  }

  return `${fmt(start, { day: "numeric", month: "long", year: "numeric" })} – ${fmt(end, { day: "numeric", month: "long", year: "numeric" })}`;
}

/** Format price as "CHF 3'900.-" or "CHF 850.- / jour" */
export function formatPrice(
  amount: string,
  currency = "CHF",
  unit = "total"
): string {
  const n = parseFloat(amount);
  const formatted = new Intl.NumberFormat("fr-CH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
  const suffix =
    unit === "per_day"
      ? " / jour"
      : unit === "per_session"
      ? " / session"
      : ".-";
  return `${currency} ${formatted}${unit === "total" ? ".-" : suffix}`;
}

/** Cheapest active standard (or any active) pricing tier */
export function cheapestTier(tiers: PricingTier[]): PricingTier | null {
  const active = tiers.filter((t) => t.active);
  if (active.length === 0) return null;
  const standard = active.filter((t) => t.pricingType === "standard");
  const pool = standard.length > 0 ? standard : active;
  return pool.slice().sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount))[0] ?? null;
}

/** Sessions that haven't started yet */
export function upcomingSessions(sessions: CalendarSession[]): CalendarSession[] {
  const now = Date.now();
  return sessions.filter(
    (s) => !s.startDate || new Date(s.startDate).getTime() > now
  );
}

// ---------------------------------------------------------------------------
// usePrograms — full catalogue list
// ---------------------------------------------------------------------------

export function usePrograms() {
  return useQuery<CatalogueByCategory[]>({
    queryKey: ["programs"],
    queryFn: () => api.get<CatalogueByCategory[]>("/programs"),
    staleTime: 5 * 60_000,
  });
}

// ---------------------------------------------------------------------------
// useProgram — single programme detail
// ---------------------------------------------------------------------------

export function useProgram(code: string) {
  return useQuery<CatalogueProgram>({
    queryKey: ["programs", code],
    queryFn: () => api.get<CatalogueProgram>(`/programs/${code}`),
    staleTime: 5 * 60_000,
    enabled: !!code,
  });
}
