import { useState, useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  RefreshCw,
  XCircle,
  PlusCircle,
  RotateCcw,
  Award,
  ExternalLink,
  ClipboardList,
  Receipt,
  GraduationCap,
  MapPin,
  Monitor,
} from "lucide-react";
import { toast } from "sonner";
import {
  useEnrollments,
  useExtranetSessions,
  activeAssignment,
  invoiceLabel,
  type EnrollmentWithAssignments,
} from "@/hooks/useEnrollments";
import { usePrograms } from "@/hooks/useCatalogue";
import { useProfile } from "@/hooks/useProfile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "secondary" | "success" | "destructive" | "outline" }> = {
    active: { label: "Actif", variant: "secondary" },
    completed: { label: "Complété", variant: "success" },
    refunded: { label: "Remboursé", variant: "destructive" },
  };
  const cfg = map[status] ?? { label: status, variant: "outline" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

// ---------------------------------------------------------------------------
// Credential badge row
// ---------------------------------------------------------------------------

interface CredentialBadgeRowProps {
  certificates: Array<{
    credentialName: string;
    badgeUrl: string | null;
    certificateUrl: string | null;
    url: string | null;
  }>;
}

function CredentialBadgeRow({ certificates }: CredentialBadgeRowProps) {
  if (certificates.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {certificates.map((c) => (
        <a
          key={c.credentialName}
          href={c.certificateUrl ?? c.url ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg border bg-muted/40 px-2.5 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
        >
          {c.badgeUrl ? (
            <img
              src={c.badgeUrl}
              alt={c.credentialName}
              className="h-5 w-5 rounded object-contain"
            />
          ) : (
            <Award className="h-4 w-4 text-muted-foreground" />
          )}
          <span>{c.credentialName}</span>
          <ExternalLink className="h-3 w-3 text-muted-foreground/50" />
        </a>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single enrollment timeline card
// ---------------------------------------------------------------------------

interface TimelineCardProps {
  enrollment: EnrollmentWithAssignments;
  programName: string;
  credentials: CredentialBadgeRowProps["certificates"];
  onRefundRequest: (enrollmentId: string) => void;
  extranetUrl: string | null;
}

function TimelineCard({
  enrollment,
  programName,
  credentials,
  onRefundRequest,
  extranetUrl,
}: TimelineCardProps) {
  const navigate = useNavigate();
  const { cancelSession } = useEnrollments();
  const assigned = activeAssignment(enrollment);
  const { label: invoiceText, variant: invoiceVariant } = invoiceLabel(enrollment);

  const handleCancel = async () => {
    if (
      !window.confirm(
        "Confirmez-vous l'annulation de votre session ? Cette action est irréversible."
      )
    )
      return;
    try {
      await cancelSession.mutateAsync(enrollment.id);
      toast.success("Session annulée.");
    } catch {
      toast.error("Impossible d'annuler la session.");
    }
  };

  return (
    <div className="relative pl-7">
      {/* Timeline dot */}
      <span className="absolute left-0 top-3 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-background bg-muted-foreground/40 ring-2 ring-background" />

      <div className="rounded-xl border bg-card p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="font-semibold text-sm leading-tight">{programName}</p>
            <p className="text-[11px] font-mono text-muted-foreground mt-0.5 uppercase tracking-wider">
              {enrollment.programCode}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <StatusBadge status={enrollment.status} />
            <Badge variant={invoiceVariant}>{invoiceText}</Badge>
            {enrollment.bexioDocumentNr && (
              <span className="text-xs text-muted-foreground">
                N° {enrollment.bexioDocumentNr}
              </span>
            )}
            {enrollment.bexioTotal && (
              <span className="text-xs font-medium">CHF {enrollment.bexioTotal}</span>
            )}
            {enrollment.bexioNetworkLink && (
              <a
                href={enrollment.bexioNetworkLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Receipt className="h-3 w-3" />
                Voir la facture
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Inscrit le{" "}
          {new Date(enrollment.enrolledAt).toLocaleDateString("fr-CH", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </div>

        <Separator />

        {/* Session */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Session
          </p>
          {assigned ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                Session assignée
                <span className="font-mono text-xs text-muted-foreground">
                  #{assigned.sessionId}
                </span>
              </div>
              {assigned.participationMode && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {assigned.participationMode === "remote" ? (
                    <><Monitor className="h-3.5 w-3.5" /> Participation à distance</>
                  ) : (
                    <><MapPin className="h-3.5 w-3.5" /> Participation en présentiel</>
                  )}
                </div>
              )}
              {extranetUrl && (
                <a
                  href={extranetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <GraduationCap className="h-3.5 w-3.5" />
                  Accéder à mon espace apprenant
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ) : enrollment.status === "completed" ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
              Formation complétée
            </div>
          ) : enrollment.status === "refunded" ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-1.5 w-1.5 rounded-full bg-destructive/60 shrink-0" />
              Remboursement traité
              {enrollment.cancelledAt && (
                <span className="text-xs">
                  le{" "}
                  {new Date(enrollment.cancelledAt).toLocaleDateString("fr-CH", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
              Aucune session assignée
            </div>
          )}
        </div>

        {/* Credential badges (completed) */}
        {enrollment.status === "completed" && credentials.length > 0 && (
          <CredentialBadgeRow certificates={credentials} />
        )}

        {/* Action buttons (active only) */}
        {enrollment.status === "active" && (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {assigned ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => navigate({ to: "/catalogue" })}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Changer de session
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={cancelSession.isPending}
                  onClick={handleCancel}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Annuler la session
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => navigate({ to: "/catalogue" })}
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Choisir une session
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => onRefundRequest(enrollment.id)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Demander un remboursement
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Refund request dialog
// ---------------------------------------------------------------------------

interface RefundDialogProps {
  enrollmentId: string | null;
  programName: string;
  onClose: () => void;
}

function RefundDialog({ enrollmentId, programName, onClose }: RefundDialogProps) {
  const [reason, setReason] = useState("");
  const { requestRefund } = useEnrollments();

  const handleSubmit = async () => {
    if (!enrollmentId) return;
    try {
      await requestRefund.mutateAsync({ enrollmentId, reason: reason.trim() || undefined });
      toast.success("Demande de remboursement envoyée.", {
        description: "Notre équipe traitera votre demande dans les meilleurs délais.",
      });
      onClose();
      setReason("");
    } catch {
      toast.error("Impossible d'envoyer la demande. Réessayez.");
    }
  };

  return (
    <Dialog open={!!enrollmentId} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Demander un remboursement</DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-2 space-y-4">
          <p className="text-sm text-muted-foreground">
            Vous allez soumettre une demande de remboursement pour{" "}
            <span className="font-medium text-foreground">{programName}</span>. Notre
            équipe examinera votre demande et vous répondra par e-mail.
          </p>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Motif (optionnel)
            </label>
            <Textarea
              placeholder="Décrivez brièvement la raison de votre demande..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={requestRefund.isPending}
          >
            {requestRefund.isPending ? "Envoi…" : "Soumettre la demande"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Timeline section
// ---------------------------------------------------------------------------

function TimelineSection({
  title,
  entries,
}: {
  title: React.ReactNode;
  entries: React.ReactNode[];
}) {
  if (entries.length === 0) return null;
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold tracking-tight">{title}</span>
        <div className="flex-1 border-t" />
      </div>
      {/* Vertical timeline line */}
      <div className="relative border-l ml-1.5 pl-4 space-y-4 pb-2"
           style={{ borderColor: "hsl(var(--border))" }}>
        {entries}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Trainings page
// ---------------------------------------------------------------------------

export default function Trainings() {
  const [refundTarget, setRefundTarget] = useState<string | null>(null);
  const { enrollments, isLoading, isError } = useEnrollments();
  const { bySessionId: extranetBySession } = useExtranetSessions();
  const { data: categories = [] } = usePrograms();
  const { profileData } = useProfile();

  // Program name lookup
  const programMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const cat of categories) {
      for (const prog of cat.programs) {
        m.set(prog.programCode, prog.name);
      }
    }
    return m;
  }, [categories]);

  // Credential list from profile
  const credentials = profileData?.credentials ?? [];

  // Refund dialog program name
  const refundProgramName = refundTarget
    ? (programMap.get(enrollments.find((e) => e.id === refundTarget)?.programCode ?? "") ??
        enrollments.find((e) => e.id === refundTarget)?.programCode ??
        "")
    : "";

  const active = enrollments.filter((e) => e.status === "active");
  const completed = enrollments.filter((e) => e.status === "completed");
  const refunded = enrollments.filter((e) => e.status === "refunded");

  const renderCard = (e: EnrollmentWithAssignments) => {
    const assigned = activeAssignment(e);
    const extranetUrl = assigned
      ? (extranetBySession.get(assigned.sessionId) ?? null)
      : null;
    return (
      <TimelineCard
        key={e.id}
        enrollment={e}
        programName={programMap.get(e.programCode) ?? e.programCode}
        credentials={credentials}
        onRefundRequest={setRefundTarget}
        extranetUrl={extranetUrl}
      />
    );
  };

  return (
    <div className="max-w-2xl space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Mes formations</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Historique de vos inscriptions et certifications
          </p>
        </div>
      </div>

      {isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
          Impossible de charger vos formations. Réessayez dans un instant.
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-5 w-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
        </div>
      ) : enrollments.length === 0 ? (
        <div className="rounded-xl border border-dashed py-14 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <BookOpen className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">Aucune formation enregistrée</p>
            <p className="text-xs text-muted-foreground mt-1">
              Inscrivez-vous à une formation pour la retrouver ici.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/catalogue">
              <BookOpen className="h-3.5 w-3.5 mr-1.5" />
              Voir le catalogue
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <TimelineSection
            title={<span className="text-primary">Inscriptions actives ({active.length})</span>}
            entries={active.map(renderCard)}
          />
          <TimelineSection
            title={<>Formations complétées ({completed.length})</>}
            entries={completed.map(renderCard)}
          />
          <TimelineSection
            title={<span className="text-muted-foreground">Remboursements ({refunded.length})</span>}
            entries={refunded.map(renderCard)}
          />
        </>
      )}

      {/* Refund dialog */}
      <RefundDialog
        enrollmentId={refundTarget}
        programName={refundProgramName}
        onClose={() => setRefundTarget(null)}
      />
    </div>
  );
}
