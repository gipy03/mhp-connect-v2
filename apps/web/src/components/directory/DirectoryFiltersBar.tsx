import { useState, useEffect, useCallback } from "react";
import { Search, X } from "lucide-react";
import { type DirectoryFilters, type DirectoryListParams } from "@/hooks/useDirectory";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DirectoryFiltersBarProps {
  filters?: DirectoryFilters;
  onParamsChange: (params: DirectoryListParams) => void;
}

// ---------------------------------------------------------------------------
// Shared input / select class
// ---------------------------------------------------------------------------

const inputCls =
  "rounded-md border border-input bg-background text-sm " +
  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

// ---------------------------------------------------------------------------
// DirectoryFiltersBar
// ---------------------------------------------------------------------------

export function DirectoryFiltersBar({
  filters,
  onParamsChange,
}: DirectoryFiltersBarProps) {
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [specialty, setSpecialty] = useState("");

  // Debounce: propagate to parent 300 ms after last change
  useEffect(() => {
    const t = setTimeout(() => {
      onParamsChange({
        search: search.trim() || undefined,
        country: country || undefined,
        specialty: specialty || undefined,
      });
    }, 300);
    return () => clearTimeout(t);
  }, [search, country, specialty, onParamsChange]);

  const reset = useCallback(() => {
    setSearch("");
    setCountry("");
    setSpecialty("");
  }, []);

  const hasFilters = search || country || specialty;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {/* Free-text search */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          placeholder="Nom, ville, cabinet..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputCls} w-full pl-9 pr-3 py-2`}
        />
      </div>

      {/* Country dropdown */}
      <select
        value={country}
        onChange={(e) => setCountry(e.target.value)}
        className={`${inputCls} px-3 py-2 cursor-pointer`}
        aria-label="Filtrer par pays"
      >
        <option value="">Tous les pays</option>
        {filters?.countries.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      {/* Specialty dropdown */}
      <select
        value={specialty}
        onChange={(e) => setSpecialty(e.target.value)}
        className={`${inputCls} px-3 py-2 cursor-pointer`}
        aria-label="Filtrer par spécialité"
      >
        <option value="">Toutes les spécialités</option>
        {filters?.specialties.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      {/* Reset */}
      {hasFilters && (
        <button
          onClick={reset}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
        >
          <X className="h-3.5 w-3.5" />
          Réinitialiser
        </button>
      )}
    </div>
  );
}
