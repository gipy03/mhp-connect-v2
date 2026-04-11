import { useState } from "react";
import {
  Receipt,
  ExternalLink,
  Download,
  Loader2,
  ArrowUpDown,
  FileText,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

interface Invoice {
  id: string;
  bexioId: number;
  documentNr: string;
  title: string | null;
  invoiceDate: string | null;
  totalInclVat: string | null;
  totalRemainingPayments: string | null;
  status: string;
  networkLink: string | null;
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

export default function MesFactures() {
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("invoiceDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const params = new URLSearchParams();
  if (statusFilter) params.set("status", statusFilter);
  params.set("sortBy", sortBy);
  params.set("sortDir", sortDir);

  const { data: invoices, isLoading } = useQuery<Invoice[]>({
    queryKey: ["my-invoices", statusFilter, sortBy, sortDir],
    queryFn: () => api.get(`/invoices/me?${params.toString()}`),
  });

  const [downloading, setDownloading] = useState<string | null>(null);

  async function downloadPdf(invoiceId: string, documentNr: string) {
    setDownloading(invoiceId);
    try {
      const res = await fetch(`/api/invoices/me/${invoiceId}/pdf`, { credentials: "include" });
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

  function toggleSort(field: string) {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
  }

  return (
    <div className="space-y-6 animate-page-enter">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mes factures</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Retrouvez l'ensemble de vos factures de formation.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tous les statuts" />
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

        <div className="flex gap-2 ml-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleSort("invoiceDate")}
            className="text-xs"
          >
            <ArrowUpDown className="h-3 w-3 mr-1" />
            Date {sortBy === "invoiceDate" && (sortDir === "asc" ? "↑" : "↓")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleSort("totalInclVat")}
            className="text-xs"
          >
            <ArrowUpDown className="h-3 w-3 mr-1" />
            Montant {sortBy === "totalInclVat" && (sortDir === "asc" ? "↑" : "↓")}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : !invoices || invoices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Receipt className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-medium text-lg">Aucune facture</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Vos factures apparaîtront ici une fois disponibles.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => {
            const cfg = STATUS_CONFIG[inv.status] ?? { label: inv.status, variant: "outline" as const };
            const remaining = inv.totalRemainingPayments ? parseFloat(inv.totalRemainingPayments) : 0;
            return (
              <Card key={inv.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/5 shrink-0">
                        <FileText className="h-5 w-5 text-primary/60" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{inv.documentNr}</span>
                          <Badge variant={cfg.variant} className="text-[10px] px-1.5 py-0">
                            {cfg.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {inv.title || "—"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 sm:gap-6 text-sm shrink-0">
                      <div className="text-right">
                        <div className="font-semibold tabular-nums">{formatAmount(inv.totalInclVat)}</div>
                        <div className="text-[11px] text-muted-foreground">{formatDate(inv.invoiceDate)}</div>
                        {remaining > 0 && inv.status !== "paid" && (
                          <div className="text-[10px] text-destructive font-medium">
                            Solde: {formatAmount(inv.totalRemainingPayments)}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {inv.networkLink && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            asChild
                          >
                            <a href={inv.networkLink} target="_blank" rel="noopener noreferrer" title="Voir en ligne">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={downloading === inv.id}
                          onClick={() => downloadPdf(inv.id, inv.documentNr)}
                          title="Télécharger PDF"
                        >
                          {downloading === inv.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
