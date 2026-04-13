import { useState, useRef } from "react";
import { Upload, FileText, Trash2, Download, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

interface DepositFile {
  id: string;
  instructorId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  note: string | null;
  createdAt: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const FILE_ICON_COLORS: Record<string, string> = {
  "application/pdf": "text-red-500",
  "image/jpeg": "text-blue-500",
  "image/png": "text-blue-500",
  "image/webp": "text-blue-500",
};

export default function TrainerFiles() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");

  const { data: files, isLoading } = useQuery<DepositFile[]>({
    queryKey: ["instructor", "files"],
    queryFn: async () => {
      const res = await fetch("/api/instructor/files", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load files");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const res = await fetch(`/api/instructor/files/${fileId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      toast.success("Fichier supprimé.");
      queryClient.invalidateQueries({ queryKey: ["instructor", "files"] });
    },
    onError: () => toast.error("Erreur lors de la suppression."),
  });

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      if (note.trim()) form.append("note", note.trim());
      const res = await fetch("/api/instructor/files", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error || "Upload failed");
      }
      toast.success("Fichier déposé avec succès.");
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["instructor", "files"] });
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'upload.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-5 pb-12 animate-page-enter">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dépôt de fichiers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Déposez vos documents ici. Ils seront visibles uniquement par l'administration.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="space-y-3">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note ou description du fichier (optionnel)"
          />
          <div className="flex items-center gap-3">
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-2"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {uploading ? "Envoi en cours…" : "Choisir un fichier"}
            </Button>
            <span className="text-xs text-muted-foreground">
              PDF, Word, Excel, PowerPoint, images, ZIP — max 50 Mo
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.zip"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="px-5 py-3 border-b">
          <h3 className="text-sm font-semibold">Mes fichiers déposés</h3>
        </div>
        {isLoading ? (
          <div className="p-5 space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : !files || files.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
            Aucun fichier déposé pour le moment.
          </div>
        ) : (
          <div className="divide-y">
            {files.map((file) => (
              <div key={file.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <FileText className={`h-4 w-4 shrink-0 ${FILE_ICON_COLORS[file.mimeType] || "text-muted-foreground"}`} />
                    <span className="text-sm font-medium truncate">{file.originalName}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 ml-6">
                    {formatFileSize(file.fileSize)} · {formatDate(file.createdAt)}
                    {file.note && <span className="ml-2 italic">— {file.note}</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <a
                    href={`/api/instructor/files/${file.id}/download`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
                    title="Télécharger"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(file.id)}
                    disabled={deleteMutation.isPending}
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
