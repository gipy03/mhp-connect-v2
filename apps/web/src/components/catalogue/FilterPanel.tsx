import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { CatalogueSearchParams } from "@/hooks/useCatalogueFilters";

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

interface FilterPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  search: CatalogueSearchParams;
  setFilters: (updates: Partial<CatalogueSearchParams>) => void;
  resetFilters: () => void;
  allTags: string[];
  activeFilterCount: number;
}

const DURATION_OPTIONS = [
  { value: "1", label: "1 jour" },
  { value: "2", label: "2 jours" },
  { value: "3+", label: "3+ jours" },
];

const AVAILABILITY_OPTIONS = [
  { value: "", label: "Toutes" },
  { value: "available", label: "Sessions disponibles" },
];

const MODALITY_OPTIONS = [
  { value: "", label: "Toutes" },
  { value: "in_person", label: "Présentiel" },
  { value: "remote", label: "En ligne" },
  { value: "hybrid", label: "Hybride" },
];

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </Label>
      {children}
    </div>
  );
}

function FilterContent({
  search,
  setFilters,
  resetFilters,
  allTags,
  activeFilterCount,
}: Omit<FilterPanelProps, "open" | "onOpenChange">) {
  const selectedTags = search.tags ? search.tags.split(",") : [];

  const toggleTag = (tag: string) => {
    const current = new Set(selectedTags);
    if (current.has(tag)) {
      current.delete(tag);
    } else {
      current.add(tag);
    }
    const next = Array.from(current).join(",");
    setFilters({ tags: next || undefined });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="text-sm font-semibold">Filtres</h3>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={resetFilters}>
            Réinitialiser
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        <FilterSection label="Fourchette de prix (CHF)">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Min"
              value={search.priceMin ?? ""}
              onChange={(e) =>
                setFilters({ priceMin: e.target.value ? Number(e.target.value) : undefined })
              }
              className="h-8 text-xs"
            />
            <span className="text-muted-foreground text-xs">–</span>
            <Input
              type="number"
              placeholder="Max"
              value={search.priceMax ?? ""}
              onChange={(e) =>
                setFilters({ priceMax: e.target.value ? Number(e.target.value) : undefined })
              }
              className="h-8 text-xs"
            />
          </div>
        </FilterSection>

        <FilterSection label="Durée">
          <div className="flex flex-wrap gap-1.5">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                  search.duration === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                )}
                onClick={() =>
                  setFilters({ duration: search.duration === opt.value ? undefined : opt.value })
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </FilterSection>

        <FilterSection label="Disponibilité">
          <div className="flex flex-wrap gap-1.5">
            {AVAILABILITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                  (search.availability || "") === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                )}
                onClick={() => setFilters({ availability: opt.value || undefined })}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </FilterSection>

        <FilterSection label="Modalité">
          <div className="flex flex-wrap gap-1.5">
            {MODALITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                  (search.modality || "") === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                )}
                onClick={() => setFilters({ modality: opt.value || undefined })}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </FilterSection>

        {allTags.length > 0 && (
          <FilterSection label="Tags">
            <div className="flex flex-wrap gap-1.5">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  className={cn(
                    "px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors border",
                    selectedTags.includes(tag)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted text-muted-foreground border-border"
                  )}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                  {selectedTags.includes(tag) && <X className="h-3 w-3 ml-1 inline" />}
                </button>
              ))}
            </div>
          </FilterSection>
        )}
      </div>
    </div>
  );
}

export function FilterPanel(props: FilterPanelProps) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    if (!props.open) return null;
    return (
      <aside className="w-[280px] shrink-0 rounded-xl border bg-card self-start sticky top-4">
        <FilterContent
          search={props.search}
          setFilters={props.setFilters}
          resetFilters={props.resetFilters}
          allTags={props.allTags}
          activeFilterCount={props.activeFilterCount}
        />
      </aside>
    );
  }

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent side="right" className="w-[320px] sm:w-[360px] p-0">
        <FilterContent
          search={props.search}
          setFilters={props.setFilters}
          resetFilters={props.resetFilters}
          allTags={props.allTags}
          activeFilterCount={props.activeFilterCount}
        />
      </SheetContent>
    </Sheet>
  );
}
