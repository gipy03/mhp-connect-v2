import { useState, useEffect } from "react";
import { User, Camera, Save, X } from "lucide-react";
import { toast } from "sonner";
import { useTrainerProfile } from "@/hooks/useTrainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function ProfileSkeleton() {
  return (
    <div className="max-w-2xl space-y-5 pb-12">
      <div>
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 mt-2" />
      </div>
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </div>
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-24 w-full rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    </div>
  );
}

export default function TrainerProfile() {
  const { profile, isLoading, isError, update } = useTrainerProfile();
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [specialtiesInput, setSpecialtiesInput] = useState("");

  useEffect(() => {
    if (profile) {
      setBio(profile.bio ?? "");
      setPhone(profile.phone ?? "");
      setPhotoUrl(profile.photoUrl ?? "");
      setSpecialtiesInput((profile.specialties ?? []).join(", "));
    }
  }, [profile]);

  if (isLoading) return <ProfileSkeleton />;

  if (isError || !profile) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
        Impossible de charger votre profil formateur.
      </div>
    );
  }

  const handleSave = async () => {
    const specialties = specialtiesInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      await update.mutateAsync({ bio, phone, photoUrl, specialties });
      toast.success("Profil mis à jour.");
      setEditing(false);
    } catch {
      toast.error("Impossible de sauvegarder les modifications.");
    }
  };

  const handleCancel = () => {
    setBio(profile.bio ?? "");
    setPhone(profile.phone ?? "");
    setPhotoUrl(profile.photoUrl ?? "");
    setSpecialtiesInput((profile.specialties ?? []).join(", "));
    setEditing(false);
  };

  return (
    <div className="max-w-2xl space-y-5 pb-12 animate-page-enter">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mon profil formateur</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez vos informations en tant que formateur.
          </p>
        </div>
        {!editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Modifier
          </Button>
        )}
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-4">
          <div className="relative">
            {profile.photoUrl ? (
              <img
                src={profile.photoUrl}
                alt={`${profile.firstName} ${profile.lastName}`}
                className="h-20 w-20 rounded-full object-cover border-2 border-muted"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="h-8 w-8" />
              </div>
            )}
            {editing && (
              <button
                className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow"
                title="Changer la photo"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold">
              {profile.firstName} {profile.lastName}
            </h2>
            <p className="text-sm text-muted-foreground">{profile.role ?? "Formateur"}</p>
            {profile.email && (
              <p className="text-xs text-muted-foreground mt-0.5">{profile.email}</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Biographie
        </h3>
        {editing ? (
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Décrivez votre parcours, vos compétences..."
            className="min-h-[120px]"
          />
        ) : (
          <p className="text-sm whitespace-pre-wrap">
            {profile.bio || <span className="italic text-muted-foreground">Aucune biographie renseignée.</span>}
          </p>
        )}
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Téléphone
        </h3>
        {editing ? (
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+41 XX XXX XX XX"
          />
        ) : (
          <p className="text-sm">
            {profile.phone || <span className="italic text-muted-foreground">Non renseigné</span>}
          </p>
        )}
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Photo URL
        </h3>
        {editing ? (
          <Input
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://..."
          />
        ) : (
          <p className="text-sm">
            {profile.photoUrl ? (
              <a href={profile.photoUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs truncate block max-w-xs">
                {profile.photoUrl}
              </a>
            ) : (
              <span className="italic text-muted-foreground">Aucune photo</span>
            )}
          </p>
        )}
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Spécialités
        </h3>
        {editing ? (
          <div className="space-y-1.5">
            <Input
              value={specialtiesInput}
              onChange={(e) => setSpecialtiesInput(e.target.value)}
              placeholder="Hypnose, PNL, Coaching (séparées par des virgules)"
            />
            <p className="text-xs text-muted-foreground">Séparez chaque spécialité par une virgule.</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {(profile.specialties ?? []).length > 0 ? (
              profile.specialties.map((s) => (
                <Badge key={s} variant="secondary" className="text-xs">
                  {s}
                </Badge>
              ))
            ) : (
              <span className="text-sm italic text-muted-foreground">Aucune spécialité renseignée.</span>
            )}
          </div>
        )}
      </div>

      {editing && (
        <div className="flex items-center gap-2 justify-end">
          <Button variant="outline" onClick={handleCancel} disabled={update.isPending}>
            <X className="h-4 w-4 mr-1.5" />
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={update.isPending}>
            <Save className="h-4 w-4 mr-1.5" />
            {update.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      )}
    </div>
  );
}
