import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  X,
  Trash2,
  Save,
  AlertCircle,
  ArrowLeft,
  Upload,
  ImageIcon,
  Search,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  CheckSquare,
  Square,
  Loader2,
  Calendar,
  MapPin,
  Monitor,
  Users,
  ExternalLink,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AdminPageShell, AdminTableSkeleton, AdminEmptyState } from "@/components/AdminPageShell";

interface OverrideIndicator {
  programCode: string;
  published: boolean;
  category?: string | null;
}

interface DigiformaAdminProgram {
  id: string;
  code: string | null;
  name: string;
  description?: string | null;
  override: OverrideIndicator | null;
}

interface PricingTier {
  id: string;
  programCode: string;
  pricingType: string;
  label: string;
  amount: string;
  unit: string;
  currency: string;
  conditions: Record<string, unknown> | null;
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;
}

interface FeatureGrant {
  id: string;
  programCode: string;
  featureKey: string;
  credentialRequired: boolean;
}

interface ProgramOverrideData {
  id: string;
  displayName: string | null;
  description: string | null;
  imageUrl: string | null;
  tags: string[] | null;
  category: string | null;
  sortOrder: number;
  highlightLabel: string | null;
  hybridEnabled: boolean;
  published: boolean;
}

interface ProgramDetail {
  programCode: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  tags: string[];
  category: string | null;
  sortOrder: number;
  highlightLabel: string | null;
  hybridEnabled: boolean;
  published: boolean;
  pricingTiers: PricingTier[];
  featureGrants: FeatureGrant[];
  override: ProgramOverrideData | null;
  digiforma: { name: string; description?: string | null } | null;
}

interface SessionRow {
  id: string;
  digiformaId: string;
  name: string | null;
  code: string | null;
  programCode: string | null;
  startDate: string | null;
  endDate: string | null;
  place: string | null;
  placeName: string | null;
  remote: boolean;
  participants: { assigned: number; attended: number; cancelled: number; noshow: number };
  instructors: { id: string; name: string }[];
}

type TabId = "presentation" | "tarifs" | "acces" | "sessions";
type SortKey = "name" | "status" | "category";
type SortDir = "asc" | "desc";
type StatusFilter = "all" | "published" | "draft" | "unconfigured";

const FEATURE_KEYS = ["community", "directory", "supervision", "offers"];
const PRICING_TYPES = ["standard", "retake", "earlybird", "group", "custom"];
const PRICING_UNITS = ["total", "per_day", "per_session"];

export default function AdminPrograms() {
  const qc = useQueryClient();
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("presentation");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [bulkDialog, setBulkDialog] = useState<"publish" | "unpublish" | "category" | null>(null);
  const [bulkCategory, setBulkCategory] = useState("");

  const { data: programs = [], isLoading } = useQuery<DigiformaAdminProgram[]>({
    queryKey: ["admin", "digiforma-programs"],
    queryFn: () => api.get<DigiformaAdminProgram[]>("/programs/admin/digiforma"),
  });

  const bulkMutation = useMutation({
    mutationFn: (params: { programCodes: string[]; action: string; value?: string }) =>
      api.post("/admin/programs/bulk", params),
    onSuccess: () => {
      toast.success("Opération effectuée.");
      qc.invalidateQueries({ queryKey: ["admin", "digiforma-programs"] });
      setSelectedCodes(new Set());
      setBulkDialog(null);
    },
    onError: () => toast.error("Erreur lors de l'opération."),
  });

  const filtered = useMemo(() => {
    let result = programs;

    if (statusFilter !== "all") {
      result = result.filter((p) => {
        if (statusFilter === "published") return p.override?.published === true;
        if (statusFilter === "draft") return p.override && !p.override.published;
        if (statusFilter === "unconfigured") return !p.override;
        return true;
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.code ?? "").toLowerCase().includes(q)
      );
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name, "fr");
          break;
        case "status": {
          const statusVal = (p: DigiformaAdminProgram) =>
            p.override?.published ? 0 : p.override ? 1 : 2;
          cmp = statusVal(a) - statusVal(b);
          break;
        }
        case "category": {
          const catA = a.override?.category ?? "";
          const catB = b.override?.category ?? "";
          cmp = catA.localeCompare(catB, "fr");
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [programs, search, sortKey, sortDir, statusFilter]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const toggleSelect = (code: string | null) => {
    if (!code) return;
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedCodes.size === filtered.length) {
      setSelectedCodes(new Set());
    } else {
      setSelectedCodes(new Set(filtered.map((p) => p.code).filter(Boolean) as string[]));
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/40" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  const categories = useMemo(() => {
    const s = new Set<string>();
    for (const p of programs) {
      if (p.override?.category) s.add(p.override.category);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, "fr"));
  }, [programs]);

  if (selectedCode) {
    return (
      <AdminPageShell
        title="Programmes"
        description="Détail du programme"
      >
        <ProgramEditor
          code={selectedCode}
          dfName={programs.find((p) => p.code === selectedCode)?.name ?? ""}
          tab={tab}
          setTab={setTab}
          onBack={() => { setSelectedCode(null); setTab("presentation"); }}
        />
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      title="Programmes"
      description="Gérez les overrides, tarifs et accès pour les programmes DigiForma."
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un programme..."
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="published">Publiés</SelectItem>
            <SelectItem value="draft">Brouillons</SelectItem>
            <SelectItem value="unconfigured">Non configurés</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground ml-auto">
          {filtered.length} programme{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      {selectedCodes.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-lg border bg-muted/30">
          <span className="text-sm font-medium">
            {selectedCodes.size} sélectionné{selectedCodes.size > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs h-7"
              onClick={() => setBulkDialog("publish")}
            >
              <Eye className="h-3 w-3" />
              Publier
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs h-7"
              onClick={() => setBulkDialog("unpublish")}
            >
              <EyeOff className="h-3 w-3" />
              Dépublier
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs h-7"
              onClick={() => setBulkDialog("category")}
            >
              Catégorie
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-7"
              onClick={() => setSelectedCodes(new Set())}
            >
              Tout désélectionner
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <AdminTableSkeleton rows={8} cols={5} />
      ) : filtered.length === 0 ? (
        <AdminEmptyState
          icon={ImageIcon}
          title="Aucun programme trouvé"
          description="Modifiez vos filtres ou synchronisez les données DigiForma."
        />
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-3 py-2.5 w-8">
                    <button onClick={toggleAll} className="flex items-center" aria-label="Tout sélectionner">
                      {selectedCodes.size === filtered.length && filtered.length > 0 ? (
                        <CheckSquare className="h-4 w-4 text-primary" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 py-2.5">
                    <button
                      className="flex items-center gap-1 text-xs font-medium hover:text-foreground transition-colors"
                      onClick={() => toggleSort("name")}
                    >
                      Programme <SortIcon col="name" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 hidden md:table-cell">
                    <button
                      className="flex items-center gap-1 text-xs font-medium hover:text-foreground transition-colors"
                      onClick={() => toggleSort("category")}
                    >
                      Catégorie <SortIcon col="category" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5">
                    <button
                      className="flex items-center gap-1 text-xs font-medium hover:text-foreground transition-colors"
                      onClick={() => toggleSort("status")}
                    >
                      Statut <SortIcon col="status" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 hidden lg:table-cell">
                    <span className="text-xs font-medium">Code</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-3 py-2.5">
                      <Checkbox
                        checked={p.code ? selectedCodes.has(p.code) : false}
                        onCheckedChange={() => toggleSelect(p.code)}
                        aria-label={`Sélectionner ${p.name}`}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        className="text-left font-medium text-sm leading-tight hover:text-primary transition-colors truncate max-w-[300px] block"
                        onClick={() => {
                          if (p.code) {
                            setSelectedCode(p.code);
                            setTab("presentation");
                          }
                        }}
                      >
                        {p.name}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell">
                      {p.override?.category ? (
                        <Badge variant="secondary" className="text-[10px]">
                          {p.override.category}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {p.override ? (
                        <Badge
                          variant={p.override.published ? "success" : "secondary"}
                          className="text-[10px]"
                        >
                          {p.override.published ? "Publié" : "Brouillon"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          Non configuré
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2.5 hidden lg:table-cell">
                      <span className="text-xs font-mono text-muted-foreground">
                        {p.code ?? "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={bulkDialog === "publish" || bulkDialog === "unpublish"} onOpenChange={() => setBulkDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {bulkDialog === "publish" ? "Publier" : "Dépublier"} {selectedCodes.size} programme{selectedCodes.size > 1 ? "s" : ""} ?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {bulkDialog === "publish"
              ? "Les programmes sélectionnés seront visibles dans le catalogue public."
              : "Les programmes sélectionnés seront masqués du catalogue."}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialog(null)}>Annuler</Button>
            <Button
              onClick={() =>
                bulkMutation.mutate({
                  programCodes: Array.from(selectedCodes),
                  action: bulkDialog === "publish" ? "publish" : "unpublish",
                })
              }
              disabled={bulkMutation.isPending}
            >
              {bulkMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDialog === "category"} onOpenChange={() => setBulkDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Assigner une catégorie
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Catégorie pour {selectedCodes.size} programme{selectedCodes.size > 1 ? "s" : ""}
            </p>
            <Input
              value={bulkCategory}
              onChange={(e) => setBulkCategory(e.target.value)}
              placeholder="ex. Fondamentaux, Avancé..."
              list="categories-datalist"
            />
            <datalist id="categories-datalist">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialog(null)}>Annuler</Button>
            <Button
              onClick={() =>
                bulkMutation.mutate({
                  programCodes: Array.from(selectedCodes),
                  action: "set_category",
                  value: bulkCategory,
                })
              }
              disabled={bulkMutation.isPending}
            >
              {bulkMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  );
}

function ProgramEditor({
  code,
  dfName,
  tab,
  setTab,
  onBack,
}: {
  code: string;
  dfName: string;
  tab: TabId;
  setTab: (t: TabId) => void;
  onBack: () => void;
}) {
  const { data: detail, isLoading, isError } = useQuery<ProgramDetail | null>({
    queryKey: ["admin", "program", code],
    queryFn: async () => {
      try {
        return await api.get<ProgramDetail>(`/programs/${code}`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    staleTime: 0,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-5 w-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 justify-center py-20 text-sm text-destructive">
        <AlertCircle className="h-4 w-4" />
        Erreur lors du chargement.
      </div>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "presentation", label: "Présentation" },
    { id: "tarifs", label: "Tarifs" },
    { id: "acces", label: "Accès" },
    { id: "sessions", label: "Sessions" },
  ];

  return (
    <div className="space-y-0">
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour
        </Button>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold truncate">{dfName}</h2>
          <p className="text-xs font-mono text-muted-foreground">{code}</p>
        </div>
      </div>

      <div className="border-b flex gap-0 overflow-x-auto mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors whitespace-nowrap",
              tab === t.id
                ? "border-foreground text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "presentation" && (
        <PresentationTab code={code} dfName={dfName} detail={detail} />
      )}
      {tab === "tarifs" && (
        <TarifsTab code={code} tiers={detail?.pricingTiers ?? []} />
      )}
      {tab === "acces" && (
        <AccesTab code={code} grants={detail?.featureGrants ?? []} />
      )}
      {tab === "sessions" && (
        <SessionsTab programCode={code} />
      )}
    </div>
  );
}

function SessionsTab({ programCode }: { programCode: string }) {
  const { data: allSessions = [], isLoading } = useQuery<SessionRow[]>({
    queryKey: ["admin", "sessions"],
    queryFn: () => api.get<SessionRow[]>("/admin/sessions"),
    staleTime: 30_000,
  });

  const sessions = useMemo(
    () => allSessions.filter((s) => s.programCode === programCode),
    [allSessions, programCode]
  );

  if (isLoading) {
    return <AdminTableSkeleton rows={4} cols={4} />;
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
        Aucune session pour ce programme.
      </div>
    );
  }

  const extranetBase = "https://app.digiforma.com/admin/sessions/";

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{sessions.length} session{sessions.length > 1 ? "s" : ""}</p>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="px-3 py-2 text-xs font-medium">Dates</th>
              <th className="px-3 py-2 text-xs font-medium">Lieu</th>
              <th className="px-3 py-2 text-xs font-medium">Formateur</th>
              <th className="px-3 py-2 text-xs font-medium">Inscrits</th>
              <th className="px-3 py-2 text-xs font-medium text-right">Lien</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => {
              const total = s.participants.assigned + s.participants.attended;
              const isPast = s.endDate && new Date(s.endDate) < new Date();
              return (
                <tr key={s.id} className={cn("border-b last:border-0", isPast && "opacity-60")}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5 text-xs">
                      <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                      {s.startDate
                        ? new Date(s.startDate).toLocaleDateString("fr-CH", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                      {s.endDate && s.endDate !== s.startDate && (
                        <>
                          {" — "}
                          {new Date(s.endDate).toLocaleDateString("fr-CH", {
                            day: "numeric",
                            month: "short",
                          })}
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {s.remote ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Monitor className="h-3 w-3" /> En ligne
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate max-w-[100px]">{s.placeName ?? s.place ?? "—"}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {s.instructors.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {s.instructors.map((i) => (
                          <Badge key={i.id} variant="secondary" className="text-[10px] px-1.5 py-0">
                            {i.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={total > 0 ? "secondary" : "outline"} className="text-xs tabular-nums">
                      <Users className="h-3 w-3 mr-1" />
                      {total}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" asChild>
                      <a
                        href={`${extranetBase}${s.digiformaId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ImageUpload({ code, onUploaded }: { code: string; onUploaded: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Le fichier doit être une image.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch(`/api/programs/admin/${code}/image`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      onUploaded(data.imageUrl);
      toast.success("Image téléchargée.");
    } catch {
      toast.error("Erreur lors du téléchargement.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <>Téléchargement…</>
        ) : (
          <>
            <Upload className="h-3.5 w-3.5" />
            Télécharger une image
          </>
        )}
      </Button>
    </>
  );
}

function PresentationTab({
  code,
  dfName,
  detail,
}: {
  code: string;
  dfName: string;
  detail: ProgramDetail | null | undefined;
}) {
  const qc = useQueryClient();
  const ov = detail?.override;

  const [displayName, setDisplayName] = useState(ov?.displayName ?? dfName);
  const [description, setDescription] = useState(ov?.description ?? "");
  const [imageUrl, setImageUrl] = useState(ov?.imageUrl ?? "");
  const [category, setCategory] = useState(ov?.category ?? "");
  const [tags, setTags] = useState<string[]>(ov?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [sortOrder, setSortOrder] = useState(String(ov?.sortOrder ?? 0));
  const [highlightLabel, setHighlightLabel] = useState(ov?.highlightLabel ?? "");
  const [hybridEnabled, setHybridEnabled] = useState(ov?.hybridEnabled ?? false);
  const [published, setPublished] = useState(ov?.published ?? false);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put(`/programs/admin/${code}/override`, {
        displayName: displayName || null,
        description: description || null,
        imageUrl: imageUrl || null,
        category: category || null,
        tags,
        sortOrder: parseInt(sortOrder, 10) || 0,
        highlightLabel: highlightLabel || null,
        hybridEnabled,
        published,
      }),
    onSuccess: () => {
      toast.success("Override sauvegardé.");
      qc.invalidateQueries({ queryKey: ["admin", "program", code] });
      qc.invalidateQueries({ queryKey: ["admin", "digiforma-programs"] });
    },
    onError: () => toast.error("Erreur lors de la sauvegarde."),
  });

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag));

  return (
    <div className="max-w-lg space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="displayName">Nom affiché</Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={dfName}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          placeholder="Description du programme…"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Image</Label>
        {imageUrl && (
          <div className="relative w-full max-w-xs rounded-lg overflow-hidden border bg-muted">
            <img src={imageUrl} alt="" className="w-full h-32 object-cover" />
            <button
              type="button"
              onClick={() => setImageUrl("")}
              className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <ImageUpload
          code={code}
          onUploaded={(url) => setImageUrl(url)}
        />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>ou</span>
          <Input
            id="imageUrl"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://…"
            className="flex-1 text-xs h-8"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="category">Catégorie</Label>
        <Input
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="ex. Fondamentaux, Avancé…"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Tags</Label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-xs"
            >
              {tag}
              <button onClick={() => removeTag(tag)} className="text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
            placeholder="Ajouter un tag…"
            className="flex-1"
          />
          <Button variant="outline" size="sm" onClick={addTag} type="button">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="sortOrder">Ordre d'affichage</Label>
          <Input
            id="sortOrder"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="highlightLabel">Label highlight</Label>
          <Input
            id="highlightLabel"
            value={highlightLabel}
            onChange={(e) => setHighlightLabel(e.target.value)}
            placeholder="ex. Nouveau, Complet…"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-lg border p-4">
        <Switch
          id="published"
          checked={published}
          onCheckedChange={setPublished}
        />
        <div>
          <Label htmlFor="published" className="cursor-pointer">
            Publié dans le catalogue
          </Label>
          <p className="text-xs text-muted-foreground">
            {published ? "Visible dans le catalogue public" : "Brouillon — non visible"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-lg border p-4">
        <Switch
          id="hybridEnabled"
          checked={hybridEnabled}
          onCheckedChange={setHybridEnabled}
        />
        <div>
          <Label htmlFor="hybridEnabled" className="cursor-pointer">
            Mode hybride
          </Label>
          <p className="text-xs text-muted-foreground">
            {hybridEnabled
              ? "Les participants peuvent choisir présentiel ou en ligne"
              : "Pas de choix de mode de participation"}
          </p>
        </div>
      </div>

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="gap-2"
      >
        <Save className="h-4 w-4" />
        {saveMutation.isPending ? "Sauvegarde…" : "Sauvegarder"}
      </Button>
    </div>
  );
}

function TarifsTab({ code, tiers }: { code: string; tiers: PricingTier[] }) {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "program", code] });

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {tiers.length} tarif{tiers.length !== 1 ? "s" : ""}
        </p>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowNew(true)}>
          <Plus className="h-3.5 w-3.5" />
          Ajouter un tarif
        </Button>
      </div>

      {tiers.map((tier) => (
        <TierCard key={tier.id} tier={tier} onSaved={invalidate} />
      ))}

      {tiers.length === 0 && !showNew && (
        <div className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
          Aucun tarif configuré pour ce programme.
        </div>
      )}

      {showNew && (
        <NewTierForm
          code={code}
          onSaved={() => { setShowNew(false); invalidate(); }}
          onCancel={() => setShowNew(false)}
        />
      )}
    </div>
  );
}

function TierCard({ tier, onSaved }: { tier: PricingTier; onSaved: () => void }) {
  const [label, setLabel] = useState(tier.label);
  const [amount, setAmount] = useState(tier.amount);
  const [unit, setUnit] = useState(tier.unit);
  const [pricingType, setPricingType] = useState(tier.pricingType);
  const [conditions, setConditions] = useState(
    tier.conditions ? JSON.stringify(tier.conditions, null, 2) : ""
  );
  const [validFrom, setValidFrom] = useState(tier.validFrom ?? "");
  const [validUntil, setValidUntil] = useState(tier.validUntil ?? "");
  const [active, setActive] = useState(tier.active);
  const [editing, setEditing] = useState(false);

  const updateMutation = useMutation({
    mutationFn: () => {
      let parsedConditions: Record<string, unknown> | null = null;
      if (conditions.trim()) {
        try { parsedConditions = JSON.parse(conditions); } catch { /* ignore */ }
      }
      return api.patch(`/programs/admin/pricing/${tier.id}`, {
        label,
        amount,
        unit,
        pricingType,
        conditions: parsedConditions,
        validFrom: validFrom || null,
        validUntil: validUntil || null,
        active,
      });
    },
    onSuccess: () => { toast.success("Tarif mis à jour."); setEditing(false); onSaved(); },
    onError: () => toast.error("Erreur lors de la mise à jour."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/programs/admin/pricing/${tier.id}`),
    onSuccess: () => { toast.success("Tarif supprimé."); onSaved(); },
    onError: () => toast.error("Impossible de supprimer ce tarif."),
  });

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono">{pricingType}</Badge>
          <span className="text-sm font-medium">{label}</span>
          <span className="text-sm text-muted-foreground">{tier.currency} {amount} / {unit}</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={active} onCheckedChange={setActive} disabled={!editing} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing(!editing)}
            className="text-xs"
          >
            {editing ? "Annuler" : "Modifier"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (window.confirm("Supprimer ce tarif ?")) deleteMutation.mutate();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {editing && (
        <>
          <Separator />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={pricingType} onValueChange={setPricingType}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRICING_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Label</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Montant (CHF)</Label>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Unité</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRICING_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valide du</Label>
              <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valide jusqu'au</Label>
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Conditions (JSON)</Label>
            <Textarea
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              rows={3}
              className="font-mono text-xs"
              placeholder='{ "requiresCredential": true }'
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Sauvegarde…" : "Sauvegarder"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Annuler
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function NewTierForm({
  code,
  onSaved,
  onCancel,
}: {
  code: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("total");
  const [pricingType, setPricingType] = useState("standard");
  const [active, setActive] = useState(true);

  const createMutation = useMutation({
    mutationFn: () =>
      api.post(`/programs/admin/${code}/pricing`, {
        label,
        amount,
        unit,
        pricingType,
        active,
        currency: "CHF",
      }),
    onSuccess: () => { toast.success("Tarif créé."); onSaved(); },
    onError: () => toast.error("Erreur lors de la création."),
  });

  return (
    <div className="rounded-xl border border-dashed p-4 space-y-3">
      <p className="text-sm font-medium">Nouveau tarif</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Type</Label>
          <Select value={pricingType} onValueChange={setPricingType}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRICING_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Label</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} className="h-8 text-sm" placeholder="Tarif standard" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Montant (CHF)</Label>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} className="h-8 text-sm" placeholder="490.00" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Unité</Label>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRICING_UNITS.map((u) => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Switch id="newActive" checked={active} onCheckedChange={setActive} />
        <Label htmlFor="newActive" className="text-sm cursor-pointer">Actif</Label>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !label || !amount}>
          {createMutation.isPending ? "Création…" : "Créer"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Annuler</Button>
      </div>
    </div>
  );
}

function AccesTab({ code, grants }: { code: string; grants: FeatureGrant[] }) {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [newFeatureKey, setNewFeatureKey] = useState(FEATURE_KEYS[0]);
  const [newCredentialRequired, setNewCredentialRequired] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "program", code] });

  const addMutation = useMutation({
    mutationFn: () =>
      api.post(`/programs/admin/${code}/grants`, {
        featureKey: newFeatureKey,
        credentialRequired: newCredentialRequired,
      }),
    onSuccess: () => {
      toast.success("Accès ajouté.");
      setShowNew(false);
      setNewFeatureKey(FEATURE_KEYS[0]);
      setNewCredentialRequired(false);
      invalidate();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        toast.error("Cet accès est déjà configuré.");
      } else {
        toast.error("Erreur lors de l'ajout.");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (grantId: string) => api.delete(`/programs/admin/grants/${grantId}`),
    onSuccess: () => { toast.success("Accès supprimé."); invalidate(); },
    onError: () => toast.error("Impossible de supprimer cet accès."),
  });

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {grants.length} accès configuré{grants.length !== 1 ? "s" : ""}
        </p>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowNew(true)}>
          <Plus className="h-3.5 w-3.5" />
          Ajouter un accès
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {grants.map((grant) => (
          <div
            key={grant.id}
            className="flex items-center gap-2 rounded-full border bg-muted px-3 py-1.5"
          >
            <span className="text-sm font-medium">{grant.featureKey}</span>
            <span className="text-xs text-muted-foreground">
              {grant.credentialRequired ? "credential requis" : "inscription suffisante"}
            </span>
            <button
              onClick={() => {
                if (window.confirm(`Supprimer l'accès "${grant.featureKey}" ?`))
                  deleteMutation.mutate(grant.id);
              }}
              className="text-muted-foreground hover:text-destructive transition-colors ml-1"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {grants.length === 0 && !showNew && (
        <div className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
          Aucun accès configuré pour ce programme.
        </div>
      )}

      {showNew && (
        <div className="rounded-xl border p-4 space-y-3">
          <p className="text-sm font-medium">Nouvel accès</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Fonctionnalité</Label>
              <Select value={newFeatureKey} onValueChange={setNewFeatureKey}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FEATURE_KEYS.map((k) => (
                    <SelectItem key={k} value={k}>{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end pb-1">
              <div className="flex items-center gap-2">
                <Switch
                  id="credentialRequired"
                  checked={newCredentialRequired}
                  onCheckedChange={setNewCredentialRequired}
                />
                <Label htmlFor="credentialRequired" className="text-sm cursor-pointer">
                  Credential requis
                </Label>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
              {addMutation.isPending ? "Ajout…" : "Ajouter"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowNew(false)}>Annuler</Button>
          </div>
        </div>
      )}
    </div>
  );
}
