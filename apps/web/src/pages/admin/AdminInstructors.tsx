import { useState, useRef } from "react";
import {
  RefreshCw,
  Edit,
  Loader2,
  GraduationCap,
  Mail,
  Phone,
  Upload,
  Globe,
  FileText,
  Download,
  Trash2,
  X,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AdminPageShell, AdminEmptyState } from "@/components/AdminPageShell";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

interface Instructor {
  id: string;
  digiformaId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  bio: string | null;
  photoUrl: string | null;
  website: string | null;
  specialties: string[];
  role: string | null;
  active: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
}

interface InstructorFile {
  id: string;
  instructorId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  note: string | null;
  createdAt: string;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("fr-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function AdminInstructors() {
  const queryClient = useQueryClient();
  const [editTrainer, setEditTrainer] = useState<Instructor | null>(null);
  const [filesTrainer, setFilesTrainer] = useState<Instructor | null>(null);
  const [editForm, setEditForm] = useState({
    bio: "",
    photoUrl: "",
    website: "",
    specialties: "",
    role: "",
    active: true,
  });
  const [uploading, setUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const { data: trainersList, isLoading } = useQuery<Instructor[]>({
    queryKey: ["admin-trainers"],
    queryFn: () => api.get("/instructors"),
  });

  const { data: trainerFiles } = useQuery<InstructorFile[]>({
    queryKey: ["admin-trainer-files", filesTrainer?.id],
    queryFn: () => api.get(`/instructors/${filesTrainer!.id}/files`),
    enabled: !!filesTrainer,
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post("/instructors/sync", {}),
    onSuccess: (data: any) => {
      toast.success(`Sync terminée: ${data.created} créés, ${data.updated} mis à jour`);
      queryClient.invalidateQueries({ queryKey: ["admin-trainers"] });
    },
    onError: () => toast.error("Erreur lors de la synchronisation."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; bio?: string; photoUrl?: string; website?: string; specialties?: string[]; role?: string; active?: boolean }) =>
      api.patch(`/instructors/${id}`, data),
    onSuccess: () => {
      toast.success("Formateur mis à jour.");
      queryClient.invalidateQueries({ queryKey: ["admin-trainers"] });
      setEditTrainer(null);
    },
    onError: () => toast.error("Erreur lors de la mise à jour."),
  });

  const deleteFileMutation = useMutation({
    mutationFn: (fileId: string) => api.delete(`/instructors/files/${fileId}`),
    onSuccess: () => {
      toast.success("Fichier supprimé.");
      queryClient.invalidateQueries({ queryKey: ["admin-trainer-files", filesTrainer?.id] });
    },
    onError: () => toast.error("Erreur lors de la suppression."),
  });

  function openEdit(trainer: Instructor) {
    setEditTrainer(trainer);
    setEditForm({
      bio: trainer.bio || "",
      photoUrl: trainer.photoUrl || "",
      website: trainer.website || "",
      specialties: (trainer.specialties || []).join(", "),
      role: trainer.role || "Formateur",
      active: trainer.active,
    });
  }

  async function handlePhotoUpload(file: File) {
    if (!editTrainer) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("photo", file);
      const res = await fetch(`/api/instructors/${editTrainer.id}/photo`, {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setEditForm((f) => ({ ...f, photoUrl: data.photoUrl }));
      queryClient.invalidateQueries({ queryKey: ["admin-trainers"] });
      toast.success("Photo mise à jour.");
    } catch {
      toast.error("Erreur lors de l'upload de la photo.");
    } finally {
      setUploading(false);
    }
  }

  const activeCount = trainersList?.filter((t) => t.active).length ?? 0;

  return (
    <AdminPageShell
      title="Équipe pédagogique"
      description={`${trainersList?.length ?? 0} formateurs (${activeCount} actifs)`}
      actions={
        <Button
          size="sm"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
        >
          {syncMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-1" />
          )}
          Synchroniser Digiforma
        </Button>
      }
    >
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : !trainersList || trainersList.length === 0 ? (
        <AdminEmptyState
          icon={GraduationCap}
          title="Aucun formateur"
          description="Lancez la synchronisation Digiforma pour importer les formateurs."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trainersList.map((trainer) => (
            <Card
              key={trainer.id}
              className={`hover:shadow-md transition-shadow ${!trainer.active ? "opacity-50" : ""}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    {trainer.photoUrl ? (
                      <img
                        src={trainer.photoUrl}
                        alt={`${trainer.firstName} ${trainer.lastName}`}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-primary/5 flex items-center justify-center">
                        <GraduationCap className="h-5 w-5 text-primary/40" />
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-sm">
                        {trainer.firstName} {trainer.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground">{trainer.role || "Formateur"}</div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFilesTrainer(trainer)} title="Fichiers déposés">
                      <FileText className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(trainer)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {trainer.bio && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{trainer.bio}</p>
                )}

                {trainer.specialties && trainer.specialties.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {trainer.specialties.map((s, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground/70 mt-auto">
                  {trainer.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {trainer.email}
                    </span>
                  )}
                  {trainer.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {trainer.phone}
                    </span>
                  )}
                  {trainer.website && (
                    <a href={trainer.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                      <Globe className="h-3 w-3" /> Site web
                    </a>
                  )}
                </div>

                <div className="flex items-center justify-between mt-3 pt-2 border-t">
                  <Badge variant={trainer.active ? "default" : "outline"} className="text-[10px] px-1.5 py-0">
                    {trainer.active ? "Actif" : "Inactif"}
                  </Badge>
                  {trainer.digiformaId && (
                    <span className="text-[10px] text-muted-foreground/50">Digiforma #{trainer.digiformaId}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editTrainer} onOpenChange={() => setEditTrainer(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Modifier {editTrainer?.firstName} {editTrainer?.lastName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                {editForm.photoUrl ? (
                  <img
                    src={editForm.photoUrl}
                    alt="Photo"
                    className="h-16 w-16 rounded-full object-cover border-2 border-muted"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <GraduationCap className="h-6 w-6 text-primary/40" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow hover:bg-primary/90 transition-colors"
                  title="Changer la photo"
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
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
              </div>
              <div className="text-sm text-muted-foreground">
                Cliquez pour importer une photo de profil.
                <br />
                <span className="text-xs">JPEG, PNG ou WebP, max 5 Mo</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Rôle / Fonction</Label>
              <Input
                value={editForm.role}
                onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                placeholder="Formateur, Responsable pédagogique..."
              />
            </div>
            <div className="space-y-2">
              <Label>Bio</Label>
              <Textarea
                value={editForm.bio}
                onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))}
                placeholder="Biographie du formateur..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Site web</Label>
              <Input
                value={editForm.website}
                onChange={(e) => setEditForm((f) => ({ ...f, website: e.target.value }))}
                placeholder="https://www.exemple.ch"
              />
            </div>
            <div className="space-y-2">
              <Label>Spécialités (séparées par des virgules)</Label>
              <Input
                value={editForm.specialties}
                onChange={(e) => setEditForm((f) => ({ ...f, specialties: e.target.value }))}
                placeholder="Hypnose, PNL, Coaching..."
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={editForm.active}
                onChange={(e) => setEditForm((f) => ({ ...f, active: e.target.checked }))}
                className="rounded border-input"
              />
              Actif (visible publiquement)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTrainer(null)}>Annuler</Button>
            <Button
              onClick={() => {
                if (!editTrainer) return;
                updateMutation.mutate({
                  id: editTrainer.id,
                  bio: editForm.bio || undefined,
                  photoUrl: editForm.photoUrl || undefined,
                  website: editForm.website,
                  specialties: editForm.specialties.split(",").map((s) => s.trim()).filter(Boolean),
                  role: editForm.role || undefined,
                  active: editForm.active,
                });
              }}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!filesTrainer} onOpenChange={() => setFilesTrainer(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Fichiers déposés — {filesTrainer?.firstName} {filesTrainer?.lastName}
            </DialogTitle>
          </DialogHeader>
          {!trainerFiles || trainerFiles.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Aucun fichier déposé par ce formateur.
            </div>
          ) : (
            <div className="space-y-2">
              {trainerFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{file.originalName}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatFileSize(file.fileSize)} · {formatDate(file.createdAt)}
                    </div>
                    {file.note && (
                      <div className="text-xs text-muted-foreground mt-1 italic">
                        {file.note}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <a
                      href={`/api/instructors/files/${file.id}/download`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
                      title="Télécharger"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteFileMutation.mutate(file.id)}
                      disabled={deleteFileMutation.isPending}
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  );
}
