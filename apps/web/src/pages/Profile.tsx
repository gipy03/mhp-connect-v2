import { useState, useRef, useCallback } from "react";
import {
  User,
  MapPin,
  Lock,
  Eye,
  EyeOff,
  Camera,
  Award,
  Globe,
  ExternalLink,
  Check,
  Loader2,
  BookOpen,
  Phone,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  useProfile,
  type UserProfile,
  type ProfilePatch,
} from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Section wrapper with title and optional description */
function Section({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted mt-0.5">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

/** Two-column form grid */
function Grid2({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
  );
}

/** Field wrapper */
function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground font-medium">{label}</Label>
      {children}
    </div>
  );
}

/** Save row at the bottom of each section */
function SaveRow({
  isPending,
  onSave,
  saved,
}: {
  isPending: boolean;
  onSave: () => void;
  saved?: boolean;
}) {
  return (
    <div className="flex justify-end pt-2 border-t">
      <Button size="sm" disabled={isPending} onClick={onSave}>
        {isPending ? (
          <>
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            Enregistrement…
          </>
        ) : saved ? (
          <>
            <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
            Enregistré
          </>
        ) : (
          "Enregistrer"
        )}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Avatar section
// ---------------------------------------------------------------------------

function AvatarSection({
  profile,
  email,
}: {
  profile: UserProfile | null;
  email: string;
}) {
  const { uploadAvatar } = useProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const currentUrl = preview ?? profile?.profileImageUrl ?? null;
  const initials = email[0]?.toUpperCase() ?? "?";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPreview(ev.target?.result as string);
      setPendingFile(file);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!pendingFile) return;
    try {
      await uploadAvatar.mutateAsync(pendingFile);
      setPreview(null);
      setPendingFile(null);
      toast.success("Photo de profil mise à jour.");
    } catch {
      toast.error("Échec du téléchargement. Réessayez.");
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setPendingFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <section className="flex items-center gap-5">
      {/* Avatar circle */}
      <div className="relative group">
        <div
          className="h-20 w-20 rounded-full overflow-hidden bg-primary flex items-center justify-center text-primary-foreground text-2xl font-semibold cursor-pointer"
          onClick={() => fileRef.current?.click()}
          title="Changer la photo"
        >
          {currentUrl ? (
            <img
              src={currentUrl}
              alt="Photo de profil"
              className="h-full w-full object-cover"
            />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-background border shadow-sm text-muted-foreground hover:text-foreground transition-colors"
          title="Modifier la photo"
        >
          <Camera className="h-3.5 w-3.5" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleFileChange}
        />
      </div>

      {/* Upload controls */}
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Photo de profil</p>
        <p className="text-xs text-muted-foreground">
          JPG, PNG ou WebP — max 2 Mo
        </p>
        {pendingFile ? (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="text-xs h-7"
              disabled={uploadAvatar.isPending}
              onClick={handleUpload}
            >
              {uploadAvatar.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : null}
              Confirmer
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-7"
              onClick={handleCancel}
            >
              Annuler
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7"
            onClick={() => fileRef.current?.click()}
          >
            Choisir une photo
          </Button>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Personal information section
// ---------------------------------------------------------------------------

function PersonalInfoSection({
  profile,
  email,
}: {
  profile: UserProfile | null;
  email: string;
}) {
  const { updateProfile } = useProfile();
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    firstName: profile?.firstName ?? "",
    lastName: profile?.lastName ?? "",
    phone: profile?.phone ?? "",
    birthdate: profile?.birthdate ?? "",
    nationality: profile?.nationality ?? "",
    profession: profile?.profession ?? "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    const patch: ProfilePatch = {
      firstName: form.firstName || undefined,
      lastName: form.lastName || undefined,
      phone: form.phone || undefined,
      birthdate: form.birthdate || undefined,
      nationality: form.nationality || undefined,
      profession: form.profession || undefined,
    };
    try {
      await updateProfile.mutateAsync(patch);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success("Informations mises à jour.");
    } catch {
      toast.error("Erreur lors de l'enregistrement.");
    }
  };

  return (
    <Section
      title="Informations personnelles"
      icon={User}
    >
      <Grid2>
        <Field label="Prénom">
          <Input value={form.firstName} onChange={set("firstName")} placeholder="Jean" />
        </Field>
        <Field label="Nom">
          <Input value={form.lastName} onChange={set("lastName")} placeholder="Dupont" />
        </Field>
        <Field label="Email" className="sm:col-span-2">
          <Input value={email} disabled className="bg-muted/50" />
          <p className="text-xs text-muted-foreground">
            L'email ne peut pas être modifié ici.
          </p>
        </Field>
        <Field label="Téléphone">
          <Input
            value={form.phone}
            onChange={set("phone")}
            placeholder="+41 79 123 45 67"
            type="tel"
          />
        </Field>
        <Field label="Date de naissance">
          <Input value={form.birthdate} onChange={set("birthdate")} placeholder="1985-06-15" />
        </Field>
        <Field label="Nationalité">
          <Input value={form.nationality} onChange={set("nationality")} placeholder="Suisse" />
        </Field>
        <Field label="Profession">
          <Input value={form.profession} onChange={set("profession")} placeholder="Psychothérapeute" />
        </Field>
      </Grid2>
      <SaveRow isPending={updateProfile.isPending} onSave={handleSave} saved={saved} />
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Address section
// ---------------------------------------------------------------------------

function AddressSection({ profile }: { profile: UserProfile | null }) {
  const { updateProfile } = useProfile();
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    roadAddress: profile?.roadAddress ?? "",
    city: profile?.city ?? "",
    cityCode: profile?.cityCode ?? "",
    country: profile?.country ?? "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync({
        roadAddress: form.roadAddress || undefined,
        city: form.city || undefined,
        cityCode: form.cityCode || undefined,
        country: form.country || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success("Adresse mise à jour.");
    } catch {
      toast.error("Erreur lors de l'enregistrement.");
    }
  };

  return (
    <Section
      title="Adresse"
      description="Le géocodage est effectué automatiquement lors de l'enregistrement."
      icon={MapPin}
    >
      <Grid2>
        <Field label="Rue / numéro" className="sm:col-span-2">
          <Input
            value={form.roadAddress}
            onChange={set("roadAddress")}
            placeholder="Rue des Alpes 12"
          />
        </Field>
        <Field label="NPA">
          <Input value={form.cityCode} onChange={set("cityCode")} placeholder="1200" />
        </Field>
        <Field label="Ville">
          <Input value={form.city} onChange={set("city")} placeholder="Genève" />
        </Field>
        <Field label="Pays" className="sm:col-span-2">
          <Input value={form.country} onChange={set("country")} placeholder="Suisse" />
        </Field>
      </Grid2>
      <SaveRow isPending={updateProfile.isPending} onSave={handleSave} saved={saved} />
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Specialty tag input
// ---------------------------------------------------------------------------

function SpecialtiesInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput("");
  };

  const remove = (tag: string) => onChange(value.filter((t) => t !== tag));

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Ajouter une spécialité…"
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          disabled={!input.trim()}
        >
          Ajouter
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => remove(tag)}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-colors"
              title="Retirer"
            >
              {tag}
              <span className="text-muted-foreground/60 hover:text-destructive">×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Practice details section (directory feature only)
// ---------------------------------------------------------------------------

function PracticeSection({ profile }: { profile: UserProfile | null }) {
  const { updateProfile } = useProfile();
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    practiceName: profile?.practiceName ?? "",
    specialties: profile?.specialties ?? [],
    bio: profile?.bio ?? "",
    website: profile?.website ?? "",
  });

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync({
        practiceName: form.practiceName || undefined,
        specialties: form.specialties.length > 0 ? form.specialties : undefined,
        bio: form.bio || undefined,
        website: form.website || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success("Informations cabinet mises à jour.");
    } catch {
      toast.error("Erreur lors de l'enregistrement.");
    }
  };

  return (
    <Section
      title="Informations cabinet"
      description="Ces informations apparaissent dans l'annuaire des praticiens."
      icon={Globe}
    >
      <div className="space-y-4">
        <Grid2>
          <Field label="Nom du cabinet / pratique" className="sm:col-span-2">
            <Input
              value={form.practiceName}
              onChange={(e) => setForm((f) => ({ ...f, practiceName: e.target.value }))}
              placeholder="Cabinet de psychothérapie…"
            />
          </Field>
          <Field label="Site web" className="sm:col-span-2">
            <Input
              value={form.website}
              onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
              placeholder="https://www.monsite.ch"
              type="url"
            />
          </Field>
        </Grid2>

        <Field label="Spécialités">
          <SpecialtiesInput
            value={form.specialties}
            onChange={(v) => setForm((f) => ({ ...f, specialties: v }))}
          />
        </Field>

        <Field label="Biographie">
          <Textarea
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            placeholder="Décrivez votre approche thérapeutique et votre parcours professionnel…"
            className="min-h-[120px]"
          />
        </Field>
      </div>
      <SaveRow isPending={updateProfile.isPending} onSave={handleSave} saved={saved} />
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Directory visibility radio cards
// ---------------------------------------------------------------------------

type Visibility = "hidden" | "internal" | "public";

const VISIBILITY_OPTIONS: {
  value: Visibility;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    value: "hidden",
    label: "Masqué",
    description: "Votre profil n'apparaît pas dans l'annuaire. Personne ne peut vous trouver.",
    icon: EyeOff,
  },
  {
    value: "internal",
    label: "Membres",
    description: "Visible uniquement par les membres connectés disposant de l'accès annuaire.",
    icon: User,
  },
  {
    value: "public",
    label: "Public",
    description: "Visible par tous, y compris les visiteurs non connectés sur la page annuaire.",
    icon: Eye,
  },
];

function VisibilitySelector({
  value,
  onChange,
  isPending,
}: {
  value: Visibility;
  onChange: (v: Visibility) => void;
  isPending: boolean;
}) {
  return (
    <div className="space-y-2">
      {VISIBILITY_OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={isPending}
            onClick={() => onChange(opt.value)}
            className={cn(
              "w-full text-left rounded-lg border p-4 transition-colors",
              selected ? "border-foreground bg-primary/5" : "hover:bg-accent"
            )}
          >
            <div className="flex items-start gap-3">
              <opt.icon
                className={cn(
                  "h-4 w-4 mt-0.5 shrink-0",
                  selected ? "text-foreground" : "text-muted-foreground"
                )}
              />
              <div className="space-y-0.5 flex-1">
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.description}</p>
              </div>
              <div
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 transition-colors",
                  selected
                    ? "border-foreground bg-foreground"
                    : "border-muted-foreground/40"
                )}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Directory live preview card
// ---------------------------------------------------------------------------

function DirectoryPreview({
  profile,
  email,
}: {
  profile: UserProfile | null;
  email: string;
}) {
  if (!profile) return null;

  const name =
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
    profile.practiceName ||
    email;

  const visibility = profile.directoryVisibility;
  const isVisible = visibility !== "hidden";

  return (
    <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Aperçu de votre fiche annuaire
      </p>

      {!isVisible ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <EyeOff className="h-4 w-4" />
          Votre profil est masqué de l'annuaire.
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-start gap-3">
            {/* Avatar placeholder */}
            <div className="h-12 w-12 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-base overflow-hidden">
              {profile.profileImageUrl ? (
                <img
                  src={profile.profileImageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                name[0]?.toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{name}</p>
              {profile.practiceName && (
                <p className="text-xs text-muted-foreground truncate">
                  {profile.practiceName}
                </p>
              )}
              {(profile.city || profile.country) && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {[profile.city, profile.country].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
            <Badge
              variant={visibility === "public" ? "default" : "secondary"}
              className="text-[10px] shrink-0"
            >
              {visibility === "public" ? "Public" : "Membres"}
            </Badge>
          </div>

          {profile.bio && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {profile.bio}
            </p>
          )}

          {profile.specialties && profile.specialties.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {profile.specialties.slice(0, 4).map((s) => (
                <Badge key={s} variant="outline" className="text-[10px]">
                  {s}
                </Badge>
              ))}
            </div>
          )}

          {/* Contact info (shown per toggles) */}
          <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
            {profile.showEmail && (
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {email}
              </span>
            )}
            {profile.showPhone && profile.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {profile.phone}
              </span>
            )}
            {profile.website && (
              <span className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                {profile.website.replace(/^https?:\/\//, "")}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Directory settings section
// ---------------------------------------------------------------------------

function DirectorySection({
  profile,
  email,
}: {
  profile: UserProfile | null;
  email: string;
}) {
  const { updateVisibility, updateToggles } = useProfile();
  const currentVisibility = profile?.directoryVisibility ?? "hidden";
  const showToggles =
    currentVisibility === "internal" || currentVisibility === "public";

  const handleVisibilityChange = async (v: Visibility) => {
    try {
      await updateVisibility.mutateAsync(v);
      toast.success("Visibilité mise à jour.");
    } catch {
      toast.error("Erreur lors de la mise à jour.");
    }
  };

  const handleToggle = async (key: keyof Pick<UserProfile, "showPhone" | "showEmail" | "showAddress" | "showOnMap">, value: boolean) => {
    try {
      await updateToggles.mutateAsync({ [key]: value });
    } catch {
      toast.error("Erreur lors de la mise à jour.");
    }
  };

  return (
    <Section
      title="Paramètres annuaire"
      description="Contrôlez comment vous apparaissez dans l'annuaire des praticiens MHP."
      icon={Eye}
    >
      <div className="space-y-6">
        {/* Visibility */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Visibilité
          </p>
          <VisibilitySelector
            value={currentVisibility as Visibility}
            onChange={handleVisibilityChange}
            isPending={updateVisibility.isPending}
          />
        </div>

        {/* Contact toggles */}
        {showToggles && (
          <>
            <Separator />
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Informations de contact visibles
              </p>
              {[
                { key: "showEmail" as const, label: "Afficher l'email", value: profile?.showEmail ?? false },
                { key: "showPhone" as const, label: "Afficher le téléphone", value: profile?.showPhone ?? false },
                { key: "showAddress" as const, label: "Afficher l'adresse", value: profile?.showAddress ?? false },
                { key: "showOnMap" as const, label: "Afficher sur la carte", value: profile?.showOnMap ?? true },
              ].map(({ key, label, value }) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <Label className="text-sm font-normal cursor-pointer">{label}</Label>
                  <Switch
                    checked={value}
                    disabled={updateToggles.isPending}
                    onCheckedChange={(checked) => handleToggle(key, checked)}
                  />
                </div>
              ))}
            </div>
          </>
        )}

        <Separator />

        {/* Live preview */}
        <DirectoryPreview profile={profile} email={email} />
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Credentials section
// ---------------------------------------------------------------------------

function CredentialsSection({
  credentials,
}: {
  credentials: { id: string; credentialName: string; groupName: string | null; issuedAt: string | null; expiresAt: string | null; badgeUrl: string | null; certificateUrl: string | null; url: string | null }[];
}) {
  return (
    <Section
      title="Certifications Accredible"
      description="Certifications obtenues et vérifiées via Accredible."
      icon={Award}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {credentials.map((cred) => (
          <div
            key={cred.id}
            className="rounded-lg border bg-muted/20 p-4 space-y-3"
          >
            {/* Badge image */}
            {cred.badgeUrl && (
              <div className="flex justify-center">
                <img
                  src={cred.badgeUrl}
                  alt={cred.credentialName}
                  className="h-16 w-16 object-contain"
                />
              </div>
            )}

            <div className="space-y-0.5">
              <div className="flex items-start gap-1.5">
                <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-sm font-semibold leading-snug">
                  {cred.credentialName}
                </p>
              </div>
              {cred.groupName && (
                <p className="text-xs text-muted-foreground pl-5">
                  {cred.groupName}
                </p>
              )}
            </div>

            <div className="space-y-0.5 text-xs text-muted-foreground">
              {cred.issuedAt && (
                <p>
                  Délivré le{" "}
                  {new Date(cred.issuedAt).toLocaleDateString("fr-CH", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
              {cred.expiresAt && (
                <p>
                  Expire le{" "}
                  {new Date(cred.expiresAt).toLocaleDateString("fr-CH", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>

            {(cred.url || cred.certificateUrl) && (
              <div className="flex items-center gap-2">
                {cred.url && (
                  <a
                    href={cred.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Vérifier
                  </a>
                )}
                {cred.certificateUrl && (
                  <a
                    href={cred.certificateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Award className="h-3 w-3" />
                    Certificat
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Change password section
// ---------------------------------------------------------------------------

function PasswordSection() {
  const { changePassword } = useProfile();
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (form.newPassword !== form.confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }
    if (form.newPassword.length < 8) {
      toast.error("Le nouveau mot de passe doit comporter au moins 8 caractères.");
      return;
    }
    try {
      await changePassword.mutateAsync({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success("Mot de passe modifié.");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erreur lors du changement de mot de passe.";
      toast.error(message);
    }
  };

  const EyeToggle = useCallback(
    ({ show, toggle }: { show: boolean; toggle: () => void }) => (
      <button
        type="button"
        onClick={toggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    ),
    []
  );

  return (
    <Section title="Mot de passe" icon={Lock}>
      <div className="space-y-4 max-w-sm">
        <Field label="Mot de passe actuel">
          <div className="relative">
            <Input
              type={showCurrent ? "text" : "password"}
              value={form.currentPassword}
              onChange={set("currentPassword")}
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <EyeToggle
              show={showCurrent}
              toggle={() => setShowCurrent((s) => !s)}
            />
          </div>
        </Field>
        <Field label="Nouveau mot de passe">
          <div className="relative">
            <Input
              type={showNew ? "text" : "password"}
              value={form.newPassword}
              onChange={set("newPassword")}
              placeholder="••••••••"
              autoComplete="new-password"
            />
            <EyeToggle
              show={showNew}
              toggle={() => setShowNew((s) => !s)}
            />
          </div>
          {form.newPassword.length > 0 && form.newPassword.length < 8 && (
            <p className="text-xs text-destructive">
              Minimum 8 caractères.
            </p>
          )}
        </Field>
        <Field label="Confirmer le nouveau mot de passe">
          <Input
            type="password"
            value={form.confirmPassword}
            onChange={set("confirmPassword")}
            placeholder="••••••••"
            autoComplete="new-password"
          />
          {form.confirmPassword.length > 0 &&
            form.newPassword !== form.confirmPassword && (
              <p className="text-xs text-destructive">
                Les mots de passe ne correspondent pas.
              </p>
            )}
        </Field>
      </div>
      <SaveRow
        isPending={changePassword.isPending}
        onSave={handleSave}
        saved={saved}
      />
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Profile page
// ---------------------------------------------------------------------------

export default function Profile() {
  const { user, hasFeature } = useAuth();
  const { profileData, isLoading, isError } = useProfile();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-5 w-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
        Impossible de charger votre profil. Réessayez dans un instant.
      </div>
    );
  }

  const profile = profileData?.profile ?? null;
  const credentials = profileData?.credentials ?? [];
  const email = user?.email ?? "";
  const hasDirectory = hasFeature("directory");

  return (
    <div className="max-w-2xl space-y-5 pb-12">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mon profil</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gérez vos informations personnelles et les paramètres de votre compte.
        </p>
      </div>

      {/* Avatar */}
      <div className="rounded-xl border bg-card p-5">
        <AvatarSection profile={profile} email={email} />
      </div>

      {/* Personal info */}
      <PersonalInfoSection profile={profile} email={email} />

      {/* Address */}
      <AddressSection profile={profile} />

      {/* Practice + directory (feature gated) */}
      {hasDirectory && (
        <>
          <PracticeSection profile={profile} />
          <DirectorySection profile={profile} email={email} />
        </>
      )}

      {/* Credentials (only when user has at least one) */}
      {credentials.length > 0 && (
        <CredentialsSection credentials={credentials} />
      )}

      {/* Password */}
      <PasswordSection />

      {/* Account info */}
      {!hasDirectory && (
        <div className="rounded-xl border border-dashed p-5 space-y-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Annuaire des praticiens</p>
          </div>
          <p className="text-xs text-muted-foreground">
            L'accès à l'annuaire et la gestion de votre fiche praticien sont
            disponibles après avoir complété une formation MHP certifiante.
          </p>
        </div>
      )}
    </div>
  );
}
