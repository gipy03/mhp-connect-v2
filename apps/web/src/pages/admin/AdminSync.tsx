import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Database,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SyncStatus {
  service: string;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  errorLog?: string | null;
  programCount?: number | null;
  sessionCount?: number | null;
}

interface SyncResult {
  ok?: boolean;
  programCount?: number;
  sessionCount?: number;
  errors?: string[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function SyncStatusBadge({ status }: { status: string | null }) {
  if (status === "success") {
    return (
      <Badge variant="success" className="gap-1">
        <CheckCircle className="h-3 w-3" />
        Succès
      </Badge>
    );
  }
  if (status === "partial") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" />
        Partiel
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" />
        Erreur
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Inconnu
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// AdminSync
// ---------------------------------------------------------------------------

export default function AdminSync() {
  const qc = useQueryClient();
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [errorOpen, setErrorOpen] = useState(false);

  const { data: status, isLoading } = useQuery<SyncStatus>({
    queryKey: ["admin", "sync"],
    queryFn: () => api.get<SyncStatus>("/admin/sync"),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const runSync = useMutation({
    mutationFn: (type: "incremental" | "full") =>
      api.post<SyncResult>(`/admin/sync/${type}`, {}),
    onSuccess: (result) => {
      setLastResult(result);
      toast.success("Synchronisation terminée.", {
        description: result.programCount
          ? `${result.programCount} programme(s), ${result.sessionCount ?? 0} session(s)`
          : "Synchronisation effectuée.",
      });
      qc.invalidateQueries({ queryKey: ["admin", "sync"] });
      qc.invalidateQueries({ queryKey: ["programs"] });
    },
    onError: () => toast.error("Erreur lors de la synchronisation."),
  });

  const syncBexio = useMutation({
    mutationFn: () => api.post<{ ok: boolean }>("/programs/admin/sync", {}),
    onSuccess: () => {
      toast.success("Cache Bexio invalidé.");
      qc.invalidateQueries({ queryKey: ["programs"] });
    },
    onError: () => toast.error("Erreur lors de l'invalidation."),
  });

  const lastSyncTime = status?.lastSyncAt
    ? new Date(status.lastSyncAt).toLocaleString("fr-CH", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Jamais";

  return (
    <div className="max-w-2xl space-y-6 pb-12">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Synchronisation & Système</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Statut de la synchronisation DigiForma et du cache Bexio.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-5 w-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
        </div>
      ) : (
        <>
          {/* DigiForma sync status */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Synchronisation DigiForma</CardTitle>
                  <CardDescription>
                    Programmes, sessions et participants
                  </CardDescription>
                </div>
                <SyncStatusBadge status={status?.lastSyncStatus ?? null} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Dernière sync</p>
                  <p className="font-medium mt-0.5">{lastSyncTime}</p>
                </div>
                {status?.programCount != null && (
                  <div>
                    <p className="text-xs text-muted-foreground">Programmes</p>
                    <p className="font-medium mt-0.5">{status.programCount}</p>
                  </div>
                )}
                {status?.sessionCount != null && (
                  <div>
                    <p className="text-xs text-muted-foreground">Sessions</p>
                    <p className="font-medium mt-0.5">{status.sessionCount}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={runSync.isPending}
                  onClick={() => runSync.mutate("incremental")}
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${runSync.isPending ? "animate-spin" : ""}`}
                  />
                  {runSync.isPending ? "Sync en cours…" : "Sync incrémentiel"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={runSync.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        "La synchronisation complète peut prendre plusieurs minutes. Continuer ?"
                      )
                    )
                      runSync.mutate("full");
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Sync complet
                </Button>
              </div>

              {/* Error log */}
              {status?.errorLog && (
                <div>
                  <button
                    onClick={() => setErrorOpen((v) => !v)}
                    className="flex items-center gap-1.5 text-xs text-destructive hover:underline"
                  >
                    {errorOpen ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                    Journal d'erreurs
                  </button>
                  {errorOpen && (
                    <pre className="mt-2 rounded-lg bg-destructive/5 border border-destructive/20 p-3 text-[11px] font-mono text-destructive overflow-x-auto whitespace-pre-wrap">
                      {status.errorLog}
                    </pre>
                  )}
                </div>
              )}

              {/* Last sync result */}
              {lastResult && (
                <div className="rounded-lg bg-muted/40 border px-3 py-2">
                  <p className="text-xs font-medium">Résultat de la dernière sync :</p>
                  <pre className="mt-1 text-[11px] font-mono text-muted-foreground whitespace-pre-wrap">
                    {JSON.stringify(lastResult, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bexio cache */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Cache Bexio</CardTitle>
                  <CardDescription>
                    Articles et tarifs synchronisés depuis Bexio
                  </CardDescription>
                </div>
                <Database className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Invalidez le cache pour forcer une resynchronisation des articles Bexio
                (utilisé pour les tarifs et la facturation).
              </p>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={syncBexio.isPending}
                onClick={() => syncBexio.mutate()}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${syncBexio.isPending ? "animate-spin" : ""}`}
                />
                {syncBexio.isPending ? "Invalidation…" : "Invalider le cache Bexio"}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
