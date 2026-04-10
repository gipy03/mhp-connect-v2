import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, AlertCircle, Activity } from "lucide-react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AdminPageShell, AdminTableSkeleton, AdminEmptyState } from "@/components/AdminPageShell";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActivityLog {
  id: string;
  userId: string | null;
  action: string;
  detail: string | null;
  targetType: string | null;
  targetId: string | null;
  ipAddress: string | null;
  createdAt: string | null;
}

interface AdminUser {
  id: string;
  email: string;
  profile: { firstName: string | null; lastName: string | null } | null;
}

// ---------------------------------------------------------------------------
// AdminActivity
// ---------------------------------------------------------------------------

export default function AdminActivity() {
  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState<string>("");
  const [limit, setLimit] = useState(100);

  const { data: logs = [], isLoading, isError } = useQuery<ActivityLog[]>({
    queryKey: ["admin", "activity-logs", userFilter, limit],
    queryFn: () => {
      const params = new URLSearchParams();
      if (userFilter) params.set("userId", userFilter);
      params.set("limit", String(limit));
      return api.get<ActivityLog[]>(`/admin/activity-logs?${params.toString()}`);
    },
    staleTime: 15_000,
  });

  const { data: users = [] } = useQuery<AdminUser[]>({
    queryKey: ["admin", "users", "", ""],
    queryFn: () => api.get<AdminUser[]>("/admin/users"),
    staleTime: 5 * 60_000,
  });

  const filteredLogs = search
    ? logs.filter((log) => {
        const q = search.toLowerCase();
        return (
          log.action.toLowerCase().includes(q) ||
          log.detail?.toLowerCase().includes(q) ||
          log.ipAddress?.includes(q) ||
          log.targetType?.toLowerCase().includes(q)
        );
      })
    : logs;

  return (
    <AdminPageShell title="Journal d'activité" description="Historique des actions effectuées sur la plateforme.">

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrer par action, détail, IP…"
            className="pl-8 h-8 text-sm"
          />
        </div>

        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring h-8"
        >
          <option value="">Tous les utilisateurs</option>
          {users.map((u) => {
            const name =
              [u.profile?.firstName, u.profile?.lastName].filter(Boolean).join(" ") ||
              u.email;
            return (
              <option key={u.id} value={u.id}>
                {name}
              </option>
            );
          })}
        </select>

        <select
          value={String(limit)}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring h-8"
        >
          <option value="50">50 entrées</option>
          <option value="100">100 entrées</option>
          <option value="250">250 entrées</option>
          <option value="500">500 entrées</option>
        </select>
      </div>

      <div className="text-xs text-muted-foreground">
        {filteredLogs.length} entrée{filteredLogs.length !== 1 ? "s" : ""}
        {search && ` (filtrées sur "${search}")`}
      </div>

      {/* Table */}
      {isError ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Erreur lors du chargement des logs.
        </div>
      ) : isLoading ? (
        <AdminTableSkeleton rows={8} cols={4} />
      ) : filteredLogs.length === 0 ? (
        <AdminEmptyState icon={Activity} title="Aucune entrée trouvée" />
      ) : (
        <div className="rounded-xl border overflow-hidden">
          {/* Mobile card layout */}
          <div className="divide-y md:hidden">
            {filteredLogs.map((log) => {
              const user = log.userId ? users.find((u) => u.id === log.userId) : null;
              const userName = user
                ? [user.profile?.firstName, user.profile?.lastName]
                    .filter(Boolean)
                    .join(" ") || user.email
                : log.userId
                ? `#${log.userId.slice(0, 8)}`
                : "—";

              return (
                <div
                  key={log.id}
                  className="px-4 py-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-medium bg-muted rounded px-1.5 py-0.5">
                      {log.action}
                    </span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {log.createdAt
                        ? new Date(log.createdAt).toLocaleString("fr-CH", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {userName}
                  </div>
                  {log.targetType && (
                    <div className="text-xs text-muted-foreground">
                      {log.targetType}
                      {log.targetId && (
                        <span className="font-mono ml-1 opacity-60">
                          #{log.targetId.slice(0, 8)}
                        </span>
                      )}
                    </div>
                  )}
                  {log.detail && (
                    <p className="text-xs text-muted-foreground truncate">
                      {log.detail}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop grid layout */}
          <div className="hidden md:block">
            <div className="grid grid-cols-[1fr_1.5fr_2fr_1fr] gap-4 px-4 py-2 bg-muted/50 border-b text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <span>Horodatage</span>
              <span>Utilisateur</span>
              <span>Action / Détail</span>
              <span>IP</span>
            </div>

            <div className="divide-y">
              {filteredLogs.map((log) => {
                const user = log.userId ? users.find((u) => u.id === log.userId) : null;
                const userName = user
                  ? [user.profile?.firstName, user.profile?.lastName]
                      .filter(Boolean)
                      .join(" ") || user.email
                  : log.userId
                  ? `#${log.userId.slice(0, 8)}`
                  : "—";

                return (
                  <div
                    key={log.id}
                    className="grid grid-cols-[1fr_1.5fr_2fr_1fr] gap-4 px-4 py-2.5 hover:bg-accent/50 transition-colors items-start"
                  >
                    <div className="text-xs tabular-nums text-muted-foreground">
                      {log.createdAt
                        ? new Date(log.createdAt).toLocaleString("fr-CH", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })
                        : "—"}
                    </div>
                    <div className="text-xs truncate" title={user?.email}>
                      {userName}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-mono font-medium bg-muted rounded px-1.5 py-0.5">
                          {log.action}
                        </span>
                        {log.targetType && (
                          <span className="text-xs text-muted-foreground">
                            {log.targetType}
                            {log.targetId && (
                              <span className="font-mono ml-1 opacity-60">
                                #{log.targetId.slice(0, 8)}
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                      {log.detail && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {log.detail}
                        </p>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground">
                      {log.ipAddress ?? "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}
