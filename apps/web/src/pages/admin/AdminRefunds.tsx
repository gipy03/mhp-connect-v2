import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EnrichedRefund {
  id: string;
  enrollmentId: string;
  reason: string | null;
  status: string;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  programCode: string;
  enrolledAt: string;
  userId: string;
  userEmail: string;
  userFirstName: string | null;
  userLastName: string | null;
}

// ---------------------------------------------------------------------------
// Review panel (inline)
// ---------------------------------------------------------------------------

function ReviewPanel({
  refund,
  onDone,
}: {
  refund: EnrichedRefund;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [adminNote, setAdminNote] = useState(refund.adminNote ?? "");

  const processMut = useMutation({
    mutationFn: (approved: boolean) =>
      api.post(`/enrollments/admin/refunds/${refund.id}/process`, {
        approved,
        adminNote: adminNote.trim() || null,
      }),
    onSuccess: (_, approved) => {
      toast.success(
        approved ? "Remboursement approuvé." : "Demande refusée.",
        { description: "Un e-mail de notification a été envoyé au membre." }
      );
      qc.invalidateQueries({ queryKey: ["admin", "refunds"] });
      onDone();
    },
    onError: () => toast.error("Erreur lors du traitement."),
  });

  return (
    <div className="border-t bg-muted/20 px-5 py-4 space-y-4">
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Note admin (optionnelle)
        </p>
        <Textarea
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          placeholder="Motif d'approbation ou de refus, instructions particulières…"
          className="min-h-[80px]"
        />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          disabled={processMut.isPending}
          onClick={() => processMut.mutate(true)}
        >
          <CheckCircle className="h-3.5 w-3.5" />
          Approuver le remboursement
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10"
          disabled={processMut.isPending}
          onClick={() => processMut.mutate(false)}
        >
          <XCircle className="h-3.5 w-3.5" />
          Refuser
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone} className="ml-auto">
          Annuler
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Refund row
// ---------------------------------------------------------------------------

function RefundRow({ refund }: { refund: EnrichedRefund }) {
  const [expanded, setExpanded] = useState(false);
  const userName =
    [refund.userFirstName, refund.userLastName].filter(Boolean).join(" ") ||
    refund.userEmail;

  return (
    <div className="border-b last:border-b-0">
      <div
        className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{userName}</span>
            <span className="text-xs text-muted-foreground">{refund.userEmail}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs font-mono text-muted-foreground">
              {refund.programCode}
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">
              Inscrit le{" "}
              {new Date(refund.enrolledAt).toLocaleDateString("fr-CH", {
                day: "numeric", month: "short", year: "numeric",
              })}
            </span>
          </div>
        </div>

        {refund.reason && (
          <p className="text-xs text-muted-foreground truncate max-w-[180px] hidden md:block">
            {refund.reason}
          </p>
        )}

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">
            {new Date(refund.createdAt).toLocaleDateString("fr-CH", {
              day: "numeric", month: "short",
            })}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {expanded && (
        <>
          {refund.reason && (
            <div className="px-5 py-3 bg-muted/10 border-t">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                Motif
              </p>
              <p className="text-sm">{refund.reason}</p>
            </div>
          )}
          <ReviewPanel refund={refund} onDone={() => setExpanded(false)} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AdminRefunds
// ---------------------------------------------------------------------------

export default function AdminRefunds() {
  const { data: refunds = [], isLoading } = useQuery<EnrichedRefund[]>({
    queryKey: ["admin", "refunds"],
    queryFn: () => api.get<EnrichedRefund[]>("/enrollments/admin/refunds"),
    staleTime: 60_000,
  });

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Remboursements</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isLoading
            ? "Chargement…"
            : `${refunds.length} demande${refunds.length !== 1 ? "s" : ""} en attente`}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-5 w-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
        </div>
      ) : refunds.length === 0 ? (
        <div className="rounded-xl border border-dashed py-14 text-center">
          <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-3" />
          <p className="text-sm font-medium">Aucune demande en attente</p>
          <p className="text-xs text-muted-foreground mt-1">
            Toutes les demandes ont été traitées.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          {refunds.map((r) => (
            <RefundRow key={r.id} refund={r} />
          ))}
        </div>
      )}
    </div>
  );
}
