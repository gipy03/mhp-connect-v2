import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Users,
  ScrollText,
  RotateCcw,
  RefreshCw,
  Receipt,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  UserPlus,
  LayoutDashboard,
} from "lucide-react";
import { api } from "@/lib/api";
import { AdminPageShell } from "@/components/AdminPageShell";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DashboardData {
  users: { total: number; newThisMonth: number };
  enrollments: { active: number; completed: number; refunded: number; total: number };
  pendingRefunds: number;
  sync: { lastSyncAt: string | null; lastSyncStatus: string | null };
  invoices: { total: number; paid: number; pending: number };
  recentActivity: {
    id: string;
    action: string;
    detail: string | null;
    targetType: string | null;
    createdAt: string | null;
  }[];
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  href,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  accent?: boolean;
}) {
  const content = (
    <div
      className={cn(
        "rounded-xl border p-4 sm:p-5 space-y-2 transition-colors",
        href && "hover:bg-accent/50 cursor-pointer"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
          <Icon className={cn("h-4 w-4", accent ? "text-[hsl(82,40%,35%)]" : "text-muted-foreground")} />
        </div>
        {href && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{sub}</p>}
      </div>
    </div>
  );

  if (href) {
    return <Link to={href}>{content}</Link>;
  }
  return content;
}

function QuickAction({
  label,
  href,
  icon: Icon,
}: {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      to={href}
      className="flex items-center gap-3 rounded-lg border px-4 py-3 hover:bg-accent/50 transition-colors"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <span className="text-sm font-medium">{label}</span>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
    </Link>
  );
}

function SyncStatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge variant="secondary">Jamais</Badge>;
  if (status === "success")
    return (
      <Badge variant="success" className="gap-1">
        <CheckCircle className="h-3 w-3" /> OK
      </Badge>
    );
  if (status === "error")
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertCircle className="h-3 w-3" /> Erreur
      </Badge>
    );
  return <Badge variant="secondary">{status}</Badge>;
}

export default function AdminDashboard() {
  const { data, isLoading, isError } = useQuery<DashboardData>({
    queryKey: ["admin", "dashboard"],
    queryFn: () => api.get<DashboardData>("/admin/dashboard"),
    staleTime: 30_000,
  });

  return (
    <AdminPageShell title="Tableau de bord" description="Vue d'ensemble de l'activité.">
      {isError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Erreur lors du chargement des données.
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border p-4 sm:p-5 space-y-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Utilisateurs"
              value={data.users.total}
              sub={`+${data.users.newThisMonth} ce mois`}
              icon={Users}
              href="/admin/users"
              accent
            />
            <StatCard
              label="Inscriptions actives"
              value={data.enrollments.active}
              sub={`${data.enrollments.total} au total`}
              icon={ScrollText}
              href="/admin/enrollments"
            />
            <StatCard
              label="Remboursements en attente"
              value={data.pendingRefunds}
              icon={RotateCcw}
              href="/admin/refunds"
              accent={data.pendingRefunds > 0}
            />
            <StatCard
              label="Factures Bexio"
              value={data.invoices.total}
              sub={`${data.invoices.paid} payées, ${data.invoices.pending} en attente`}
              icon={Receipt}
              href="/admin/invoices"
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Inscriptions terminées"
              value={data.enrollments.completed}
              icon={CheckCircle}
            />
            <StatCard
              label="Inscriptions remboursées"
              value={data.enrollments.refunded}
              icon={RotateCcw}
            />
            <StatCard
              label="Nouveaux utilisateurs"
              value={data.users.newThisMonth}
              sub="ce mois-ci"
              icon={UserPlus}
            />
            <div className="rounded-xl border p-4 sm:p-5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                </div>
                <SyncStatusBadge status={data.sync.lastSyncStatus} />
              </div>
              <div>
                <p className="text-sm font-medium">Dernière sync</p>
                <p className="text-xs text-muted-foreground">
                  {data.sync.lastSyncAt
                    ? new Date(data.sync.lastSyncAt).toLocaleString("fr-CH", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Jamais"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h2 className="text-sm font-semibold tracking-tight">Actions rapides</h2>
              <div className="space-y-2">
                <QuickAction label="Gérer les utilisateurs" href="/admin/users" icon={Users} />
                <QuickAction label="Voir les inscriptions" href="/admin/enrollments" icon={ScrollText} />
                <QuickAction label="Synchroniser les données" href="/admin/sync" icon={RefreshCw} />
                <QuickAction label="Voir les factures" href="/admin/invoices" icon={Receipt} />
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold tracking-tight">Activité récente</h2>
              <div className="rounded-xl border divide-y">
                {data.recentActivity.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    Aucune activité récente.
                  </div>
                ) : (
                  data.recentActivity.map((activity) => (
                    <div key={activity.id} className="px-4 py-3 flex items-start gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted shrink-0 mt-0.5">
                        <TrendingUp className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">{activity.action}</p>
                        {activity.detail && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {activity.detail}
                          </p>
                        )}
                        {activity.createdAt && (
                          <p className="text-[11px] text-muted-foreground/60 mt-1 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(activity.createdAt).toLocaleString("fr-CH", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AdminPageShell>
  );
}
