import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { api } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActivityLog {
  id: string;
  userId: string | null;
  action: string;
  detail: string | null;
  ipAddress: string | null;
  createdAt: string;
  userEmail?: string | null;
}

interface AdminUser {
  id: string;
  email: string;
}

// ---------------------------------------------------------------------------
// AdminActivity
// ---------------------------------------------------------------------------

export default function AdminActivity() {
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState("");
  const [limit, setLimit] = useState("100");

  const buildQuery = () => {
    const q = new URLSearchParams();
    if (userId) q.set("userId", userId);
    q.set("limit", limit);
    return q.toString() ? `?${q}` : "";
  };

  const { data: logs = [], isLoading } = useQuery<ActivityLog[]>({
    queryKey: ["admin", "activity-logs", userId, limit],
    queryFn: () => api.get<ActivityLog[]>(`/admin/activity-logs${buildQuery()}`),
    staleTime: 30_000,
  });

  const { data: users = [] } = useQuery<AdminUser[]>({
    queryKey: ["admin", "users-list"],
    queryFn: () => api.get<AdminUser[]>("/admin/users"),
    staleTime: 5 * 60_000,
  });

  const filtered = search
    ? logs.filter(
        (l) =>
          l.action.toLowerCase().includes(search.toLowerCase()) ||
          (l.detail ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (l.userEmail ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Journal d'activité</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isLoading ? "Chargement…" : `${filtered.length} entrée${filtered.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Filtrer par action ou détail…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
        </div>
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <option value="">Tous les utilisateurs</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.email}
            </option>
          ))}
        </select>
        <select
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <option value="50">50 entrées</option>
          <option value="100">100 entrées</option>
          <option value="250">250 entrées</option>
          <option value="500">500 entrées</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-5 w-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed py-14 text-center text-sm text-muted-foreground">
          Aucune entrée trouvée.
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">
                    Date
                  </th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                    Utilisateur
                  </th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">
                    Action
                  </th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden md:table-cell">
                    Détail
                  </th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden lg:table-cell">
                    IP
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log, i) => (
                  <tr
                    key={log.id}
                    className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
                  >
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString("fr-CH", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground truncate max-w-[160px] hidden sm:table-cell">
                      {log.userEmail ?? log.userId ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-mono font-medium">{log.action}</td>
                    <td className="px-3 py-2 text-muted-foreground truncate max-w-[240px] hidden md:table-cell">
                      {log.detail ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground font-mono hidden lg:table-cell">
                      {log.ipAddress ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
