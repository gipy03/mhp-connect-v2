import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  activeFilterCount: number;
  onReset: () => void;
}

export function EmptyState({ activeFilterCount, onReset }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center animate-fade-in">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <SearchX className="h-8 w-8 text-muted-foreground/40" />
      </div>
      <div className="space-y-1.5 max-w-sm">
        <h3 className="text-base font-semibold tracking-tight">
          Aucun résultat
        </h3>
        <p className="text-sm text-muted-foreground">
          {activeFilterCount > 0
            ? "Aucune formation ne correspond à vos critères de recherche. Essayez de modifier vos filtres."
            : "Aucun programme publié pour le moment."}
        </p>
      </div>
      {activeFilterCount > 0 && (
        <Button variant="outline" size="sm" onClick={onReset}>
          Réinitialiser les filtres
        </Button>
      )}
    </div>
  );
}
