import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, ChevronRight, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdminUser {
  id: string;
  email: string;
  role: "member" | "admin";
  emailVerified: boolean;
  createdAt: string | null;
  profile: {
    firstName: string | null;
    lastName: string | null;
    city: string | null;
    directoryVisibility: string;
  } | null;
}

interface AdminUserDetail {
  id: string;
  email: string;
  role: "member" | "admin";
  emailVerified: boolean;
  createdAt: string | null;
  profile: {
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    city: string | null;
    country: string | null;
    profession: string | null;
    directoryVisibility: string;
    bio: string | null;
    specialties: string[] | null;
    practiceName: string | null;
    website: string | null;
  } | null;
}

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

// ---------------------------------------------------------------------------
// AdminUsers
// ---------------------------------------------------------------------------

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | "member" | "admin">("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["admin", "users", search, roleFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);
      return api.get<AdminUser[]>(`/admin/users${params.size ? "?" + params.toString() : ""}`);
    },
    staleTime: 30_000,
  });

  const selectedUser = users.find((u) => u.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Utilisateurs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gérez les comptes membres et administrateurs.
        </p>
      </div>

      <div className="flex h-[calc(100vh-13rem)] gap-0 overflow-hidden rounded-xl border">
        {/* Left: user list */}
        <div className="w-80 shrink-0 border-r flex flex-col overflow-hidden">
          {/* Search + filter */}
          <div className="p-3 border-b space-y-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher…"
                className="pl-8 h-8 text-sm"
              />
            </div>
            <div className="flex gap-1.5">
              {(["", "member", "admin"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs border transition-colors",
                    roleFilter === r
                      ? "bg-foreground text-background border-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {r === "" ? "Tous" : r === "member" ? "Membres" : "Admins"}
                </button>
              ))}
            </div>
          </div>

          {/* User rows */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-4 w-4 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucun utilisateur trouvé.
              </p>
            ) : (
              users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  selected={selectedId === user.id}
                  onClick={() => setSelectedId(user.id)}
                />
              ))
            )}
          </div>

          <div className="px-4 py-2 border-t shrink-0">
            <p className="text-xs text-muted-foreground">
              {users.length} utilisateur{users.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Right: user detail */}
        <div className="flex-1 overflow-y-auto">
          {selectedId ? (
            <UserDetail userId={selectedId} listUser={selectedUser} />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Sélectionnez un utilisateur pour voir le détail.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// UserRow
// ---------------------------------------------------------------------------

function UserRow({
  user,
  selected,
  onClick,
}: {
  user: AdminUser;
  selected: boolean;
  onClick: () => void;
}) {
  const name =
    [user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(" ") ||
    "—";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3 border-b hover:bg-accent transition-colors",
        selected && "bg-accent"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{name}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          {user.profile?.city && (
            <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
              {user.profile.city}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <RoleBadge role={user.role} />
          <span className="text-[10px] text-muted-foreground">
            {user.profile?.directoryVisibility ?? "hidden"}
          </span>
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// UserDetail
// ---------------------------------------------------------------------------

function UserDetail({
  userId,
  listUser,
}: {
  userId: string;
  listUser: AdminUser | null;
}) {
  const qc = useQueryClient();

  const { data: detail, isLoading, isError } = useQuery<AdminUserDetail>({
    queryKey: ["admin", "user-detail", userId],
    queryFn: () => api.get<AdminUserDetail>(`/admin/users/${userId}`),
    staleTime: 30_000,
  });

  const { data: logs = [] } = useQuery<ActivityLog[]>({
    queryKey: ["admin", "activity-logs", userId],
    queryFn: () =>
      api.get<ActivityLog[]>(`/admin/activity-logs?userId=${userId}&limit=20`),
    staleTime: 30_000,
  });

  const roleMutation = useMutation({
    mutationFn: (role: "member" | "admin") =>
      api.patch(`/admin/users/${userId}/role`, { role }),
    onSuccess: () => {
      toast.success("Rôle mis à jour.");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "user-detail", userId] });
    },
    onError: () => toast.error("Erreur lors de la mise à jour du rôle."),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-5 w-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
      </div>
    );
  }

  if (isError || !detail) {
    return (
      <div className="flex items-center gap-2 justify-center h-full text-sm text-destructive">
        <AlertCircle className="h-4 w-4" />
        Erreur lors du chargement.
      </div>
    );
  }

  const name =
    [detail.profile?.firstName, detail.profile?.lastName]
      .filter(Boolean)
      .join(" ") || "—";

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{name}</h2>
          <p className="text-sm text-muted-foreground">{detail.email}</p>
          {detail.createdAt && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Inscrit le{" "}
              {new Date(detail.createdAt).toLocaleDateString("fr-CH", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!detail.emailVerified && (
            <Badge variant="warning">Email non vérifié</Badge>
          )}
          <RoleBadge role={detail.role} />
        </div>
      </div>

      <Separator />

      {/* Role management */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Rôle
        </Label>
        <div className="flex items-center gap-3">
          {(["member", "admin"] as const).map((r) => (
            <button
              key={r}
              onClick={() => {
                if (r !== detail.role) roleMutation.mutate(r);
              }}
              disabled={roleMutation.isPending}
              className={cn(
                "rounded-lg border px-4 py-2 text-sm transition-colors",
                detail.role === r
                  ? "bg-foreground text-background border-foreground"
                  : "hover:bg-accent"
              )}
            >
              {r === "member" ? "Membre" : "Administrateur"}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Profile info */}
      {detail.profile && (
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Profil
          </Label>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {detail.profile.profession && (
              <>
                <dt className="text-muted-foreground">Profession</dt>
                <dd>{detail.profile.profession}</dd>
              </>
            )}
            {detail.profile.phone && (
              <>
                <dt className="text-muted-foreground">Téléphone</dt>
                <dd>{detail.profile.phone}</dd>
              </>
            )}
            {(detail.profile.city || detail.profile.country) && (
              <>
                <dt className="text-muted-foreground">Localisation</dt>
                <dd>
                  {[detail.profile.city, detail.profile.country]
                    .filter(Boolean)
                    .join(", ")}
                </dd>
              </>
            )}
            {detail.profile.practiceName && (
              <>
                <dt className="text-muted-foreground">Cabinet</dt>
                <dd>{detail.profile.practiceName}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Annuaire</dt>
            <dd>
              <DirectoryBadge visibility={detail.profile.directoryVisibility} />
            </dd>
            {detail.profile.specialties && detail.profile.specialties.length > 0 && (
              <>
                <dt className="text-muted-foreground">Spécialités</dt>
                <dd className="flex flex-wrap gap-1">
                  {detail.profile.specialties.map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs">
                      {s}
                    </Badge>
                  ))}
                </dd>
              </>
            )}
          </dl>
          {detail.profile.bio && (
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              {detail.profile.bio}
            </p>
          )}
        </div>
      )}

      <Separator />

      {/* Activity log */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Activité récente
        </Label>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune activité enregistrée.</p>
        ) : (
          <div className="space-y-1">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-accent/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-medium">{log.action}</span>
                    {log.targetType && (
                      <span className="text-xs text-muted-foreground">
                        {log.targetType}
                        {log.targetId && ` #${log.targetId.slice(0, 8)}`}
                      </span>
                    )}
                  </div>
                  {log.detail && (
                    <p className="text-xs text-muted-foreground mt-0.5">{log.detail}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  {log.createdAt && (
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString("fr-CH", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                  {log.ipAddress && (
                    <p className="text-[10px] text-muted-foreground/60 font-mono">
                      {log.ipAddress}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function RoleBadge({ role }: { role: "member" | "admin" }) {
  return (
    <Badge variant={role === "admin" ? "default" : "secondary"} className="text-xs">
      {role === "admin" ? "Admin" : "Membre"}
    </Badge>
  );
}

function DirectoryBadge({ visibility }: { visibility: string }) {
  const map: Record<string, { label: string; variant: "success" | "secondary" | "outline" }> = {
    public: { label: "Public", variant: "success" },
    internal: { label: "Interne", variant: "secondary" },
    hidden: { label: "Masqué", variant: "outline" },
  };
  const config = map[visibility] ?? { label: visibility, variant: "outline" as const };
  return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>;
}
