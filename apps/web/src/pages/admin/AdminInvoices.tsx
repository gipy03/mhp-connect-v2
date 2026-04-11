import { useState, useCallback, useRef, useEffect } from "react";
import {
  Search,
  Download,
  Loader2,
  ExternalLink,
  UserPlus,
  UserMinus,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Check,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { AdminPageShell } from "@/components/AdminPageShell";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

interface Invoice {
  id: string;
  bexioId: number;
  documentNr: string;
  title: string | null;
  invoiceDate: string | null;
  contactId: number;
  contactName: string | null;
  totalInclVat: string | null;
  totalRemainingPayments: string | null;
  status: string;
  networkLink: string | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
}

interface InvoiceListResponse {
  invoices: Invoice[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface UserResult {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  paid: { label: "Payée", variant: "default" },
  pending: { label: "En attente", variant: "secondary" },
  partial: { label: "Partiel", variant: "outline" },
  overdue: { label: "En retard", variant: "destructive" },
  draft: { label: "Brouillon", variant: "outline" },
  cancelled: { label: "Annulée", variant: "outline" },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("fr-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatAmount(amount: string | null): string {
  if (!amount) return "—";
  const n = parseFloat(amount);
  return `CHF ${n.toLocaleString("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AdminInvoices() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [assignedFilter, setAssignedFilter] = useState("");
  const [sortBy, setSortBy] = useState("invoiceDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);
  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 300);
  }, []);

  const params = new URLSearchParams();
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (statusFilter) params.set("status", statusFilter);
  if (assignedFilter) params.set("assigned", assignedFilter);
  params.set("sortBy", sortBy);
  params.set("sortDir", sortDir);
  params.set("page", String(page));
  params.set("limit", "50");

  const { data, isLoading } = useQuery<InvoiceListResponse>({
    queryKey: ["admin-invoices", debouncedSearch, statusFilter, assignedFilter, sortBy, sortDir, page],
    queryFn: () => api.get(`/invoices/admin?${params.toString()}`),
  });

  const { data: userResults } = useQuery<UserResult[]>({
    queryKey: ["invoice-user-search", userSearch],
    queryFn: () => api.get(`/invoices/admin/users/search?q=${encodeURIComponent(userSearch)}`),
    enabled: userSearch.length >= 2,
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post("/invoices/admin/sync", {}),
    onSuccess: (data: any) => {
      toast.success(`Import terminé: ${data.created} créées, ${data.updated} mises à jour, ${data.matched} associées`);
      queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
    },
    onError: () => toast.error("Erreur lors de l'import des factures."),
  });

  const assignMutation = useMutation({
    mutationFn: (params: { invoiceIds: string[]; userId: string | null }) =>
      api.patch("/invoices/admin/assign", params),
    onSuccess: () => {
      toast.success("Factures mises à jour.");
      queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
      setSelected(new Set());
      setAssignDialogOpen(false);
    },
    onError: () => toast.error("Erreur lors de l'assignation."),
  });

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!data) return;
    if (selected.size === data.invoices.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.invoices.map((i) => i.id)));
    }
  }

  async function downloadPdf(invoiceId: string, documentNr: string) {
    setDownloading(invoiceId);
    try {
      const res = await fetch(`/api/invoices/admin/${invoiceId}/pdf`, { credentials: "include" });
      if (!res.ok) throw new Error("Erreur lors du téléchargement");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${documentNr}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Impossible de télécharger le PDF.");
    } finally {
      setDownloading(null);
    }
  }

  function handleSort(field: string) {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
    setPage(1);
  }

  const allSelected = data && data.invoices.length > 0 && selected.size === data.invoices.length;

  return (
    <AdminPageShell
      title="Factures Bexio"
      description={`${data?.total ?? 0} factures au total`}
      actions={
        <div className="flex gap-2">
          {selected.size > 0 && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAssignDialogOpen(true)}
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Assigner ({selected.size})
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => assignMutation.mutate({ invoiceIds: [...selected], userId: null })}
                disabled={assignMutation.isPending}
              >
                <UserMinus className="h-4 w-4 mr-1" />
                Désassigner
              </Button>
            </>
          )}
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
            Importer Bexio
          </Button>
        </div>
      }
    >
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par n°, titre ou contact..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="paid">Payée</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="partial">Partiel</SelectItem>
            <SelectItem value="overdue">En retard</SelectItem>
            <SelectItem value="draft">Brouillon</SelectItem>
            <SelectItem value="cancelled">Annulée</SelectItem>
          </SelectContent>
        </Select>
        <Select value={assignedFilter} onValueChange={(v) => { setAssignedFilter(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Assignation" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="assigned">Assignées</SelectItem>
            <SelectItem value="unassigned">Non assignées</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : !data || data.invoices.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            Aucune facture trouvée. Lancez l'import Bexio pour récupérer les factures.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="w-10 px-3 py-2">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleAll}
                      />
                    </th>
                    <th
                      className="px-3 py-2 text-left font-medium cursor-pointer hover:text-primary select-none"
                      onClick={() => handleSort("documentNr")}
                    >
                      N° {sortBy === "documentNr" && (sortDir === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="px-3 py-2 text-left font-medium">Titre</th>
                    <th
                      className="px-3 py-2 text-left font-medium cursor-pointer hover:text-primary select-none"
                      onClick={() => handleSort("invoiceDate")}
                    >
                      Date {sortBy === "invoiceDate" && (sortDir === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="px-3 py-2 text-left font-medium cursor-pointer hover:text-primary select-none"
                      onClick={() => handleSort("contactName")}
                    >
                      Contact {sortBy === "contactName" && (sortDir === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="px-3 py-2 text-right font-medium cursor-pointer hover:text-primary select-none"
                      onClick={() => handleSort("totalInclVat")}
                    >
                      Montant {sortBy === "totalInclVat" && (sortDir === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="px-3 py-2 text-left font-medium cursor-pointer hover:text-primary select-none"
                      onClick={() => handleSort("status")}
                    >
                      Statut {sortBy === "status" && (sortDir === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="px-3 py-2 text-left font-medium">Membre</th>
                    <th className="px-3 py-2 text-center font-medium w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.invoices.map((inv) => {
                    const cfg = STATUS_CONFIG[inv.status] ?? { label: inv.status, variant: "outline" as const };
                    return (
                      <tr key={inv.id} className={`hover:bg-muted/30 transition-colors ${selected.has(inv.id) ? "bg-primary/5" : ""}`}>
                        <td className="px-3 py-2">
                          <Checkbox
                            checked={selected.has(inv.id)}
                            onCheckedChange={() => toggleSelect(inv.id)}
                          />
                        </td>
                        <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{inv.documentNr}</td>
                        <td className="px-3 py-2 max-w-[200px] truncate text-muted-foreground" title={inv.title ?? ""}>
                          {inv.title || "—"}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap tabular-nums">{formatDate(inv.invoiceDate)}</td>
                        <td className="px-3 py-2 max-w-[150px] truncate" title={inv.contactName ?? ""}>
                          {inv.contactName || `#${inv.contactId}`}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums font-medium">
                          {formatAmount(inv.totalInclVat)}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={cfg.variant} className="text-[10px] px-1.5 py-0">
                            {cfg.label}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 max-w-[150px]">
                          {inv.userId ? (
                            <span className="text-xs text-primary truncate block" title={inv.userEmail ?? ""}>
                              {inv.userName?.trim() || inv.userEmail}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-center gap-1">
                            {inv.networkLink && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                <a href={inv.networkLink} target="_blank" rel="noopener noreferrer" title="Bexio">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={downloading === inv.id}
                              onClick={() => downloadPdf(inv.id, inv.documentNr)}
                              title="PDF"
                            >
                              {downloading === inv.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Download className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {data.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {data.page} sur {data.totalPages} ({data.total} résultats)
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assigner {selected.size} facture{selected.size > 1 ? "s" : ""} à un membre</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Rechercher un membre (nom, email)..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
            {userResults && userResults.length > 0 && (
              <div className="max-h-60 overflow-y-auto border rounded-md divide-y">
                {userResults.map((u) => (
                  <button
                    key={u.id}
                    className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm flex items-center justify-between"
                    onClick={() => {
                      assignMutation.mutate({ invoiceIds: [...selected], userId: u.id });
                    }}
                  >
                    <div>
                      <div className="font-medium">{[u.firstName, u.lastName].filter(Boolean).join(" ") || u.email}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                    <Check className="h-4 w-4 text-muted-foreground/30" />
                  </button>
                ))}
              </div>
            )}
            {userSearch.length >= 2 && userResults && userResults.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun membre trouvé.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  );
}
