import {
  Eye,
  EyeOff,
  User,
  MapPin,
  Globe,
  Mail,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { useProfile, type UserProfile } from "@/hooks/useProfile";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Section } from "./shared";

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
    <div className="space-y-2" role="radiogroup" aria-label="Visibilité du profil">
      {VISIBILITY_OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={isPending}
            onClick={() => onChange(opt.value)}
            className={cn(
              "w-full text-left rounded-lg border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
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

export function DirectorySection({
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

        <DirectoryPreview profile={profile} email={email} />
      </div>
    </Section>
  );
}
