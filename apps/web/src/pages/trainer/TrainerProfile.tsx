import { useState, useEffect, useRef } from "react";
import { User, Camera, Save, X, Globe, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useInstructorProfile } from "@/hooks/useInstructor";
import { useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
  const { profile, isLoading, isError, update } = useInstructorProfile();
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [website, setWebsite] = useState("");
  const [specialtiesInput, setSpecialtiesInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setBio(profile.bio ?? "");
      setPhone(profile.phone ?? "");
      setPhotoUrl(profile.photoUrl ?? "");
      setWebsite(profile.website ?? "");
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
      await update.mutateAsync({ bio, phone, photoUrl, website, specialties });
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
    setWebsite(profile.website ?? "");
    setSpecialtiesInput((profile.specialties ?? []).join(", "));
    setEditing(false);
  };

  async function handlePhotoUpload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("photo", file);
      const res = await fetch("/api/instructor/photo", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setPhotoUrl(data.photoUrl);
      queryClient.invalidateQueries({ queryKey: ["instructor", "profile"] });
      toast.success("Photo mise à jour.");
    } catch {
      toast.error("Erreur lors de l'upload de la photo.");
    } finally {
      setUploading(false);
    }
  }

  const currentPhoto = editing ? photoUrl : profile.photoUrl;

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
            {currentPhoto ? (
              <img
                src={currentPhoto}
                alt={`${profile.firstName} ${profile.lastName}`}
                className="h-20 w-20 rounded-full object-cover border-2 border-muted"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="h-8 w-8" />
              </div>
            )}
            {editing && (
              <>
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow hover:bg-primary/90 transition-colors"
                  title="Changer la photo"
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePhotoUpload(file);
                    e.target.value = "";
                  }}
                />
              </>
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
            {!editing && profile.website && (
              <a href={profile.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5">
                <Globe className="h-3 w-3" /> {profile.website}
              </a>
            )}
          </div>
        </div>
        {editing && (
          <p className="text-xs text-muted-foreground mt-2">
            Cliquez sur l'icône pour importer une photo (JPEG, PNG, WebP, max 5 Mo).
          </p>
        )}
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
          Site web
        </h3>
        {editing ? (
          <Input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://www.exemple.ch"
          />
        ) : (
          <p className="text-sm">
            {profile.website ? (
              <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-primary underline text-sm">
                {profile.website}
              </a>
            ) : (
              <span className="italic text-muted-foreground">Aucun site web</span>
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
