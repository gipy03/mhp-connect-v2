import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, AlertCircle, UserX, ArrowLeft, Save, Pencil, X, Mail, Loader2, Award, ExternalLink, Calendar, Copy, Check } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AdminPageShell, AdminListSkeleton, AdminDetailSkeleton } from "@/components/AdminPageShell";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdminUser {
  id: string;
  email: string;
  emailVerified: boolean;
  createdAt: string | null;
  profile: {
    firstName: string | null;
    lastName: string | null;
    city: string | null;
    directoryVisibility: string;
  } | null;
}

interface SessionAssignment {
  id: string;
  enrollmentId: string;
  sessionId: string;
  status: string;
  assignedAt: string | null;
  sessionName: string | null;
  sessionStartDate: string | null;
}

interface Enrollment {
  id: string;
  programCode: string;
  programName: string | null;
  status: string;
  enrolledAt: string;
  bexioDocumentNr: string | null;
  bexioTotal: string | null;
  sessionAssignments: SessionAssignment[];
}

interface Credential {
  id: string;
  credentialId: string;
  credentialName: string | null;
  issuedAt: string | null;
  badgeUrl: string | null;
  certificateUrl: string | null;
}

interface UserProfile {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  phoneSecondary: string | null;
  roadAddress: string | null;
  city: string | null;
  cityCode: string | null;
  country: string | null;
  countryCode: string | null;
  birthdate: string | null;
  nationality: string | null;
  profession: string | null;
  digiformaId: string | null;
  bexioContactId: string | null;
  practiceName: string | null;
  specialties: string[] | null;
  bio: string | null;
  website: string | null;
  profileImageUrl: string | null;
  directoryVisibility: string;
  showPhone: boolean;
  showEmail: boolean;
  showAddress: boolean;
  showOnMap: boolean;
}

interface AdminUserDetail {
  id: string;
  email: string;
  emailVerified: boolean;
  createdAt: string | null;
  profile: UserProfile | null;
  enrollments: Enrollment[];
  credentials: Credential[];
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

type DetailTab = "profile" | "enrollments" | "credentials" | "activity";

// ---------------------------------------------------------------------------
// AdminUsers
// ---------------------------------------------------------------------------

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["admin", "users", search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      return api.get<AdminUser[]>(`/admin/users${params.size ? "?" + params.toString() : ""}`);
    },
    staleTime: 30_000,
  });

  const selectedUser = users.find((u) => u.id === selectedId) ?? null;

  return (
    <AdminPageShell title="Utilisateurs" description="Gérez les comptes membres et administrateurs.">
      <div className="flex h-[calc(100vh-13rem)] gap-0 overflow-hidden rounded-xl border">
        {/* Left: user list */}
        <div className={cn(
          "w-full md:w-80 shrink-0 md:border-r flex flex-col overflow-hidden",
          selectedId && "hidden md:flex"
        )}>
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
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <AdminListSkeleton rows={8} />
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
        <div className={cn(
          "flex-1 overflow-y-auto",
          !selectedId && "hidden md:flex"
        )}>
          {selectedId ? (
            <UserDetail userId={selectedId} listUser={selectedUser} onBack={() => setSelectedId(null)} />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Sélectionnez un utilisateur pour voir le détail.
            </div>
          )}
        </div>
      </div>
    </AdminPageShell>
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
  onBack,
}: {
  userId: string;
  listUser: AdminUser | null;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<DetailTab>("profile");

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
    enabled: activeTab === "activity",
  });

  const impersonateMutation = useMutation({
    mutationFn: () => api.post(`/admin/users/${userId}/impersonate`, {}),
    onSuccess: () => {
      toast.success("Impersonation activée. Rechargement…");
      setTimeout(() => window.location.replace("/dashboard"), 800);
    },
    onError: () => toast.error("Erreur lors de l'impersonation."),
  });

  const inviteMutation = useMutation({
    mutationFn: () => api.post(`/admin/users/${userId}/invite`, {}),
    onSuccess: (data: { email?: string }) => {
      toast.success(`Email d'invitation envoyé à ${data.email ?? "l'utilisateur"}.`);
    },
    onError: () => toast.error("Erreur lors de l'envoi de l'invitation."),
  });

  // Reset tab when a different user is selected
  const [currentUserId, setCurrentUserId] = useState(userId);
  if (userId !== currentUserId) {
    setCurrentUserId(userId);
    setActiveTab("profile");
  }

  if (isLoading) {
    return <AdminDetailSkeleton />;
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

  const isSelf = currentUser?.id === userId;

  const TABS: { key: DetailTab; label: string; count?: number }[] = [
    { key: "profile", label: "Profil" },
    { key: "enrollments", label: "Inscriptions", count: detail.enrollments.length },
    { key: "credentials", label: "Credentials", count: detail.credentials.length },
    { key: "activity", label: "Activité" },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-2xl">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors md:hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour
      </button>

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
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {!detail.emailVerified && (
            <Badge variant="warning">Email non vérifié</Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={() => inviteMutation.mutate()}
            disabled={inviteMutation.isPending}
          >
            {inviteMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Mail className="h-3.5 w-3.5" />
            )}
            Envoyer invitation
          </Button>
          {!isSelf && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() => impersonateMutation.mutate()}
              disabled={impersonateMutation.isPending}
            >
              <UserX className="h-3.5 w-3.5" />
              {impersonateMutation.isPending ? "…" : "Impersonner"}
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* Tabs */}
      <div className="flex gap-0 border-b -mx-0 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2 text-sm border-b-2 transition-colors -mb-px",
              activeTab === tab.key
                ? "border-foreground text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "profile" && <ProfileTab detail={detail} />}
      {activeTab === "enrollments" && <EnrollmentsTab enrollments={detail.enrollments} />}
      {activeTab === "credentials" && <CredentialsTab credentials={detail.credentials} />}
      {activeTab === "activity" && <ActivityTab logs={logs} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Profile
// ---------------------------------------------------------------------------

function ProfileTab({ detail }: { detail: AdminUserDetail }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const defaultForm = {
    firstName: detail.profile?.firstName ?? "",
    lastName: detail.profile?.lastName ?? "",
    phone: detail.profile?.phone ?? "",
    phoneSecondary: detail.profile?.phoneSecondary ?? "",
    roadAddress: detail.profile?.roadAddress ?? "",
    city: detail.profile?.city ?? "",
    cityCode: detail.profile?.cityCode ?? "",
    country: detail.profile?.country ?? "",
    countryCode: detail.profile?.countryCode ?? "",
    birthdate: detail.profile?.birthdate ?? "",
    nationality: detail.profile?.nationality ?? "",
    profession: detail.profile?.profession ?? "",
    practiceName: detail.profile?.practiceName ?? "",
    bio: detail.profile?.bio ?? "",
    website: detail.profile?.website ?? "",
    profileImageUrl: detail.profile?.profileImageUrl ?? "",
    specialties: (detail.profile?.specialties ?? []).join(", "),
    directoryVisibility: detail.profile?.directoryVisibility ?? "hidden",
    showPhone: detail.profile?.showPhone ?? false,
    showEmail: detail.profile?.showEmail ?? false,
    showAddress: detail.profile?.showAddress ?? false,
    showOnMap: detail.profile?.showOnMap ?? true,
    digiformaId: detail.profile?.digiformaId ?? "",
    bexioContactId: detail.profile?.bexioContactId ?? "",
  };

  const [form, setForm] = useState(defaultForm);

  const [prevId, setPrevId] = useState(detail.id);
  if (detail.id !== prevId) {
    setPrevId(detail.id);
    setForm({
      firstName: detail.profile?.firstName ?? "",
      lastName: detail.profile?.lastName ?? "",
      phone: detail.profile?.phone ?? "",
      phoneSecondary: detail.profile?.phoneSecondary ?? "",
      roadAddress: detail.profile?.roadAddress ?? "",
      city: detail.profile?.city ?? "",
      cityCode: detail.profile?.cityCode ?? "",
      country: detail.profile?.country ?? "",
      countryCode: detail.profile?.countryCode ?? "",
      birthdate: detail.profile?.birthdate ?? "",
      nationality: detail.profile?.nationality ?? "",
      profession: detail.profile?.profession ?? "",
      practiceName: detail.profile?.practiceName ?? "",
      bio: detail.profile?.bio ?? "",
      website: detail.profile?.website ?? "",
      profileImageUrl: detail.profile?.profileImageUrl ?? "",
      specialties: (detail.profile?.specialties ?? []).join(", "),
      directoryVisibility: detail.profile?.directoryVisibility ?? "hidden",
      showPhone: detail.profile?.showPhone ?? false,
      showEmail: detail.profile?.showEmail ?? false,
      showAddress: detail.profile?.showAddress ?? false,
      showOnMap: detail.profile?.showOnMap ?? true,
      digiformaId: detail.profile?.digiformaId ?? "",
      bexioContactId: detail.profile?.bexioContactId ?? "",
    });
    setEditing(false);
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      api.patch(`/admin/users/${detail.id}/profile`, {
        firstName: form.firstName || null,
        lastName: form.lastName || null,
        phone: form.phone || null,
        phoneSecondary: form.phoneSecondary || null,
        roadAddress: form.roadAddress || null,
        city: form.city || null,
        cityCode: form.cityCode || null,
        country: form.country || null,
        countryCode: form.countryCode || null,
        birthdate: form.birthdate || null,
        nationality: form.nationality || null,
        profession: form.profession || null,
        practiceName: form.practiceName || null,
        bio: form.bio || null,
        website: form.website || null,
        profileImageUrl: form.profileImageUrl || null,
        specialties: form.specialties ? form.specialties.split(",").map((s) => s.trim()).filter(Boolean) : [],
        directoryVisibility: form.directoryVisibility,
        showPhone: form.showPhone,
        showEmail: form.showEmail,
        showAddress: form.showAddress,
        showOnMap: form.showOnMap,
        digiformaId: form.digiformaId || null,
        bexioContactId: form.bexioContactId || null,
      }),
    onSuccess: () => {
      toast.success("Profil mis à jour.");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "user-detail", detail.id] });
      setEditing(false);
    },
    onError: () => toast.error("Erreur lors de la sauvegarde."),
  });

  const set = (key: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  if (!editing) {
    const p = detail.profile;
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Modifier
          </Button>
        </div>
        {!p ? (
          <p className="text-sm text-muted-foreground">Aucun profil renseigné.</p>
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Prénom</dt>
            <dd>{p.firstName || "—"}</dd>
            <dt className="text-muted-foreground">Nom</dt>
            <dd>{p.lastName || "—"}</dd>
            <dt className="text-muted-foreground">Téléphone</dt>
            <dd>{p.phone || "—"}</dd>
            {p.phoneSecondary && (<><dt className="text-muted-foreground">Tél. secondaire</dt><dd>{p.phoneSecondary}</dd></>)}
            <dt className="text-muted-foreground">Adresse</dt>
            <dd>{p.roadAddress || "—"}</dd>
            <dt className="text-muted-foreground">Ville</dt>
            <dd>{[p.city, p.cityCode].filter(Boolean).join(" ") || "—"}</dd>
            <dt className="text-muted-foreground">Pays</dt>
            <dd>{[p.country, p.countryCode ? `(${p.countryCode})` : null].filter(Boolean).join(" ") || "—"}</dd>
            {p.birthdate && (<><dt className="text-muted-foreground">Date de naissance</dt><dd>{p.birthdate}</dd></>)}
            {p.nationality && (<><dt className="text-muted-foreground">Nationalité</dt><dd>{p.nationality}</dd></>)}
            <dt className="text-muted-foreground">Profession</dt>
            <dd>{p.profession || "—"}</dd>
            <dt className="text-muted-foreground">Cabinet</dt>
            <dd>{p.practiceName || "—"}</dd>
            <dt className="text-muted-foreground">Site web</dt>
            <dd className="truncate">{p.website || "—"}</dd>
            <dt className="text-muted-foreground">Annuaire</dt>
            <dd><DirectoryBadge visibility={p.directoryVisibility} /></dd>
            <dt className="text-muted-foreground">DigiForma ID</dt>
            <dd className="font-mono text-xs">{p.digiformaId || "—"}</dd>
            <dt className="text-muted-foreground">Bexio Contact ID</dt>
            <dd className="font-mono text-xs">{p.bexioContactId || "—"}</dd>
            {p.specialties && p.specialties.length > 0 && (
              <>
                <dt className="text-muted-foreground">Spécialités</dt>
                <dd className="flex flex-wrap gap-1">
                  {p.specialties.map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                  ))}
                </dd>
              </>
            )}
            {p.bio && (
              <>
                <dt className="text-muted-foreground col-span-2 mt-2">Bio</dt>
                <dd className="col-span-2 text-muted-foreground leading-relaxed whitespace-pre-wrap">{p.bio}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Visibilité</dt>
            <dd className="flex flex-wrap gap-2 text-xs">
              {p.showPhone && <Badge variant="outline">Téléphone</Badge>}
              {p.showEmail && <Badge variant="outline">Email</Badge>}
              {p.showAddress && <Badge variant="outline">Adresse</Badge>}
              {p.showOnMap && <Badge variant="outline">Carte</Badge>}
              {!p.showPhone && !p.showEmail && !p.showAddress && !p.showOnMap && "—"}
            </dd>
          </dl>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Modifier le profil</p>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => setEditing(false)}>
            <X className="h-3.5 w-3.5" /> Annuler
          </Button>
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="h-3.5 w-3.5" /> {saveMutation.isPending ? "…" : "Enregistrer"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="pf-fn">Prénom</Label>
          <Input id="pf-fn" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-ln">Nom</Label>
          <Input id="pf-ln" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-phone">Téléphone</Label>
          <Input id="pf-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-phone2">Tél. secondaire</Label>
          <Input id="pf-phone2" value={form.phoneSecondary} onChange={(e) => set("phoneSecondary", e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="pf-address">Adresse</Label>
          <Input id="pf-address" value={form.roadAddress} onChange={(e) => set("roadAddress", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-city">Ville</Label>
          <Input id="pf-city" value={form.city} onChange={(e) => set("city", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-citycode">Code postal</Label>
          <Input id="pf-citycode" value={form.cityCode} onChange={(e) => set("cityCode", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-country">Pays</Label>
          <Input id="pf-country" value={form.country} onChange={(e) => set("country", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-cc">Code pays</Label>
          <Input id="pf-cc" value={form.countryCode} onChange={(e) => set("countryCode", e.target.value)} placeholder="CH" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-birth">Date de naissance</Label>
          <Input id="pf-birth" value={form.birthdate} onChange={(e) => set("birthdate", e.target.value)} placeholder="JJ.MM.AAAA" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-nat">Nationalité</Label>
          <Input id="pf-nat" value={form.nationality} onChange={(e) => set("nationality", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-prof">Profession</Label>
          <Input id="pf-prof" value={form.profession} onChange={(e) => set("profession", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-practice">Cabinet</Label>
          <Input id="pf-practice" value={form.practiceName} onChange={(e) => set("practiceName", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-web">Site web</Label>
          <Input id="pf-web" value={form.website} onChange={(e) => set("website", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-img">URL photo de profil</Label>
          <Input id="pf-img" value={form.profileImageUrl} onChange={(e) => set("profileImageUrl", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pf-spec">Spécialités (séparées par des virgules)</Label>
          <Input id="pf-spec" value={form.specialties} onChange={(e) => set("specialties", e.target.value)} placeholder="Hypnose, PNL, Coaching" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pf-bio">Bio</Label>
        <Textarea id="pf-bio" value={form.bio} onChange={(e) => set("bio", e.target.value)} rows={4} />
      </div>

      <Separator />

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Annuaire & visibilité</p>
        <div className="space-y-1.5">
          <Label>Visibilité annuaire</Label>
          <Select value={form.directoryVisibility} onValueChange={(v) => set("directoryVisibility", v)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hidden">Masqué</SelectItem>
              <SelectItem value="internal">Interne</SelectItem>
              <SelectItem value="public">Public</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Switch id="pf-sp" checked={form.showPhone} onCheckedChange={(v) => set("showPhone", v)} />
            <Label htmlFor="pf-sp" className="cursor-pointer text-sm">Afficher téléphone</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="pf-se" checked={form.showEmail} onCheckedChange={(v) => set("showEmail", v)} />
            <Label htmlFor="pf-se" className="cursor-pointer text-sm">Afficher email</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="pf-sa" checked={form.showAddress} onCheckedChange={(v) => set("showAddress", v)} />
            <Label htmlFor="pf-sa" className="cursor-pointer text-sm">Afficher adresse</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="pf-sm" checked={form.showOnMap} onCheckedChange={(v) => set("showOnMap", v)} />
            <Label htmlFor="pf-sm" className="cursor-pointer text-sm">Afficher sur la carte</Label>
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">IDs externes</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="pf-digi">DigiForma ID</Label>
            <Input id="pf-digi" value={form.digiformaId} onChange={(e) => set("digiformaId", e.target.value)} className="font-mono text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-bexio">Bexio Contact ID</Label>
            <Input id="pf-bexio" value={form.bexioContactId} onChange={(e) => set("bexioContactId", e.target.value)} className="font-mono text-xs" />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-1.5">
          <Save className="h-4 w-4" /> {saveMutation.isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Enrollments
// ---------------------------------------------------------------------------

const ENROLLMENT_STATUS_MAP: Record<string, { label: string; variant: "success" | "secondary" | "warning" | "destructive" | "outline" }> = {
  active: { label: "Actif", variant: "success" },
  completed: { label: "Terminé", variant: "secondary" },
  refunded: { label: "Remboursé", variant: "warning" },
  cancelled: { label: "Annulé", variant: "destructive" },
};

function EnrollmentsTab({ enrollments }: { enrollments: Enrollment[] }) {
  if (enrollments.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune inscription.</p>;
  }
  return (
    <div className="space-y-3">
      {enrollments.map((e) => {
        const statusCfg = ENROLLMENT_STATUS_MAP[e.status] ?? { label: e.status, variant: "outline" as const };
        return (
          <div key={e.id} className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{e.programName ?? e.programCode}</p>
                {e.programName && (
                  <p className="text-[11px] font-mono text-muted-foreground">{e.programCode}</p>
                )}
              </div>
              <Badge variant={statusCfg.variant} className="text-xs">{statusCfg.label}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Inscrit le {new Date(e.enrolledAt).toLocaleDateString("fr-CH")}</span>
              {e.bexioDocumentNr && <span>Facture {e.bexioDocumentNr}</span>}
              {e.bexioTotal && <span>Montant {e.bexioTotal} CHF</span>}
            </div>
            {e.sessionAssignments.length > 0 && (
              <div className="space-y-1 pt-1 border-t">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Sessions</p>
                {e.sessionAssignments.map((sa) => (
                  <div key={sa.id} className="flex items-center justify-between text-xs">
                    <span>
                      {sa.sessionName ?? sa.sessionId}
                      {sa.sessionStartDate && (
                        <span className="text-muted-foreground ml-1.5">
                          ({new Date(sa.sessionStartDate).toLocaleDateString("fr-CH", { day: "numeric", month: "short", year: "numeric" })})
                        </span>
                      )}
                    </span>
                    <span className="text-muted-foreground capitalize">{sa.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Credentials
// ---------------------------------------------------------------------------

function CredentialCopyBtn({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copié !");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier.");
    }
  };
  return (
    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleCopy} aria-label={copied ? "Copié" : `Copier ${label}`}>
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
    </Button>
  );
}

function CredentialsTab({ credentials }: { credentials: Credential[] }) {
  if (credentials.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
          <Award className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Aucun credential émis.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {credentials.map((c) => (
        <div key={c.id} className="rounded-lg border p-4 space-y-3">
          <div className="flex items-start gap-3">
            {c.badgeUrl ? (
              <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-white border shadow-sm flex items-center justify-center p-1">
                <img src={c.badgeUrl} alt={c.credentialName ?? "Badge"} className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="shrink-0 w-14 h-14 rounded-lg bg-muted flex items-center justify-center">
                <Award className="h-6 w-6 text-muted-foreground/40" />
              </div>
            )}
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-sm font-medium leading-tight">{c.credentialName ?? "Credential"}</p>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-muted-foreground font-mono truncate">ID: {c.credentialId}</p>
                <CredentialCopyBtn text={c.credentialId} label="l'ID" />
              </div>
              {c.issuedAt && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Émis le {new Date(c.issuedAt).toLocaleDateString("fr-CH", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {c.badgeUrl && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" asChild>
                <a href={c.badgeUrl} target="_blank" rel="noopener noreferrer">
                  <Award className="h-3 w-3" />
                  Badge
                  <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                </a>
              </Button>
            )}
            {c.certificateUrl && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" asChild>
                <a href={c.certificateUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                  Certificat
                </a>
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Activity
// ---------------------------------------------------------------------------

function ActivityTab({ logs }: { logs: ActivityLog[] }) {
  if (logs.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune activité enregistrée.</p>;
  }
  return (
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
              <p className="text-[10px] text-muted-foreground/60 font-mono">{log.ipAddress}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------


function DirectoryBadge({ visibility }: { visibility: string }) {
  const map: Record<string, { label: string; variant: "success" | "secondary" | "outline" }> = {
    public: { label: "Public", variant: "success" },
    internal: { label: "Interne", variant: "secondary" },
    hidden: { label: "Masqué", variant: "outline" },
  };
  const config = map[visibility] ?? { label: visibility, variant: "outline" as const };
  return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>;
}
