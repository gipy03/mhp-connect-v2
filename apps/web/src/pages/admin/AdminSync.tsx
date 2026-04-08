import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, ChevronDown, ChevronUp, AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SyncStatus {
  id?: string;
  service: string;
  lastSyncAt: string | null;
  lastSyncStatus: "success" | "partial" | "error" | null;
  recordsCreated: number | null;
  recordsUpdated: number | null;
  recordsSkipped: number | null;
  errorLog: string | null;
}

interface SyncResult {
  service?: string;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  recordsCreated?: number;
  recordsUpdated?: number;
  recordsSkipped?: number;
  errorLog?: string | null;
}

// ---------------------------------------------------------------------------
// AdminSync
// ---------------------------------------------------------------------------

export default function AdminSync() {
  const qc = useQueryClient();
  const [showErrorLog, setShowErrorLog] = useState(false);

  const { data: syncStatus, isLoading, isError } = useQuery<SyncStatus>({
    queryKey: ["admin", "sync"],
    queryFn: () => api.get<SyncStatus>("/admin/sync"),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const incrementalMutation = useMutation({
    mutationFn: () => api.post<SyncResult>("/admin/sync/incremental", {}),
    onSuccess: (result) => {
      toast.success(
        `Sync incrémentiel terminé — ${result.recordsCreated ?? 0} créés, ${result.recordsUpdated ?? 0} mis à jour.`
      );
      qc.invalidateQueries({ queryKey: ["admin", "sync"] });
    },
    onError: () => toast.error("Erreur lors du sync incrémentiel."),
  });

  const fullMutation = useMutation({
    mutationFn: () => api.post<SyncResult>("/admin/sync/full", {}),
    onSuccess: (result) => {
      toast.success(
        `Sync complet terminé — ${result.recordsCreated ?? 0} créés, ${result.recordsUpdated ?? 0} mis à jour.`
      );
      qc.invalidateQueries({ queryKey: ["admin", "sync"] });
    },
    onError: () => toast.error("Erreur lors du sync complet."),
  });

  const bexioSyncMutation = useMutation({
    mutationFn: () => api.post<{ ok: boolean }>("/programs/admin/sync", {}),
    onSuccess: () => toast.success("Cache Bexio invalidé."),
    onError: () => toast.error("Erreur lors de l'invalidation du cache."),
  });

  const isSyncing = incrementalMutation.isPending || fullMutation.isPending;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Sync & Statut système</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Synchronisation DigiForma et état des caches externes.
        </p>
      </div>

      {/* DigiForma sync card */}
      <div className="rounded-xl border p-5 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <RefreshCw className={`h-4 w-4 text-muted-foreground ${isSyncing ? "animate-spin" : ""}`} />
            </div>
            <div>
              <p className="text-sm font-semibold">DigiForma</p>
              <p className="text-xs text-muted-foreground">Synchronisation des programmes et sessions</p>
            </div>
          </div>
          {syncStatus?.lastSyncStatus && (
            <SyncStatusBadge status={syncStatus.lastSyncStatus} />
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-3.5 w-3.5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
            Chargement…
          </div>
        ) : isError ? (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            Impossible de charger le statut.
          </div>
        ) : syncStatus ? (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCell
                label="Dernier sync"
                value={
                  syncStatus.lastSyncAt
                    ? new Date(syncStatus.lastSyncAt).toLocaleString("fr-CH", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"
                }
              />
              <StatCell label="Créés" value={String(syncStatus.recordsCreated ?? 0)} />
              <StatCell label="Mis à jour" value={String(syncStatus.recordsUpdated ?? 0)} />
              <StatCell label="Ignorés" value={String(syncStatus.recordsSkipped ?? 0)} />
            </div>

            {/* Error log */}
            {syncStatus.errorLog && (
              <div className="space-y-1">
                <button
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowErrorLog(!showErrorLog)}
                >
                  {showErrorLog ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  Journal d'erreurs
                </button>
                {showErrorLog && (
                  <pre className="rounded-lg bg-muted p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                    {syncStatus.errorLog}
                  </pre>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Aucune synchronisation effectuée.</p>
        )}

        <Separator />

        {/* Sync actions */}
        <div className="flex gap-3 flex-wrap">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => incrementalMutation.mutate()}
            disabled={isSyncing}
          >
            <RefreshCw className={`h-4 w-4 ${incrementalMutation.isPending ? "animate-spin" : ""}`} />
            {incrementalMutation.isPending ? "Sync en cours…" : "Sync incrémentiel"}
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              if (window.confirm("Lancer un sync complet ? Cette opération peut prendre plusieurs minutes."))
                fullMutation.mutate();
            }}
            disabled={isSyncing}
          >
            <RefreshCw className={`h-4 w-4 ${fullMutation.isPending ? "animate-spin" : ""}`} />
            {fullMutation.isPending ? "Sync en cours…" : "Sync complet"}
          </Button>
        </div>
      </div>

      {/* Bexio cache card */}
      <div className="rounded-xl border p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold">Cache Bexio</p>
            <p className="text-xs text-muted-foreground">
              Articles tarifaires en cache (TTL 5 min)
            </p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Le cache des articles Bexio est invalidé automatiquement toutes les 5 minutes.
          Utilisez ce bouton pour forcer une invalidation immédiate.
        </p>

        <Button
          variant="outline"
          className="gap-2"
          onClick={() => bexioSyncMutation.mutate()}
          disabled={bexioSyncMutation.isPending}
        >
          <RefreshCw className={`h-4 w-4 ${bexioSyncMutation.isPending ? "animate-spin" : ""}`} />
          {bexioSyncMutation.isPending ? "Invalidation…" : "Invalider le cache"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function SyncStatusBadge({ status }: { status: SyncStatus["lastSyncStatus"] }) {
  if (!status) return null;
  const map = {
    success: { label: "Succès", variant: "success" as const, icon: CheckCircle },
    partial: { label: "Partiel", variant: "warning" as const, icon: AlertTriangle },
    error: { label: "Erreur", variant: "destructive" as const, icon: AlertCircle },
  };
  const { label, variant, icon: Icon } = map[status];
  return (
    <Badge variant={variant} className="gap-1.5">
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold mt-0.5 tabular-nums">{value}</p>
    </div>
  );
}
