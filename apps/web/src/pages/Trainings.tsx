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
  MapPin,
  Calendar,
  Monitor,
  FileText,
  GraduationCap,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import {
  useEnrollments,
  useExtranetUrl,
  useExtranetSessions,
  activeAssignment,
  invoiceLabel,
  type EnrollmentWithAssignments,
  type ExtranetSession,
} from "@/hooks/useEnrollments";
import { usePrograms, formatPrice, cheapestTier, formatSessionDateRange } from "@/hooks/useCatalogue";
import { useProfile } from "@/hooks/useProfile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "secondary" | "success" | "destructive" | "outline" }> = {
    active: { label: "Validé", variant: "success" },
    completed: { label: "Complété", variant: "secondary" },
    refunded: { label: "Annulé", variant: "destructive" },
  };
  const cfg = map[status] ?? { label: status, variant: "outline" };
  return <Badge variant={cfg.variant} className="text-[10px] px-1.5 py-0">{cfg.label}</Badge>;
}

interface ProgramInfo {
  name: string;
  price: string | null;
  durationInDays: number | null;
  durationInHours: number | null;
  tags: string[];
}

function formatDuration(days: number | null, hours: number | null): string | null {
  const parts: string[] = [];
  if (days) parts.push(`${days} jour${days > 1 ? "s" : ""}`);
  if (hours) parts.push(`[${hours}h]`);
  return parts.length > 0 ? parts.join(" ") : null;
}

function formatCompactDateRange(startDate: string | null, endDate: string | null): string {
  if (!startDate) return "Date à confirmer";
  const s = new Date(startDate);
  const e = endDate ? new Date(endDate) : null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmtShort = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
  const fmtFull = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;

  if (!e || s.toDateString() === e.toDateString()) return fmtFull(s);
  if (s.getFullYear() === e.getFullYear()) return `${fmtShort(s)}-${fmtFull(e)}`;
  return `${fmtFull(s)}-${fmtFull(e)}`;
}

interface TrainingCardProps {
  enrollment: EnrollmentWithAssignments;
  programInfo: ProgramInfo;
  credentials: Array<{
    credentialName: string;
    badgeUrl: string | null;
    certificateUrl: string | null;
    url: string | null;
  }>;
  extranetUrl: string | null;
  sessionExtranetUrl: string | null;
  onRefundRequest: (enrollmentId: string) => void;
}

function TrainingCard({
  enrollment,
  programInfo,
  credentials,
  extranetUrl,
  sessionExtranetUrl,
  onRefundRequest,
}: TrainingCardProps) {
  const navigate = useNavigate();
  const { cancelSession } = useEnrollments();
  const assigned = activeAssignment(enrollment);
  const session = assigned?.session;

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

  const durationStr = formatDuration(programInfo.durationInDays, programInfo.durationInHours);
  const effectiveExtranet = sessionExtranetUrl ?? extranetUrl;

  const metaParts: (string | null)[] = [
    durationStr,
    programInfo.tags.length > 0 ? programInfo.tags.join(", ") : null,
  ];

  const locationStr = session
    ? session.remote
      ? "En ligne"
      : session.placeName || session.place || null
    : null;

  const dateStr = session
    ? formatCompactDateRange(session.startDate, session.endDate)
    : null;

  const modalityStr = session
    ? session.remote
      ? "À distance"
      : "Présentiel"
    : null;

  return (
    <div className="rounded-xl border bg-card px-5 py-4 space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Link
          to="/catalogue/$code"
          params={{ code: enrollment.programCode }}
          className="font-semibold text-sm leading-tight hover:underline underline-offset-2"
        >
          {programInfo.name}
        </Link>
        <StatusBadge status={enrollment.status} />
      </div>

      <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        {metaParts.filter(Boolean).map((part, i) => (
          <span key={i} className="flex items-center gap-x-2">
            {i > 0 && <span className="text-border">|</span>}
            {part}
          </span>
        ))}
        {enrollment.bexioNetworkLink ? (
          <>
            {metaParts.some(Boolean) && <span className="text-border">|</span>}
            <a
              href={enrollment.bexioNetworkLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Receipt className="h-3 w-3" />
              {enrollment.bexioDocumentNr
                ? `N°${enrollment.bexioDocumentNr}`
                : "Facture"}
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </>
        ) : enrollment.bexioDocumentNr ? (
          <>
            {metaParts.some(Boolean) && <span className="text-border">|</span>}
            <span className="inline-flex items-center gap-1">
              <Receipt className="h-3 w-3" />
              N°{enrollment.bexioDocumentNr}
            </span>
          </>
        ) : null}
      </div>

      {(locationStr || dateStr) && (
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          {locationStr && (
            <span className="inline-flex items-center gap-1">
              {session?.remote ? (
                <Monitor className="h-3 w-3" />
              ) : (
                <MapPin className="h-3 w-3" />
              )}
              {locationStr}
            </span>
          )}
          {dateStr && (
            <>
              {locationStr && <span className="text-border">|</span>}
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {dateStr}
              </span>
            </>
          )}
          {modalityStr && (
            <>
              <span className="text-border">-</span>
              <span>{modalityStr}</span>
            </>
          )}
        </div>
      )}

      {!assigned && enrollment.status === "active" && (
        <p className="text-xs text-muted-foreground italic">Aucune session assignée</p>
      )}

      <div className="flex items-center gap-2 flex-wrap pt-1">
        {effectiveExtranet && (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7 px-2.5" asChild>
            <a href={effectiveExtranet} target="_blank" rel="noopener noreferrer">
              <FileText className="h-3.5 w-3.5" />
              Extranet
              <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/50" />
            </a>
          </Button>
        )}

        {enrollment.status === "completed" &&
          credentials.length > 0 &&
          credentials.map((c) => (
            <Button
              key={c.credentialName}
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-7 px-2.5"
              asChild
            >
              <a
                href={c.certificateUrl ?? c.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
              >
                {c.badgeUrl ? (
                  <img
                    src={c.badgeUrl}
                    alt=""
                    className="h-3.5 w-3.5 rounded object-contain"
                  />
                ) : (
                  <Award className="h-3.5 w-3.5" />
                )}
                Certificat
                <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/50" />
              </a>
            </Button>
          ))}

        {enrollment.status === "active" && assigned && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-7 px-2.5"
              onClick={() => navigate({ to: "/catalogue" })}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Changer de session
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs h-7 px-2.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={cancelSession.isPending}
              onClick={handleCancel}
            >
              <XCircle className="h-3.5 w-3.5" />
              Annuler
            </Button>
          </>
        )}

        {enrollment.status === "active" && !assigned && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-7 px-2.5"
              onClick={() => navigate({ to: "/catalogue" })}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Choisir une session
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs h-7 px-2.5 text-muted-foreground hover:text-foreground"
              onClick={() => onRefundRequest(enrollment.id)}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Remboursement
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

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
        <div className="px-4 sm:px-6 pb-2 space-y-4">
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

export default function Trainings() {
  const [refundTarget, setRefundTarget] = useState<string | null>(null);
  const { enrollments, isLoading, isError } = useEnrollments();
  const { data: categories = [] } = usePrograms();
  const { profileData } = useProfile();
  const { data: extranetData } = useExtranetUrl();
  const { data: extranetSessionsData } = useExtranetSessions();

  const extranetUrl = extranetData?.url ?? null;
  const extranetSessions = extranetSessionsData?.sessions ?? [];

  const programMap = useMemo(() => {
    const m = new Map<string, ProgramInfo>();
    for (const cat of categories) {
      for (const prog of cat.programs) {
        const tier = cheapestTier(prog.pricingTiers);
        const dfCost = prog.digiforma?.costs?.[0]?.cost;
        let price: string | null = null;
        if (tier) {
          price = formatPrice(tier.amount, tier.currency, tier.unit);
        } else if (dfCost != null) {
          price = formatPrice(String(dfCost), "CHF", "total");
        }
        m.set(prog.programCode, {
          name: prog.name,
          price,
          durationInDays: prog.durationInDays ?? prog.digiforma?.durationInDays ?? null,
          durationInHours: prog.durationInHours ?? prog.digiforma?.durationInHours ?? null,
          tags: prog.tags ?? [],
        });
      }
    }
    return m;
  }, [categories]);

  const credentials = profileData?.credentials ?? [];

  const refundProgramName = refundTarget
    ? (programMap.get(enrollments.find((e) => e.id === refundTarget)?.programCode ?? "")?.name ??
        enrollments.find((e) => e.id === refundTarget)?.programCode ??
        "")
    : "";

  const active = enrollments.filter((e) => e.status === "active");
  const completed = enrollments.filter((e) => e.status === "completed");
  const refunded = enrollments.filter((e) => e.status === "refunded");

  const renderCard = (e: EnrollmentWithAssignments) => {
    const info = programMap.get(e.programCode) ?? {
      name: e.programCode,
      price: null,
      durationInDays: null,
      durationInHours: null,
      tags: [],
    };
    const assigned = activeAssignment(e);
    const sessionExtranet = assigned
      ? extranetSessions.find(
          (es) => es.digiformaSessionId === assigned.sessionId
        )?.extranetUrl ?? null
      : null;
    return (
      <TrainingCard
        key={e.id}
        enrollment={e}
        programInfo={info}
        credentials={credentials}
        extranetUrl={extranetUrl}
        sessionExtranetUrl={sessionExtranet}
        onRefundRequest={setRefundTarget}
      />
    );
  };

  const sections = [
    { title: "Inscriptions actives", items: active, color: "text-primary" },
    { title: "Formations complétées", items: completed, color: "" },
    { title: "Remboursements", items: refunded, color: "text-muted-foreground" },
  ];

  return (
    <div className="max-w-2xl space-y-8 pb-12">
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
        <div className="space-y-6">
          {sections.map(
            ({ title, items, color }) =>
              items.length > 0 && (
                <section key={title} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-semibold tracking-tight ${color}`}>
                      {title} ({items.length})
                    </span>
                    <div className="flex-1 border-t" />
                  </div>
                  <div className="space-y-3">{items.map(renderCard)}</div>
                </section>
              )
          )}
        </div>
      )}

      <RefundDialog
        enrollmentId={refundTarget}
        programName={refundProgramName}
        onClose={() => setRefundTarget(null)}
      />
    </div>
  );
}
