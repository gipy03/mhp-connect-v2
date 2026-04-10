import { useState, useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  Award,
  ExternalLink,
  MapPin,
  Calendar,
  Monitor,
  FileText,
  Receipt,
  Clock,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import {
  useEnrollments,
  useExtranetUrl,
  useExtranetSessions,
  activeAssignment,
  type EnrollmentWithAssignments,
} from "@/hooks/useEnrollments";
import { usePrograms, formatSessionDateRange } from "@/hooks/useCatalogue";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

function TrainingsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-start gap-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="ml-auto h-5 w-16 rounded-full" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-4 w-48" />
        </div>
      ))}
    </div>
  );
}

interface ProgramInfo {
  name: string;
  imageUrl: string | null;
  durationInDays: number | null;
  durationInHours: number | null;
  dfCost: number | null;
}

function formatDuration(days: number | null, hours: number | null): string | null {
  if (!days && !hours) return null;
  const parts: string[] = [];
  if (days) parts.push(`${days} jour${days > 1 ? "s" : ""}`);
  if (hours) parts.push(`${hours}h`);
  return parts.join(" · ");
}

function formatCHF(amount: number): string {
  const formatted = new Intl.NumberFormat("fr-CH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  return `CHF ${formatted}.–`;
}

function InvoiceStatus({ enrollment }: { enrollment: EnrollmentWithAssignments }) {
  if (enrollment.status === "refunded") {
    return (
      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
        Remboursé
      </Badge>
    );
  }
  if (enrollment.bexioDocumentNr) {
    return (
      <div className="flex items-center gap-1.5">
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
          <Receipt className="h-3 w-3" />
          N°{enrollment.bexioDocumentNr}
        </Badge>
        {enrollment.bexioNetworkLink && (
          <a
            href={enrollment.bexioNetworkLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    );
  }
  if (enrollment.status === "active") {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-200 dark:border-amber-800">
        Facture en attente
      </Badge>
    );
  }
  return null;
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
  const effectiveExtranet = sessionExtranetUrl ?? extranetUrl;

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
  const isCompleted = enrollment.status === "completed";

  return (
    <div className="rounded-xl border bg-card overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex">
        {programInfo.imageUrl && (
          <div className="hidden sm:block w-32 shrink-0 overflow-hidden">
            <img
              src={programInfo.imageUrl}
              alt={programInfo.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="flex-1 p-4 sm:p-5 space-y-3 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <Link
                to="/catalogue/$code"
                params={{ code: enrollment.programCode }}
                className="font-semibold text-sm leading-tight hover:underline underline-offset-2 line-clamp-1"
              >
                {programInfo.name}
              </Link>
              {durationStr && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {durationStr}
                </p>
              )}
            </div>

            {enrollment.status === "active" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {assigned && (
                    <>
                      <DropdownMenuItem onClick={() => navigate({ to: "/catalogue" })}>
                        Changer de session
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={handleCancel}
                      >
                        Annuler la session
                      </DropdownMenuItem>
                    </>
                  )}
                  {!assigned && (
                    <>
                      <DropdownMenuItem onClick={() => navigate({ to: "/catalogue" })}>
                        Choisir une session
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onRefundRequest(enrollment.id)}>
                        Demander un remboursement
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {session && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatSessionDateRange(session.startDate, session.endDate)}
              </span>
              {session.remote ? (
                <span className="inline-flex items-center gap-1">
                  <Monitor className="h-3.5 w-3.5" />
                  En ligne
                </span>
              ) : (session.placeName || session.place) ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {session.placeName ?? session.place}
                </span>
              ) : null}
              {assigned?.participationMode && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {assigned.participationMode === "remote" ? "En ligne" : "Présentiel"}
                </Badge>
              )}
            </div>
          )}

          {!assigned && enrollment.status === "active" && (
            <p className="text-xs text-muted-foreground italic">
              Aucune session assignée —{" "}
              <Link to="/catalogue" className="underline underline-offset-2 hover:text-foreground">
                choisir une session
              </Link>
            </p>
          )}

          <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              <InvoiceStatus enrollment={enrollment} />
              {programInfo.dfCost != null && programInfo.dfCost > 0 && enrollment.status === "active" && (
                <span className="text-xs text-muted-foreground">
                  {formatCHF(programInfo.dfCost)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {effectiveExtranet && (
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7 px-2.5" asChild>
                  <a href={effectiveExtranet} target="_blank" rel="noopener noreferrer">
                    <FileText className="h-3.5 w-3.5" />
                    Espace formation
                    <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/50" />
                  </a>
                </Button>
              )}

              {isCompleted && credentials.length > 0 && credentials.map((c) => (
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
                  </a>
                </Button>
              ))}
            </div>
          </div>
        </div>
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
        m.set(prog.programCode, {
          name: prog.name,
          imageUrl: prog.imageUrl,
          durationInDays: prog.durationInDays ?? prog.digiforma?.durationInDays ?? null,
          durationInHours: prog.durationInHours ?? prog.digiforma?.durationInHours ?? null,
          dfCost: prog.digiforma?.costs?.[0]?.cost ?? null,
        });
      }
    }
    return m;
  }, [categories]);

  const credentials = profileData?.credentials ?? [];

  const refundProgramName = refundTarget
    ? (programMap.get(enrollments.find((e) => e.id === refundTarget)?.programCode ?? "")?.name ??
        enrollments.find((e) => e.id === refundTarget)?.programCode ?? "")
    : "";

  const { upcoming, completed } = useMemo(() => {
    const now = Date.now();
    const up: EnrollmentWithAssignments[] = [];
    const done: EnrollmentWithAssignments[] = [];

    for (const e of enrollments) {
      if (e.status === "refunded") {
        done.push(e);
        continue;
      }
      if (e.status === "completed") {
        done.push(e);
        continue;
      }
      const assigned = activeAssignment(e);
      const sessionEnd = assigned?.session?.endDate ?? assigned?.session?.startDate;
      if (sessionEnd && new Date(sessionEnd).getTime() < now) {
        done.push(e);
      } else {
        up.push(e);
      }
    }

    up.sort((a, b) => {
      const aDate = activeAssignment(a)?.session?.startDate;
      const bDate = activeAssignment(b)?.session?.startDate;
      if (!aDate) return 1;
      if (!bDate) return -1;
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    });

    done.sort((a, b) => {
      const aDate = activeAssignment(a)?.session?.endDate ?? a.enrolledAt;
      const bDate = activeAssignment(b)?.session?.endDate ?? b.enrolledAt;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });

    return { upcoming: up, completed: done };
  }, [enrollments]);

  const renderCard = (e: EnrollmentWithAssignments) => {
    const info = programMap.get(e.programCode) ?? {
      name: e.programCode,
      imageUrl: null,
      durationInDays: null,
      durationInHours: null,
      dfCost: null,
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

  return (
    <div className="max-w-3xl space-y-8 pb-12 animate-page-enter">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Mes formations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Retrouvez vos inscriptions, accédez à vos espaces de formation et certificats.
        </p>
      </div>

      {isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
          Impossible de charger vos formations. Réessayez dans un instant.
        </div>
      )}

      {isLoading ? (
        <TrainingsSkeleton />
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
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold tracking-tight">
                  À venir ({upcoming.length})
                </span>
                <div className="flex-1 border-t" />
              </div>
              <div className="space-y-3">{upcoming.map(renderCard)}</div>
            </section>
          )}

          {completed.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold tracking-tight text-muted-foreground">
                  Terminées ({completed.length})
                </span>
                <div className="flex-1 border-t" />
              </div>
              <div className="space-y-3">{completed.map(renderCard)}</div>
            </section>
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
