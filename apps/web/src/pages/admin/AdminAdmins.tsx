import { useState } from "react";
import {
  Shield,
  Plus,
  Trash2,
  Edit,
  Loader2,
  Crown,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  isSuperAdmin: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Jamais";
  return new Date(dateStr).toLocaleDateString("fr-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminAdmins() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [form, setForm] = useState({ email: "", password: "", displayName: "", isSuperAdmin: false });
  const [editForm, setEditForm] = useState({ displayName: "", password: "", isSuperAdmin: false });

  const { data: admins, isLoading } = useQuery<AdminUser[]>({
    queryKey: ["admin-users"],
    queryFn: () => api.get("/admin-auth/users"),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.post("/admin-auth/users", data),
    onSuccess: () => {
      toast.success("Administrateur créé.");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setCreateOpen(false);
      setForm({ email: "", password: "", displayName: "", isSuperAdmin: false });
    },
    onError: (err: any) => toast.error(err?.data?.error || "Erreur lors de la création."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; displayName?: string; password?: string; isSuperAdmin?: boolean }) =>
      api.patch(`/admin-auth/users/${id}`, data),
    onSuccess: () => {
      toast.success("Administrateur mis à jour.");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setEditUser(null);
    },
    onError: (err: any) => toast.error(err?.data?.error || "Erreur lors de la mise à jour."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin-auth/users/${id}`),
    onSuccess: () => {
      toast.success("Administrateur supprimé.");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err: any) => toast.error(err?.data?.error || "Erreur lors de la suppression."),
  });

  function openEdit(user: AdminUser) {
    setEditUser(user);
    setEditForm({
      displayName: user.displayName || "",
      password: "",
      isSuperAdmin: user.isSuperAdmin,
    });
  }

  return (
    <AdminPageShell
      title="Administrateurs"
      description="Gérez les comptes administrateurs de la plateforme"
      actions={
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Ajouter
        </Button>
      }
    >
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : !admins || admins.length === 0 ? (
        <AdminEmptyState
          icon={Shield}
          title="Aucun administrateur"
          description="Ajoutez un administrateur pour commencer."
        />
      ) : (
        <div className="space-y-2">
          {admins.map((admin) => (
            <Card key={admin.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5 shrink-0">
                      {admin.isSuperAdmin ? (
                        <Crown className="h-5 w-5 text-amber-500" />
                      ) : (
                        <Shield className="h-5 w-5 text-primary/60" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {admin.displayName || admin.email}
                        </span>
                        {admin.isSuperAdmin && (
                          <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-700 border-amber-200">
                            Super Admin
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{admin.email}</p>
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                        Dernière connexion: {formatDate(admin.lastLoginAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(admin)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm("Supprimer cet administrateur ?")) {
                          deleteMutation.mutate(admin.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvel administrateur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="admin@exemple.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Nom d'affichage</Label>
              <Input
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                placeholder="Prénom Nom"
              />
            </div>
            <div className="space-y-2">
              <Label>Mot de passe (min. 8 caractères)</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.isSuperAdmin}
                onChange={(e) => setForm((f) => ({ ...f, isSuperAdmin: e.target.checked }))}
                className="rounded border-input"
              />
              Super administrateur (peut gérer les autres admins)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.email || !form.password}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier {editUser?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom d'affichage</Label>
              <Input
                value={editForm.displayName}
                onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Nouveau mot de passe (laisser vide pour conserver)</Label>
              <Input
                type="password"
                value={editForm.password}
                onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={editForm.isSuperAdmin}
                onChange={(e) => setEditForm((f) => ({ ...f, isSuperAdmin: e.target.checked }))}
                className="rounded border-input"
              />
              Super administrateur
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Annuler</Button>
            <Button
              onClick={() => {
                if (!editUser) return;
                const payload: Record<string, unknown> = {
                  id: editUser.id,
                  displayName: editForm.displayName,
                  isSuperAdmin: editForm.isSuperAdmin,
                };
                if (editForm.password) payload.password = editForm.password;
                updateMutation.mutate(payload as any);
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
