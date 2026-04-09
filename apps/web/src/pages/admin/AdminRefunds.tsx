import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle, XCircle, AlertCircle, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PendingRefund {
  id: string;
  enrollmentId: string;
  reason: string | null;
  status: "pending" | "approved" | "denied";
  adminNote: string | null;
  bexioCreditNoteId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  enrollment: {
    id: string;
    userId: string;
    programCode: string;
    enrolledAt: string;
    bexioDocumentNr: string | null;
    bexioTotal: string | null;
  };
  user: {
    id: string;
    email: string;
    profile: { firstName: string | null; lastName: string | null } | null;
  } | null;
}

// ---------------------------------------------------------------------------
// AdminRefunds
// ---------------------------------------------------------------------------

export default function AdminRefunds() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: refunds = [], isLoading, isError, refetch } = useQuery<PendingRefund[]>({
    queryKey: ["admin", "refunds"],
    queryFn: () => api.get<PendingRefund[]>("/enrollments/admin/refunds"),
    staleTime: 30_000,
  });

  const selected = refunds.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Remboursements</h1>
        <p className="text-sm text-muted-foreground mt-1">
          File d'attente des demandes de remboursement en attente.
        </p>
      </div>

      {isError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Erreur lors du chargement des remboursements.
        </div>
      )}

      <div className="flex h-[calc(100vh-14rem)] gap-0 overflow-hidden rounded-xl border">
        {/* Left: refund list */}
        <div className={cn(
          "w-full md:w-80 shrink-0 md:border-r flex flex-col overflow-hidden",
          selectedId && "hidden md:flex"
        )}>
          <div className="px-4 py-3 border-b shrink-0">
            <p className="text-xs text-muted-foreground">
              {refunds.length} demande{refunds.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-4 w-4 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
              </div>
            ) : refunds.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CheckCircle className="h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Aucune demande en attente.
                </p>
              </div>
            ) : (
              refunds.map((refund) => (
                <RefundRow
                  key={refund.id}
                  refund={refund}
                  selected={selectedId === refund.id}
                  onClick={() => setSelectedId(refund.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: review panel */}
        <div className={cn(
          "flex-1 overflow-y-auto",
          !selectedId && "hidden md:flex"
        )}>
          {selectedId && selected ? (
            <RefundReview
              refund={selected}
              onProcessed={() => {
                setSelectedId(null);
                refetch();
              }}
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Sélectionnez une demande pour la traiter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RefundRow
// ---------------------------------------------------------------------------

function RefundRow({
  refund,
  selected,
  onClick,
}: {
  refund: PendingRefund;
  selected: boolean;
  onClick: () => void;
}) {
  const name =
    [refund.user?.profile?.firstName, refund.user?.profile?.lastName]
      .filter(Boolean)
      .join(" ") || refund.user?.email || "—";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3 border-b hover:bg-accent transition-colors",
        selected && "bg-accent"
      )}
    >
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium truncate">{name}</span>
          <RefundStatusBadge status={refund.status} />
        </div>
        <p className="text-xs font-mono text-muted-foreground">
          {refund.enrollment.programCode}
        </p>
        {refund.createdAt && (
          <p className="text-[11px] text-muted-foreground">
            {new Date(refund.createdAt).toLocaleDateString("fr-CH", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// RefundReview
// ---------------------------------------------------------------------------

function RefundReview({
  refund,
  onProcessed,
  onBack,
}: {
  refund: PendingRefund;
  onProcessed: () => void;
  onBack: () => void;
}) {
  const [adminNote, setAdminNote] = useState(refund.adminNote ?? "");

  const processMutation = useMutation({
    mutationFn: (approved: boolean) =>
      api.post(`/enrollments/admin/refunds/${refund.id}/process`, {
        approved,
        adminNote: adminNote || null,
      }),
    onSuccess: (_, approved) => {
      toast.success(approved ? "Remboursement approuvé." : "Remboursement refusé.");
      onProcessed();
    },
    onError: () => toast.error("Erreur lors du traitement."),
  });

  const name =
    [refund.user?.profile?.firstName, refund.user?.profile?.lastName]
      .filter(Boolean)
      .join(" ") || refund.user?.email || "—";

  const isPending = refund.status === "pending";

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-xl">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors md:hidden"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour
      </button>

      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{name}</h2>
            <p className="text-sm text-muted-foreground">{refund.user?.email}</p>
          </div>
          <RefundStatusBadge status={refund.status} />
        </div>
      </div>

      <Separator />

      {/* Enrollment details */}
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          Inscription
        </p>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">Programme</dt>
          <dd className="font-mono font-medium">{refund.enrollment.programCode}</dd>
          <dt className="text-muted-foreground">Date d'inscription</dt>
          <dd>
            {new Date(refund.enrollment.enrolledAt).toLocaleDateString("fr-CH", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </dd>
          {refund.enrollment.bexioDocumentNr && (
            <>
              <dt className="text-muted-foreground">N° facture</dt>
              <dd>{refund.enrollment.bexioDocumentNr}</dd>
            </>
          )}
          {refund.enrollment.bexioTotal && (
            <>
              <dt className="text-muted-foreground">Montant</dt>
              <dd className="font-medium">CHF {refund.enrollment.bexioTotal}</dd>
            </>
          )}
        </dl>
      </div>

      <Separator />

      {/* Request details */}
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          Demande
        </p>
        {refund.createdAt && (
          <p className="text-xs text-muted-foreground">
            Soumise le{" "}
            {new Date(refund.createdAt).toLocaleDateString("fr-CH", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        )}
        {refund.reason ? (
          <div className="rounded-lg bg-muted px-4 py-3 text-sm leading-relaxed">
            {refund.reason}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">Aucun motif fourni.</p>
        )}
      </div>

      {/* Admin note */}
      <div className="space-y-1.5">
        <Label htmlFor="adminNote">Note admin</Label>
        <Textarea
          id="adminNote"
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          rows={3}
          placeholder="Note interne (optionnelle)…"
          disabled={!isPending}
        />
      </div>

      {/* Actions */}
      {isPending ? (
        <div className="flex gap-3">
          <Button
            className="gap-2 flex-1"
            onClick={() => processMutation.mutate(true)}
            disabled={processMutation.isPending}
          >
            <CheckCircle className="h-4 w-4" />
            Approuver
          </Button>
          <Button
            variant="destructive"
            className="gap-2 flex-1"
            onClick={() => {
              if (window.confirm("Confirmer le refus de cette demande ?"))
                processMutation.mutate(false);
            }}
            disabled={processMutation.isPending}
          >
            <XCircle className="h-4 w-4" />
            Refuser
          </Button>
        </div>
      ) : (
        <div className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
          Cette demande a déjà été traitée.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RefundStatusBadge
// ---------------------------------------------------------------------------

function RefundStatusBadge({ status }: { status: PendingRefund["status"] }) {
  const map = {
    pending: { label: "En attente", variant: "warning" as const },
    approved: { label: "Approuvé", variant: "success" as const },
    denied: { label: "Refusé", variant: "destructive" as const },
  };
  const { label, variant } = map[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={variant} className="text-xs">{label}</Badge>;
}
