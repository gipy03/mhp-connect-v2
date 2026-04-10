import { useState } from "react";
import {
  FileText,
  Download,
  Search,
  Loader2,
  Globe,
  Users,
  Lock,
  CreditCard,
  ShoppingCart,
  FolderOpen,
  ExternalLink,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  fileName: string;
  fileSize: number;
  mimeType: string;
  downloadCount: number;
  createdAt: string;
  purchased?: boolean;
  canDownload?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-CH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getFileIcon(mimeType: string) {
  return FileText;
}

export default function Resources() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const { data: allFiles, isLoading } = useQuery<FileRecord[]>({
    queryKey: ["my-files"],
    queryFn: async () => {
      const res = await fetch("/api/files/my", { credentials: "include" });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
  });

  const files = (allFiles ?? []).filter((f) => {
    if (categoryFilter && f.category !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        f.title.toLowerCase().includes(q) ||
        f.fileName.toLowerCase().includes(q) ||
        f.description?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const categories = [
    ...new Set((allFiles ?? []).map((f) => f.category).filter(Boolean)),
  ] as string[];

  const groupedFiles = new Map<string, FileRecord[]>();
  for (const file of files) {
    const group = file.programCode || file.category || "Général";
    if (!groupedFiles.has(group)) groupedFiles.set(group, []);
    groupedFiles.get(group)!.push(file);
  }

  const handleDownload = async (fileId: string) => {
    setDownloading(fileId);
    try {
      const res = await fetch(`/api/files/${fileId}/download`, {
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).error || "Erreur de téléchargement.");
      }
      const { url } = await res.json();
      window.open(url, "_blank");
    } catch (err: any) {
      toast.error(err.message || "Erreur de téléchargement.");
    } finally {
      setDownloading(null);
    }
  };

  const handlePurchase = async (fileId: string) => {
    setPurchasing(fileId);
    try {
      const res = await fetch(`/api/files/${fileId}/purchase`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).error || "Erreur.");
      }
      const data = await res.json();
      if (data.alreadyPurchased) {
        toast.success("Vous avez déjà acheté ce fichier.");
        handleDownload(fileId);
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur.");
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <div className="space-y-6 animate-page-enter">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Ressources</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fichiers et documents disponibles pour vous.
        </p>
      </div>

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
        {categories.length > 0 && (
          <Select
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter(v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : files.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FolderOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium">Aucune ressource disponible</p>
            <p className="text-xs text-muted-foreground mt-1">
              Les fichiers partagés avec vous apparaîtront ici.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {[...groupedFiles.entries()].map(([group, groupFiles]) => (
            <div key={group} className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {group}
              </h2>
              <div className="space-y-2">
                {groupFiles.map((file) => {
                  const Icon = getFileIcon(file.mimeType);
                  const isDownloading = downloading === file.id;
                  const isPurchasing = purchasing === file.id;
                  const needsPurchase =
                    file.visibility === "paid" &&
                    file.price &&
                    !file.purchased;

                  return (
                    <Card key={file.id}>
                      <CardContent className="flex items-center gap-4 py-3 px-4">
                        <Icon className="h-8 w-8 text-muted-foreground/50 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {file.title}
                          </p>
                          {file.description && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {file.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span>{formatSize(file.fileSize)}</span>
                            <span>&middot;</span>
                            <span>{formatDate(file.createdAt)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {needsPurchase ? (
                            <Button
                              size="sm"
                              variant="default"
                              className="gap-1.5"
                              onClick={() => handlePurchase(file.id)}
                              disabled={isPurchasing}
                            >
                              {isPurchasing ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <ShoppingCart className="h-3.5 w-3.5" />
                              )}
                              {file.price} {file.currency}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              onClick={() => handleDownload(file.id)}
                              disabled={isDownloading}
                            >
                              {isDownloading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Download className="h-3.5 w-3.5" />
                              )}
                              Télécharger
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
