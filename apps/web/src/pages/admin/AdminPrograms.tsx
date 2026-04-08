import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BookOpen, PlusCircle, CheckCircle, FileEdit, Minus } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DigiformaProgram {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  durationInDays: number | null;
}

interface ProgramOverride {
  id: string;
  programCode: string;
  published: boolean;
  displayName: string | null;
  category: string | null;
  sortOrder: number;
  updatedAt: string | null;
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function OverrideStatus({ override }: { override: ProgramOverride | undefined }) {
  if (!override) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <Minus className="h-3 w-3" />
        Aucun override
      </Badge>
    );
  }
  if (override.published) {
    return (
      <Badge variant="success" className="gap-1">
        <CheckCircle className="h-3 w-3" />
        Publié
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <FileEdit className="h-3 w-3" />
      Brouillon
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// AdminPrograms
// ---------------------------------------------------------------------------

export default function AdminPrograms() {
  const { data: programs = [], isLoading: loadingPrograms } =
    useQuery<DigiformaProgram[]>({
      queryKey: ["admin", "programs", "digiforma"],
      queryFn: () => api.get<DigiformaProgram[]>("/programs/admin/digiforma"),
      staleTime: 5 * 60_000,
    });

  const { data: overrides = [], isLoading: loadingOverrides } =
    useQuery<ProgramOverride[]>({
      queryKey: ["admin", "programs", "overrides"],
      queryFn: () => api.get<ProgramOverride[]>("/programs/admin/overrides"),
      staleTime: 2 * 60_000,
    });

  const overrideMap = new Map(overrides.map((o) => [o.programCode, o]));
  const isLoading = loadingPrograms || loadingOverrides;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Programmes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLoading ? "Chargement…" : `${programs.length} programme${programs.length !== 1 ? "s" : ""} DigiForma`}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-5 w-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
        </div>
      ) : programs.length === 0 ? (
        <div className="rounded-xl border border-dashed py-14 text-center text-sm text-muted-foreground">
          Aucun programme DigiForma disponible.
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Programme</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Code</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Statut</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Catégorie</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {programs.map((prog, i) => {
                const override = prog.code ? overrideMap.get(prog.code) : undefined;
                return (
                  <tr
                    key={prog.id}
                    className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate max-w-[200px]">
                          {override?.displayName ?? prog.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="font-mono text-xs text-muted-foreground">
                        {prog.code ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <OverrideStatus override={override} />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                      {override?.category ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {prog.code ? (
                        <Button variant="ghost" size="sm" className="text-xs gap-1" asChild>
                          <Link
                            to="/user/admin/programs/$code"
                            params={{ code: prog.code }}
                          >
                            <FileEdit className="h-3.5 w-3.5" />
                            Éditer
                          </Link>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Pas de code</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
