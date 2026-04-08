import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  Users,
  RotateCcw,
  Bell,
  RefreshCw,
  Activity,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SyncStatus {
  service: string;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
}

// ---------------------------------------------------------------------------
// Quick stat card
// ---------------------------------------------------------------------------

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  href,
}: {
  title: string;
  value: React.ReactNode;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}) {
  return (
    <Link to={href as "/user/admin"}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer group">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {title}
            </CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-2xl font-bold">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </CardContent>
      </Card>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Admin dashboard
// ---------------------------------------------------------------------------

export default function AdminIndex() {
  const { data: syncStatus } = useQuery<SyncStatus>({
    queryKey: ["admin", "sync"],
    queryFn: () => api.get<SyncStatus>("/admin/sync"),
    staleTime: 60_000,
  });

  const syncIcon =
    syncStatus?.lastSyncStatus === "success" ? (
      <CheckCircle className="h-4 w-4 text-emerald-500" />
    ) : syncStatus?.lastSyncStatus === "error" ? (
      <XCircle className="h-4 w-4 text-destructive" />
    ) : (
      <Clock className="h-4 w-4 text-amber-500" />
    );

  const lastSync = syncStatus?.lastSyncAt
    ? new Date(syncStatus.lastSyncAt).toLocaleString("fr-CH", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Jamais";

  const ADMIN_LINKS = [
    { label: "Programmes", href: "/user/admin/programs", icon: BookOpen },
    { label: "Utilisateurs", href: "/user/admin/users", icon: Users },
    { label: "Remboursements", href: "/user/admin/refunds", icon: RotateCcw },
    { label: "Notifications", href: "/user/admin/notifications", icon: Bell },
    { label: "Synchronisation", href: "/user/admin/sync", icon: RefreshCw },
    { label: "Activité", href: "/user/admin/activity", icon: Activity },
  ];

  return (
    <div className="max-w-4xl space-y-8 pb-12">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Administration</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestion de la plateforme mhp | connect
        </p>
      </div>

      {/* Sync status banner */}
      <div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-3">
        {syncIcon}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            Sync DigiForma — {syncStatus?.lastSyncStatus ?? "inconnu"}
          </p>
          <p className="text-xs text-muted-foreground">Dernière exécution : {lastSync}</p>
        </div>
        <Link
          to="/user/admin/sync"
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Gérer
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Navigation cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {ADMIN_LINKS.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            to={href as "/user/admin"}
            className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:bg-accent transition-colors group"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
              <Icon className="h-4.5 w-4.5 text-muted-foreground" />
            </div>
            <span className="text-sm font-medium">{label}</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 ml-auto group-hover:text-muted-foreground transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
