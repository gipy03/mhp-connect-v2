import { useState, useCallback, useEffect } from "react";
import { LayoutGrid, Map } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  useDirectoryList,
  useDirectoryFilters,
  type DirectoryListParams,
} from "@/hooks/useDirectory";
import { DirectoryCard } from "@/components/directory/DirectoryCard";
import { DirectoryFiltersBar } from "@/components/directory/DirectoryFiltersBar";
import { DirectoryMap } from "@/components/directory/DirectoryMap";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// View toggle button
// ---------------------------------------------------------------------------

function ViewToggle({
  view,
  onChange,
}: {
  view: "grid" | "map";
  onChange: (v: "grid" | "map") => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border p-1">
      <button
        onClick={() => onChange("grid")}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
          view === "grid"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Grille
      </button>
      <button
        onClick={() => onChange("map")}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
          view === "map"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Map className="h-3.5 w-3.5" />
        Carte
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 12;

// ---------------------------------------------------------------------------
// DirectoryPage — shared between /annuaire (public) and /user/annuaire (member)
// ---------------------------------------------------------------------------

export default function DirectoryPage() {
  const { isAuthenticated } = useAuth();

  const [params, setParams] = useState<DirectoryListParams>({});
  const [view, setView] = useState<"grid" | "map">("grid");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const { data: entries = [], isLoading, isError } = useDirectoryList(params);
  const { data: filterOptions } = useDirectoryFilters();

  // Reset pagination when filters change
  const handleParamsChange = useCallback((p: DirectoryListParams) => {
    setParams(p);
    setVisibleCount(PAGE_SIZE);
  }, []);

  // SEO for public route only
  useEffect(() => {
    if (!isAuthenticated) {
      const prev = document.title;
      document.title = "Annuaire des praticiens — mhp | connect";
      const meta = document.querySelector('meta[name="description"]');
      const prevContent = meta?.getAttribute("content") ?? "";
      meta?.setAttribute(
        "content",
        "Trouvez un praticien certifié MHP près de chez vous. Consultez les profils, spécialités et coordonnées."
      );
      return () => {
        document.title = prev;
        meta?.setAttribute("content", prevContent);
      };
    }
  }, [isAuthenticated]);

  const visible = entries.slice(0, visibleCount);
  const hasMore = visibleCount < entries.length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Annuaire des praticiens
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLoading
              ? "Chargement..."
              : `${entries.length} praticien${entries.length !== 1 ? "s" : ""} trouvé${entries.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <ViewToggle view={view} onChange={setView} />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Filters                                                             */}
      {/* ------------------------------------------------------------------ */}
      <DirectoryFiltersBar
        filters={filterOptions}
        onParamsChange={handleParamsChange}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Content                                                             */}
      {/* ------------------------------------------------------------------ */}
      {isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
          Impossible de charger l'annuaire. Réessayez dans un instant.
        </div>
      ) : isLoading ? (
        /* Skeleton grid */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border bg-card p-5 animate-pulse space-y-3"
            >
              <div className="flex gap-4">
                <div className="h-14 w-14 rounded-full bg-muted shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-3 w-3/4 rounded bg-muted" />
                  <div className="h-2.5 w-1/2 rounded bg-muted" />
                  <div className="h-2.5 w-2/3 rounded bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        /* Empty state */
        <div className="rounded-xl border border-dashed py-16 flex flex-col items-center gap-3 text-center">
          <p className="text-sm font-medium">Aucun praticien trouvé</p>
          <p className="text-xs text-muted-foreground">
            Essayez d'autres filtres ou réinitialisez la recherche.
          </p>
        </div>
      ) : view === "grid" ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((entry) => (
              <DirectoryCard key={entry.userId} entry={entry} />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() =>
                  setVisibleCount((n) => Math.min(n + PAGE_SIZE, entries.length))
                }
              >
                Voir plus ({entries.length - visibleCount} restants)
              </Button>
            </div>
          )}
        </>
      ) : (
        /* Map view — show all entries (not just visible slice) */
        <DirectoryMap entries={entries} heightClass="h-[560px]" />
      )}
    </div>
  );
}
