import { useState, useRef } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useProfile, type UserProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";

export function AvatarSection({
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
    <section className="flex flex-col sm:flex-row items-center sm:items-center gap-4 sm:gap-5">
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
          className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-background border shadow-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          aria-label="Modifier la photo de profil"
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
