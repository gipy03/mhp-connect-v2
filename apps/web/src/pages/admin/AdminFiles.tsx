import { useState, useRef, useCallback } from "react";
import {
  Plus,
  Upload,
  Trash2,
  Edit,
  Download,
  FileText,
  Search,
  Loader2,
  Eye,
  Lock,
  Users,
  Globe,
  CreditCard,
  X,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FileRecord {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  programCode: string | null;
  visibility: string;
  price: string | null;
  currency: string;
  fileKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  downloadCount: number;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FileStats {
  totalFiles: number;
  totalDownloads: number;
  totalPurchases: number;
}

const VISIBILITY_LABELS: Record<string, { label: string; icon: typeof Globe }> = {
  public: { label: "Public", icon: Globe },
  members: { label: "Membres", icon: Users },
  program: { label: "Programme", icon: Lock },
  paid: { label: "Payant", icon: CreditCard },
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UploadDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [programCode, setProgramCode] = useState("");
  const [visibility, setVisibility] = useState("members");
  const [price, setPrice] = useState("");
  const [uploading, setUploading] = useState(false);

  const resetForm = useCallback(() => {
    setSelectedFile(null);
    setTitle("");
    setDescription("");
    setCategory("");
    setProgramCode("");
    setVisibility("members");
    setPrice("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Veuillez sélectionner un fichier.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("title", title || selectedFile.name);
    if (description) formData.append("description", description);
    if (category) formData.append("category", category);
    if (programCode) formData.append("programCode", programCode);
    formData.append("visibility", visibility);
    if (visibility === "paid" && price) formData.append("price", price);

    setUploading(true);
    try {
      const res = await fetch("/api/files/admin/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).error || "Erreur lors du téléchargement.");
      }

      toast.success("Fichier téléchargé avec succès.");
      qc.invalidateQueries({ queryKey: ["admin-files"] });
      qc.invalidateQueries({ queryKey: ["admin-files-stats"] });
      resetForm();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors du téléchargement.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          resetForm();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Télécharger un fichier</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Fichier</Label>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.mp3,.mp4,.zip,.jpg,.jpeg,.png,.webp,.ppt,.pptx"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setSelectedFile(f);
                if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Titre</Label>
            <Input
              placeholder="Titre du fichier"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              placeholder="Description (optionnel)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <Input
                placeholder="ex: Guides, Certificats"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Code programme</Label>
              <Input
                placeholder="ex: OMNI-PRACT"
                value={programCode}
                onChange={(e) => setProgramCode(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Visibilité</Label>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="members">Membres</SelectItem>
                  <SelectItem value="program">Programme</SelectItem>
                  <SelectItem value="paid">Payant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {visibility === "paid" && (
              <div className="space-y-1.5">
                <Label>Prix (CHF)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={uploading}>
            Annuler
          </Button>
          <Button
            onClick={handleUpload}
            disabled={uploading || !selectedFile}
            className="gap-1.5"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Télécharger
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  open,
  onClose,
  file,
}: {
  open: boolean;
  onClose: () => void;
  file: FileRecord;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(file.title);
  const [description, setDescription] = useState(file.description ?? "");
  const [category, setCategory] = useState(file.category ?? "");
  const [programCode, setProgramCode] = useState(file.programCode ?? "");
  const [visibility, setVisibility] = useState(file.visibility);
  const [price, setPrice] = useState(file.price ?? "");

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch(`/api/files/admin/${file.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as any).error || "Erreur");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Fichier mis à jour.");
      qc.invalidateQueries({ queryKey: ["admin-files"] });
      onClose();
    },
    onError: () => toast.error("Erreur lors de la mise à jour."),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier le fichier</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Titre</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Code programme</Label>
              <Input
                value={programCode}
                onChange={(e) => setProgramCode(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Visibilité</Label>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="members">Membres</SelectItem>
                  <SelectItem value="program">Programme</SelectItem>
                  <SelectItem value="paid">Payant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {visibility === "paid" && (
              <div className="space-y-1.5">
                <Label>Prix (CHF)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={() =>
              updateMutation.mutate({
                title: title.trim(),
                description: description.trim() || null,
                category: category.trim() || null,
                programCode: programCode.trim() || null,
                visibility,
                price: visibility === "paid" ? price || null : null,
              })
            }
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending && (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            )}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminFiles() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editFile, setEditFile] = useState<FileRecord | null>(null);
  const [search, setSearch] = useState("");
  const [filterVisibility, setFilterVisibility] = useState<string>("");
  const qc = useQueryClient();

  const { data: allFiles, isLoading } = useQuery<FileRecord[]>({
    queryKey: ["admin-files"],
    queryFn: async () => {
      const res = await fetch("/api/files/admin", { credentials: "include" });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
  });

  const { data: stats } = useQuery<FileStats>({
    queryKey: ["admin-files-stats"],
    queryFn: async () => {
      const res = await fetch("/api/files/admin/stats", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/files/admin/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erreur");
    },
    onSuccess: () => {
      toast.success("Fichier supprimé.");
      qc.invalidateQueries({ queryKey: ["admin-files"] });
      qc.invalidateQueries({ queryKey: ["admin-files-stats"] });
    },
    onError: () => toast.error("Erreur lors de la suppression."),
  });

  const files = (allFiles ?? []).filter((f) => {
    if (filterVisibility && f.visibility !== filterVisibility) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        f.title.toLowerCase().includes(q) ||
        f.fileName.toLowerCase().includes(q) ||
        f.category?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Fichiers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez les fichiers partagés avec les membres et le public.
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => setUploadOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Télécharger
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-2xl font-bold">{stats.totalFiles}</p>
              <p className="text-xs text-muted-foreground">Fichiers</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-2xl font-bold">{stats.totalDownloads}</p>
              <p className="text-xs text-muted-foreground">Téléchargements</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-2xl font-bold">{stats.totalPurchases}</p>
              <p className="text-xs text-muted-foreground">Achats</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={filterVisibility}
          onValueChange={(v) => setFilterVisibility(v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Visibilité" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            <SelectItem value="public">Public</SelectItem>
            <SelectItem value="members">Membres</SelectItem>
            <SelectItem value="program">Programme</SelectItem>
            <SelectItem value="paid">Payant</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : files.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Aucun fichier trouvé.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {files.map((file) => {
            const vis = VISIBILITY_LABELS[file.visibility] ?? {
              label: file.visibility,
              icon: Eye,
            };
            const VisIcon = vis.icon;
            return (
              <Card key={file.id}>
                <CardContent className="flex items-center gap-4 py-3 px-4">
                  <FileText className="h-8 w-8 text-muted-foreground/50 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span>{file.fileName}</span>
                      <span>&middot;</span>
                      <span>{formatSize(file.fileSize)}</span>
                      {file.category && (
                        <>
                          <span>&middot;</span>
                          <span>{file.category}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="gap-1 text-xs">
                      <VisIcon className="h-3 w-3" />
                      {vis.label}
                    </Badge>
                    {file.visibility === "paid" && file.price && (
                      <Badge variant="secondary" className="text-xs">
                        {file.price} {file.currency}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <Download className="h-3 w-3" />
                      {file.downloadCount}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setEditFile(file)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm("Supprimer ce fichier ?")) {
                          deleteMutation.mutate(file.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />
      {editFile && (
        <EditDialog
          open={!!editFile}
          onClose={() => setEditFile(null)}
          file={editFile}
        />
      )}
    </div>
  );
}
