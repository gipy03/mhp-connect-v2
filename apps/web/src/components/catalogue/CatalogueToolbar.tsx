import { Search, SlidersHorizontal, LayoutGrid, LayoutList, Heart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getSortOptions, type CatalogueSearchParams } from "@/hooks/useCatalogueFilters";

interface CategoryInfo {
  name: string;
  count: number;
}

interface CatalogueToolbarProps {
  search: CatalogueSearchParams;
  setFilters: (updates: Partial<CatalogueSearchParams>) => void;
  categories: CategoryInfo[];
  totalCount: number;
  activeFilterCount: number;
  view: "grid" | "list";
  onOpenFilters: () => void;
  isAuthenticated: boolean;
}

export function CatalogueToolbar({
  search,
  setFilters,
  categories,
  totalCount,
  activeFilterCount,
  view,
  onOpenFilters,
  isAuthenticated,
}: CatalogueToolbarProps) {
  const sortOptions = getSortOptions();

  return (
    <div className="sticky top-14 z-30 bg-background/95 backdrop-blur-sm border-b -mx-4 sm:-mx-6 px-4 sm:px-6">
      <div className="py-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une formation…"
              value={search.q || ""}
              onChange={(e) => setFilters({ q: e.target.value || undefined })}
              className="pl-9 h-9 text-sm"
            />
          </div>

          <Select
            value={search.sort || "next_session"}
            onValueChange={(v) => setFilters({ sort: v === "next_session" ? undefined : v })}
          >
            <SelectTrigger className="w-[140px] sm:w-[180px] h-9 text-xs">
              <span className="truncate">
                {sortOptions.find(([v]) => v === (search.sort || "next_session"))?.[1] ?? "Trier par…"}
              </span>
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center border rounded-md">
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-9 w-9 rounded-r-none", view === "grid" && "bg-muted")}
              onClick={() => setFilters({ view: "grid" })}
              aria-label="Vue grille"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-9 w-9 rounded-l-none", view === "list" && "bg-muted")}
              onClick={() => setFilters({ view: "list" })}
              aria-label="Vue liste"
            >
              <LayoutList className="h-4 w-4" />
            </Button>
          </div>

          {isAuthenticated && (
            <Button
              variant={search.favoris ? "default" : "outline"}
              size="sm"
              className="h-9 text-xs gap-1.5"
              onClick={() => setFilters({ favoris: search.favoris ? undefined : true })}
            >
              <Heart className={cn("h-3.5 w-3.5", search.favoris && "fill-current")} />
              Favoris
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-9 text-xs gap-1.5 relative"
            onClick={onOpenFilters}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filtres</span>
            {activeFilterCount > 0 && (
              <Badge className="absolute -top-1.5 -right-1.5 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-primary text-primary-foreground">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
          <button
            className={cn(
              "shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors",
              !search.category
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            )}
            onClick={() => setFilters({ category: undefined })}
          >
            Tous ({totalCount})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.name}
              className={cn(
                "shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors",
                search.category === cat.name
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              )}
              onClick={() =>
                setFilters({
                  category: search.category === cat.name ? undefined : cat.name,
                })
              }
            >
              {cat.name} ({cat.count})
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
