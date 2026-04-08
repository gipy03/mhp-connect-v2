import { useState, useCallback } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, ChevronLeft, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdminUser {
  id: string;
  email: string;
  role: string;
  emailVerified: boolean;
  createdAt: string;
  profile: {
    firstName: string | null;
    lastName: string | null;
    city: string | null;
    directoryVisibility: string | null;
  } | null;
}

interface UserDetail extends AdminUser {
  profile: {
    firstName: string | null;
    lastName: string | null;
    city: string | null;
    country: string | null;
    phone: string | null;
    roadAddress: string | null;
    bio: string | null;
    practiceName: string | null;
    directoryVisibility: string | null;
  } | null;
}

interface AdminEnrollment {
  id: string;
  programCode: string;
  status: string;
  bexioDocumentNr: string | null;
  bexioTotal: string | null;
  enrolledAt: string;
  cancelledAt: string | null;
}

// ---------------------------------------------------------------------------
// User list page
// ---------------------------------------------------------------------------

export function AdminUserList() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const handleSearch = useCallback((v: string) => {
    setSearch(v);
    const t = setTimeout(() => setDebouncedSearch(v), 300);
    return () => clearTimeout(t);
  }, []);

  const buildQuery = () => {
    const q = new URLSearchParams();
    if (debouncedSearch) q.set("search", debouncedSearch);
    if (role) q.set("role", role);
    return q.toString() ? `?${q}` : "";
  };

  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["admin", "users", debouncedSearch, role],
    queryFn: () => api.get<AdminUser[]>(`/admin/users${buildQuery()}`),
    staleTime: 60_000,
  });

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Utilisateurs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLoading ? "Chargement…" : `${users.length} utilisateur${users.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Rechercher par email ou nom…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <option value="">Tous les rôles</option>
          <option value="member">Membres</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-5 w-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Utilisateur</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Rôle</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Ville</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Inscrit</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">
                        {[u.profile?.firstName, u.profile?.lastName].filter(Boolean).join(" ") || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                      {u.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                    {u.profile?.city ?? "—"}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                    {new Date(u.createdAt).toLocaleDateString("fr-CH", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" className="text-xs" asChild>
                      <Link to="/user/admin/users/$id" params={{ id: u.id }}>
                        Voir
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Aucun utilisateur trouvé.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// User detail page
// ---------------------------------------------------------------------------

export function AdminUserDetail() {
  const { id } = useParams({ strict: false }) as { id: string };
  const qc = useQueryClient();

  const { data: user, isLoading, isError } = useQuery<UserDetail>({
    queryKey: ["admin", "users", id],
    queryFn: () => api.get<UserDetail>(`/admin/users/${id}`),
    enabled: !!id,
    staleTime: 60_000,
  });

  const { data: enrollments = [] } = useQuery<AdminEnrollment[]>({
    queryKey: ["admin", "users", id, "enrollments"],
    queryFn: () => api.get<AdminEnrollment[]>(`/admin/users/${id}/enrollments`),
    enabled: !!id,
    staleTime: 2 * 60_000,
  });

  const { data: logs = [] } = useQuery<{ id: string; action: string; detail: string | null; createdAt: string }[]>({
    queryKey: ["admin", "activity", id],
    queryFn: () => api.get(`/admin/activity-logs?userId=${id}&limit=20`),
    enabled: !!id,
    staleTime: 60_000,
  });

  const roleMut = useMutation({
    mutationFn: (newRole: string) =>
      api.patch(`/admin/users/${id}/role`, { role: newRole }),
    onSuccess: () => {
      toast.success("Rôle mis à jour.");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: () => toast.error("Erreur lors de la mise à jour du rôle."),
  });

  if (isError) {
    return (
      <div className="max-w-2xl space-y-4">
        <Link
          to="/user/admin/users"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Retour
        </Link>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
          Utilisateur introuvable.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6 pb-12">
      <Link
        to="/user/admin/users"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Retour aux utilisateurs
      </Link>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-5 w-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
        </div>
      ) : user ? (
        <>
          {/* Identity */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted shrink-0">
                  {user.role === "admin" ? (
                    <ShieldCheck className="h-6 w-6 text-muted-foreground" />
                  ) : (
                    <User className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="font-semibold">
                    {[user.profile?.firstName, user.profile?.lastName]
                      .filter(Boolean)
                      .join(" ") || "Pas de nom"}
                  </p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                {user.role}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {user.profile?.practiceName && (
                <div>
                  <p className="text-xs text-muted-foreground">Cabinet</p>
                  <p>{user.profile.practiceName}</p>
                </div>
              )}
              {user.profile?.city && (
                <div>
                  <p className="text-xs text-muted-foreground">Ville</p>
                  <p>{[user.profile.city, user.profile.country].filter(Boolean).join(", ")}</p>
                </div>
              )}
              {user.profile?.phone && (
                <div>
                  <p className="text-xs text-muted-foreground">Téléphone</p>
                  <p>{user.profile.phone}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Inscrit</p>
                <p>
                  {new Date(user.createdAt).toLocaleDateString("fr-CH", {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                </p>
              </div>
            </div>

            {/* Role change */}
            <div className="flex items-center gap-3 pt-2 border-t">
              <p className="text-xs text-muted-foreground flex-1">Changer le rôle :</p>
              <select
                value={user.role}
                onChange={(e) => {
                  if (window.confirm(`Changer le rôle en "${e.target.value}" ?`))
                    roleMut.mutate(e.target.value);
                }}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={roleMut.isPending}
              >
                <option value="member">member</option>
                <option value="admin">admin</option>
              </select>
            </div>
          </div>

          {/* Enrollments */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Formations ({enrollments.length})
            </h2>
            {enrollments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune inscription.</p>
            ) : (
              <div className="space-y-2">
                {enrollments.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium font-mono">{e.programCode}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(e.enrolledAt).toLocaleDateString("fr-CH", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {e.bexioTotal && (
                        <span className="text-xs font-medium">CHF {e.bexioTotal}</span>
                      )}
                      <Badge
                        variant={
                          e.status === "active"
                            ? "secondary"
                            : e.status === "completed"
                            ? "success"
                            : "destructive"
                        }
                      >
                        {e.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity log */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Activité récente
            </h2>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune activité enregistrée.</p>
            ) : (
              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-xs">
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b last:border-b-0">
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString("fr-CH", {
                            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                          })}
                        </td>
                        <td className="px-3 py-2 font-mono font-medium">{log.action}</td>
                        <td className="px-3 py-2 text-muted-foreground truncate max-w-[200px]">
                          {log.detail}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
