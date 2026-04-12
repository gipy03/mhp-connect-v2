import { useMemo, useCallback } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  type CatalogueProgram,
  type CatalogueByCategory,
  upcomingSessions,
} from "@/hooks/useCatalogue";

export interface CatalogueSearchParams {
  q?: string;
  category?: string;
  sort?: string;
  view?: "grid" | "list";
  priceMin?: number;
  priceMax?: number;
  duration?: string;
  availability?: string;
  modality?: string;
  tags?: string;
  favoris?: boolean;
}

export type SortOption =
  | "next_session"
  | "price_asc"
  | "price_desc"
  | "duration"
  | "name_az";

const SORT_LABELS: Record<SortOption, string> = {
  next_session: "Prochaine session",
  price_asc: "Prix croissant",
  price_desc: "Prix décroissant",
  duration: "Durée",
  name_az: "Nom A-Z",
};

export function getSortOptions() {
  return Object.entries(SORT_LABELS) as [SortOption, string][];
}

function flattenPrograms(catalogue: CatalogueByCategory[]): CatalogueProgram[] {
  return catalogue.flatMap((c) => c.programs);
}

function getPrice(program: CatalogueProgram): number {
  const cost = program.digiforma?.costs?.[0]?.cost;
  if (cost != null && cost > 0) return cost;
  const activeTiers = program.pricingTiers.filter((t) => t.active);
  if (activeTiers.length > 0) {
    return Math.min(...activeTiers.map((t) => parseFloat(t.amount)));
  }
  return 0;
}

function getDuration(program: CatalogueProgram): number {
  return program.durationInDays ?? program.digiforma?.durationInDays ?? 0;
}

function matchesSearch(program: CatalogueProgram, query: string): boolean {
  const q = query.toLowerCase();
  if (program.name.toLowerCase().includes(q)) return true;
  if (program.description?.toLowerCase().includes(q)) return true;
  if (program.tags.some((t) => t.toLowerCase().includes(q))) return true;
  if (program.instructors?.some((t) => t.name.toLowerCase().includes(q))) return true;
  return false;
}

function getSessionModality(program: CatalogueProgram): "remote" | "in_person" | "hybrid" | null {
  const sessions = upcomingSessions(program.sessions);
  if (sessions.length === 0) return null;
  const hasRemote = sessions.some((s) => s.remote);
  const hasInPerson = sessions.some((s) => !s.remote);
  if (hasRemote && hasInPerson) return "hybrid";
  if (hasRemote) return "remote";
  return "in_person";
}

export function useCatalogueFilters(catalogue: CatalogueByCategory[] | undefined) {
  const search = useSearch({ strict: false }) as CatalogueSearchParams;
  const navigate = useNavigate();

  const setFilters = useCallback(
    (updates: Partial<CatalogueSearchParams>) => {
      navigate({
        to: "/catalogue",
        search: (prev: Record<string, unknown>) => {
          const next: Record<string, unknown> = { ...prev, ...updates };
          Object.keys(next).forEach((k) => {
            const v = next[k];
            if (v === undefined || v === "" || v === null || v === false) delete next[k];
          });
          return next as CatalogueSearchParams;
        },
        replace: true,
      });
    },
    [navigate]
  );

  const resetFilters = useCallback(() => {
    navigate({ to: "/catalogue", search: {}, replace: true });
  }, [navigate]);

  const allPrograms = useMemo(
    () => (catalogue ? flattenPrograms(catalogue) : []),
    [catalogue]
  );

  const categories = useMemo(() => {
    if (!catalogue) return [];
    const cats = catalogue.map((c) => ({
      name: c.category,
      count: c.programs.length,
    }));
    return cats;
  }, [catalogue]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    allPrograms.forEach((p) => p.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [allPrograms]);

  const filtered = useMemo(() => {
    let results = [...allPrograms];

    if (search.q) {
      results = results.filter((p) => matchesSearch(p, search.q!));
    }

    if (search.category) {
      results = results.filter((p) => p.category === search.category);
    }

    if (search.priceMin != null) {
      results = results.filter((p) => getPrice(p) >= search.priceMin!);
    }
    if (search.priceMax != null) {
      results = results.filter((p) => getPrice(p) <= search.priceMax!);
    }

    if (search.duration) {
      const dur = search.duration;
      results = results.filter((p) => {
        const d = getDuration(p);
        if (dur === "1") return d === 1;
        if (dur === "2") return d === 2;
        if (dur === "3+") return d >= 3;
        return true;
      });
    }

    if (search.availability === "available") {
      results = results.filter((p) => upcomingSessions(p.sessions).length > 0);
    }

    if (search.modality) {
      const mod = search.modality;
      results = results.filter((p) => {
        const m = getSessionModality(p);
        if (mod === "remote") return m === "remote" || m === "hybrid";
        if (mod === "in_person") return m === "in_person" || m === "hybrid";
        if (mod === "hybrid") return m === "hybrid";
        return true;
      });
    }

    if (search.tags) {
      const selectedTags = search.tags.split(",");
      results = results.filter((p) =>
        selectedTags.some((t) => p.tags.includes(t))
      );
    }

    const sort = (search.sort as SortOption) || "next_session";
    results.sort((a, b) => {
      switch (sort) {
        case "next_session": {
          const aNext = upcomingSessions(a.sessions)[0]?.startDate;
          const bNext = upcomingSessions(b.sessions)[0]?.startDate;
          const aTime = aNext ? new Date(aNext).getTime() : Infinity;
          const bTime = bNext ? new Date(bNext).getTime() : Infinity;
          return aTime - bTime;
        }
        case "price_asc":
          return getPrice(a) - getPrice(b);
        case "price_desc":
          return getPrice(b) - getPrice(a);
        case "duration":
          return getDuration(a) - getDuration(b);
        case "name_az":
          return a.name.localeCompare(b.name, "fr");
        default:
          return a.sortOrder - b.sortOrder;
      }
    });

    return results;
  }, [allPrograms, search]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (search.q) count++;
    if (search.category) count++;
    if (search.priceMin != null || search.priceMax != null) count++;
    if (search.duration) count++;
    if (search.availability) count++;
    if (search.modality) count++;
    if (search.tags) count++;
    if (search.favoris) count++;
    return count;
  }, [search]);

  return {
    search,
    setFilters,
    resetFilters,
    filtered,
    categories,
    allTags,
    activeFilterCount,
    view: (search.view as "grid" | "list") || "grid",
  };
}
