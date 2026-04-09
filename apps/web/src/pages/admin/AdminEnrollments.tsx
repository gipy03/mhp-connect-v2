import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Users, CheckCircle, RotateCcw, Clock, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdminStats {
  active: number;
  completed: number;
  refunded: number;
  total: number;
  recentCount: number;
  unpaidCount: number;
}

interface SessionInfo {
  sessionId: string;
  status: string;
}

interface EnrollmentRow {
  id: string;
  userId: string;
  programCode: string;
  status: string;
  enrolledAt: string;
  bexioDocumentNr: string | null;
  bexioTotal: string | null;
  bexioInvoiceId: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  currentSession: SessionInfo | null;
}

// ---------------------------------------------------------------------------
// AdminEnrollments
// ---------------------------------------------------------------------------

export default function AdminEnrollments() {
  const { data: stats } = useQuery<AdminStats>({
    queryKey: ["admin", "stats"],
    queryFn: () => api.get<AdminStats>("/admin/stats"),
    staleTime: 60_000,
  });

  const { data: enrollments = [], isLoading, isError } = useQuery<EnrollmentRow[]>({
    queryKey: ["admin", "enrollments"],
    queryFn: () => api.get<EnrollmentRow[]>("/admin/enrollments"),
    staleTime: 30_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Inscriptions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vue d'ensemble des inscriptions aux programmes.
        </p>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard
            label="Total"
            value={stats.total}
            icon={Users}
          />
          <StatCard
            label="Actives"
            value={stats.active}
            icon={CheckCircle}
            highlight="success"
          />
          <StatCard
            label="Terminées"
            value={stats.completed}
            icon={CheckCircle}
          />
          <StatCard
            label="Remboursées"
            value={stats.refunded}
            icon={RotateCcw}
            highlight="warning"
          />
          <StatCard
            label="30 derniers jours"
            value={stats.recentCount}
            icon={Clock}
          />
        </div>
      )}

      {stats?.unpaidCount !== undefined && stats.unpaidCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
          <span>
            <strong>{stats.unpaidCount}</strong> inscription{stats.unpaidCount !== 1 ? "s" : ""} active{stats.unpaidCount !== 1 ? "s" : ""} sans facture Bexio.
          </span>
        </div>
      )}

      {/* Enrollment table */}
      <div className="rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <p className="text-xs text-muted-foreground">
            {enrollments.length} inscription{enrollments.length !== 1 ? "s" : ""}
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
          </div>
        ) : isError ? (
          <div className="flex items-center gap-2 justify-center py-12 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            Erreur lors du chargement.
          </div>
        ) : enrollments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            Aucune inscription.
          </p>
        ) : (
          <>
            {/* Mobile card layout */}
            <div className="divide-y sm:hidden">
              {enrollments.map((e) => (
                <EnrollmentCard key={e.id} row={e} />
              ))}
            </div>

            {/* Desktop table layout */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/20 text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="px-4 py-2.5 text-left font-medium">Participant</th>
                    <th className="px-4 py-2.5 text-left font-medium">Programme</th>
                    <th className="px-4 py-2.5 text-left font-medium">Statut</th>
                    <th className="px-4 py-2.5 text-left font-medium">Session</th>
                    <th className="px-4 py-2.5 text-left font-medium">Facture</th>
                    <th className="px-4 py-2.5 text-left font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {enrollments.map((e) => (
                    <EnrollmentRow key={e.id} row={e} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EnrollmentRow
// ---------------------------------------------------------------------------

const STATUS_MAP: Record<string, { label: string; variant: "success" | "secondary" | "warning" | "destructive" | "outline" }> = {
  active: { label: "Actif", variant: "success" },
  completed: { label: "Terminé", variant: "secondary" },
  refunded: { label: "Remboursé", variant: "warning" },
  cancelled: { label: "Annulé", variant: "destructive" },
};

function EnrollmentCard({ row }: { row: EnrollmentRow }) {
  const name = [row.firstName, row.lastName].filter(Boolean).join(" ") || row.email;
  const statusCfg = STATUS_MAP[row.status] ?? { label: row.status, variant: "outline" as const };

  return (
    <div className="px-4 py-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium truncate">{name}</p>
        <Badge variant={statusCfg.variant} className="text-xs shrink-0">{statusCfg.label}</Badge>
      </div>
      <p className="text-xs text-muted-foreground truncate">{row.email}</p>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="font-mono">{row.programCode}</span>
        <span>
          {new Date(row.enrolledAt).toLocaleDateString("fr-CH", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
      </div>
    </div>
  );
}

function EnrollmentRow({ row }: { row: EnrollmentRow }) {
  const name = [row.firstName, row.lastName].filter(Boolean).join(" ") || row.email;
  const statusCfg = STATUS_MAP[row.status] ?? { label: row.status, variant: "outline" as const };

  return (
    <tr className="hover:bg-accent/30 transition-colors">
      <td className="px-4 py-2.5">
        <p className="font-medium truncate max-w-[160px]">{name}</p>
        <p className="text-xs text-muted-foreground truncate max-w-[160px]">{row.email}</p>
      </td>
      <td className="px-4 py-2.5">
        <span className="font-mono text-xs">{row.programCode}</span>
      </td>
      <td className="px-4 py-2.5">
        <Badge variant={statusCfg.variant} className="text-xs">{statusCfg.label}</Badge>
      </td>
      <td className="px-4 py-2.5">
        {row.currentSession ? (
          <div>
            <span className="font-mono text-xs">{row.currentSession.sessionId}</span>
            <span className="ml-1.5 text-xs text-muted-foreground capitalize">({row.currentSession.status})</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        {row.bexioDocumentNr ? (
          <div>
            <p className="text-xs">{row.bexioDocumentNr}</p>
            {row.bexioTotal && <p className="text-xs text-muted-foreground">{row.bexioTotal} CHF</p>}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
        {new Date(row.enrolledAt).toLocaleDateString("fr-CH", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: "success" | "warning";
}) {
  return (
    <div className="rounded-xl border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className={`h-3.5 w-3.5 ${
          highlight === "success" ? "text-green-500" :
          highlight === "warning" ? "text-amber-500" :
          "text-muted-foreground"
        }`} />
      </div>
      <p className={`text-2xl font-bold tabular-nums ${
        highlight === "success" ? "text-green-600" :
        highlight === "warning" ? "text-amber-600" :
        "text-foreground"
      }`}>
        {value}
      </p>
    </div>
  );
}
