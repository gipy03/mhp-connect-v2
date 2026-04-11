import { useState } from "react";
import {
  RefreshCw,
  Edit,
  Loader2,
  GraduationCap,
  Mail,
  Phone,
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

interface Trainer {
  id: string;
  digiformaId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  bio: string | null;
  photoUrl: string | null;
  specialties: string[];
  role: string | null;
  active: boolean;
  lastSyncedAt: string | null;
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

export default function AdminTrainers() {
  const queryClient = useQueryClient();
  const [editTrainer, setEditTrainer] = useState<Trainer | null>(null);
  const [editForm, setEditForm] = useState({
    bio: "",
    photoUrl: "",
    specialties: "",
    role: "",
    active: true,
  });

  const { data: trainersList, isLoading } = useQuery<Trainer[]>({
    queryKey: ["admin-trainers"],
    queryFn: () => api.get("/trainers"),
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post("/trainers/sync", {}),
    onSuccess: (data: any) => {
      toast.success(`Sync terminée: ${data.created} créés, ${data.updated} mis à jour`);
      queryClient.invalidateQueries({ queryKey: ["admin-trainers"] });
    },
    onError: () => toast.error("Erreur lors de la synchronisation."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; bio?: string; photoUrl?: string; specialties?: string[]; role?: string; active?: boolean }) =>
      api.patch(`/trainers/${id}`, data),
    onSuccess: () => {
      toast.success("Formateur mis à jour.");
      queryClient.invalidateQueries({ queryKey: ["admin-trainers"] });
      setEditTrainer(null);
    },
    onError: () => toast.error("Erreur lors de la mise à jour."),
  });

  function openEdit(trainer: Trainer) {
    setEditTrainer(trainer);
    setEditForm({
      bio: trainer.bio || "",
      photoUrl: trainer.photoUrl || "",
      specialties: (trainer.specialties || []).join(", "),
      role: trainer.role || "Formateur",
      active: trainer.active,
    });
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
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => openEdit(trainer)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Modifier {editTrainer?.firstName} {editTrainer?.lastName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
              <Label>URL de la photo</Label>
              <Input
                value={editForm.photoUrl}
                onChange={(e) => setEditForm((f) => ({ ...f, photoUrl: e.target.value }))}
                placeholder="https://..."
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
    </AdminPageShell>
  );
}
