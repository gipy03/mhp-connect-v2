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
  ArrowRight,
  CheckCircle2,
  CalendarClock,
  Copy,
  Check,
  Code,
  GraduationCap,
} from "lucide-react";
import { toast } from "sonner";
import {
  useEnrollments,
  useExtranetUrl,
  useExtranetSessions,
  activeAssignment,
  type EnrollmentWithAssignments,
} from "@/hooks/useEnrollments";
import { usePrograms, useProgramNames, formatSessionDateRange } from "@/hooks/useCatalogue";
import { useProfile, type AccredibleCredential } from "@/hooks/useProfile";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

function TrainingsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className={cn("rounded-2xl border bg-card p-5 space-y-4 shadow-xs animate-fade-in", `stagger-${i + 1}`)}>
          <div className="flex gap-4">
            <Skeleton className="hidden sm:block h-28 w-28 rounded-xl shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <Skeleton className="h-5 w-3/5" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-4 w-20" />
              <div className="flex items-center gap-2 pt-1">
                <Skeleton className="h-7 w-28 rounded-md" />
                <Skeleton className="h-7 w-20 rounded-md" />
              </div>
            </div>
          </div>
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
      <Badge variant="destructive" className="text-[10px] px-2 py-0.5 gap-1">
        Remboursé
      </Badge>
    );
  }
  if (enrollment.bexioDocumentNr) {
    return (
      <div className="flex items-center gap-1.5">
        <Badge variant="secondary" className="text-[10px] px-2 py-0.5 gap-1">
          <Receipt className="h-3 w-3" />
          N°{enrollment.bexioDocumentNr}
        </Badge>
        {enrollment.bexioNetworkLink && (
          <a
            href={enrollment.bexioNetworkLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-muted"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    );
  }
  return null;
}

interface TrainingCardProps {
  enrollment: EnrollmentWithAssignments;
  programInfo: ProgramInfo;
  extranetUrl: string | null;
  sessionExtranetUrl: string | null;
  onRefundRequest: (enrollmentId: string) => void;
  isCompleted?: boolean;
}

function TrainingCard({
  enrollment,
  programInfo,
  extranetUrl,
  sessionExtranetUrl,
  onRefundRequest,
  isCompleted: isCompletedProp,
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
  const isCompleted = isCompletedProp ?? enrollment.status === "completed";

  return (
    <div className={cn(
      "rounded-2xl border bg-card overflow-hidden card-hover shadow-xs",
      isCompleted && "opacity-75 hover:opacity-100"
    )}>
      <div className="flex">
        {programInfo.imageUrl ? (
          <div className={cn(
            "hidden sm:block w-32 lg:w-36 shrink-0 overflow-hidden bg-muted",
            isCompleted && "grayscale"
          )}>
            <img
              src={programInfo.imageUrl}
              alt={programInfo.name}
              className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
            />
          </div>
        ) : (
          <div className="hidden sm:flex w-32 lg:w-36 shrink-0 items-center justify-center bg-gradient-to-br from-muted to-muted/60">
            <BookOpen className="h-8 w-8 text-muted-foreground/20" />
          </div>
        )}
        <div className="flex-1 p-4 sm:p-5 space-y-3 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1.5 min-w-0">
              <Link
                to="/catalogue/$code"
                params={{ code: enrollment.programCode }}
                search={{}}
                className="font-semibold text-sm leading-tight hover:text-primary transition-colors underline-offset-2 line-clamp-2 block"
              >
                {programInfo.name}
              </Link>
              {durationStr && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  {durationStr}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isCompleted && enrollment.status !== "refunded" && (
                <Badge className="text-[10px] px-2 py-0.5 gap-1 bg-brand-olive text-white">
                  <CheckCircle2 className="h-3 w-3" />
                  Terminée
                </Badge>
              )}
              {enrollment.status === "active" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0 rounded-lg hover:bg-muted">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
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
          </div>

          {session && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 bg-muted/60 dark:bg-muted/30 rounded-md px-2 py-0.5">
                <Calendar className="h-3 w-3 text-muted-foreground/70" />
                {formatSessionDateRange(session.startDate, session.endDate)}
              </span>
              {session.remote ? (
                <span className="inline-flex items-center gap-1.5 bg-muted/60 dark:bg-muted/30 rounded-md px-2 py-0.5">
                  <Monitor className="h-3 w-3 text-muted-foreground/70" />
                  En ligne
                </span>
              ) : (session.placeName || session.place) ? (
                <span className="inline-flex items-center gap-1.5 bg-muted/60 dark:bg-muted/30 rounded-md px-2 py-0.5">
                  <MapPin className="h-3 w-3 text-muted-foreground/70" />
                  {session.placeName ?? session.place}
                </span>
              ) : null}
              {assigned?.participationMode && (
                <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                  {assigned.participationMode === "remote" ? "En ligne" : "Présentiel"}
                </Badge>
              )}
            </div>
          )}

          {!assigned && enrollment.status === "active" && (
            <p className="text-xs text-muted-foreground italic flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              Aucune session assignée —{" "}
              <Link to="/catalogue" className="underline underline-offset-2 hover:text-foreground transition-colors font-medium not-italic">
                choisir une session
              </Link>
            </p>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap pt-1 border-t border-border/50">
            <div className="flex items-center gap-2 flex-wrap">
              <InvoiceStatus enrollment={enrollment} />
              {programInfo.dfCost != null && programInfo.dfCost > 0 && enrollment.status === "active" && (
                <span className="text-xs text-muted-foreground font-medium">
                  {formatCHF(programInfo.dfCost)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {effectiveExtranet && (
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 px-3 rounded-lg" asChild>
                  <a href={effectiveExtranet} target="_blank" rel="noopener noreferrer">
                    <FileText className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Espace formation</span>
                    <span className="sm:hidden">Espace</span>
                    <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/50" />
                  </a>
                </Button>
              )}
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Demander un remboursement</DialogTitle>
        </DialogHeader>
        <div className="px-4 sm:px-6 pb-2 space-y-5">
          <div className="rounded-xl bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Vous allez soumettre une demande de remboursement pour{" "}
              <span className="font-semibold text-foreground">{programName}</span>. Notre
              équipe examinera votre demande et vous répondra par e-mail.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Motif (optionnel)
            </label>
            <Textarea
              placeholder="Décrivez brièvement la raison de votre demande..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[100px] rounded-xl resize-none"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} className="rounded-lg">
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={requestRefund.isPending}
            className="rounded-lg"
          >
            {requestRefund.isPending ? "Envoi…" : "Soumettre la demande"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Code copié !");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier.");
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 w-7 p-0 rounded-md hover:bg-muted-foreground/10"
      onClick={handleCopy}
      aria-label={copied ? "Copié" : `Copier ${label}`}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </Button>
  );
}

function escapeHtmlAttr(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function CredentialCard({ credential }: { credential: AccredibleCredential }) {
  const linkTarget = credential.url ?? credential.certificateUrl ?? null;
  const safeName = escapeHtmlAttr(credential.credentialName);

  const badgeEmbedCode = credential.badgeUrl && linkTarget
    ? `<a href="${escapeHtmlAttr(linkTarget)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtmlAttr(credential.badgeUrl)}" alt="${safeName}" width="200" height="200" style="border:0" /></a>`
    : credential.badgeUrl
      ? `<img src="${escapeHtmlAttr(credential.badgeUrl)}" alt="${safeName}" width="200" height="200" style="border:0" />`
      : null;

  const iframeEmbedCode = credential.certificateUrl
    ? `<iframe src="${escapeHtmlAttr(credential.certificateUrl)}" width="600" height="400" frameborder="0" style="border:none;border-radius:8px" allowfullscreen></iframe>`
    : null;

  const issuedDate = credential.issuedAt
    ? new Date(credential.issuedAt).toLocaleDateString("fr-CH", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const expiresDate = credential.expiresAt
    ? new Date(credential.expiresAt).toLocaleDateString("fr-CH", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="rounded-2xl border bg-card overflow-hidden shadow-xs card-hover animate-fade-in">
      <div className="p-5 sm:p-6 space-y-5">
        <div className="flex items-start gap-4">
          {credential.badgeUrl ? (
            <div className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-white border shadow-sm flex items-center justify-center p-2">
              <img
                src={credential.badgeUrl}
                alt={credential.credentialName}
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-gradient-to-br from-brand-teal/10 to-brand-terracotta/10 flex items-center justify-center">
              <Award className="h-8 w-8 text-brand-teal" />
            </div>
          )}

          <div className="flex-1 min-w-0 space-y-2">
            <h3 className="font-semibold text-sm sm:text-base leading-tight line-clamp-2">
              {credential.credentialName}
            </h3>
            {credential.recipientName && (
              <p className="text-xs text-muted-foreground">
                Décerné à {credential.recipientName}
              </p>
            )}
            {credential.groupName && (
              <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                {credential.groupName}
              </Badge>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {issuedDate && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {issuedDate}
                </span>
              )}
              {expiresDate && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Expire le {expiresDate}
                </span>
              )}
            </div>
          </div>
        </div>

        {credential.description && (
          <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-3">
            {credential.description}
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {credential.certificateUrl && (
            <Button variant="default" size="sm" className="gap-1.5 text-xs h-8 px-3 rounded-lg" asChild>
              <a href={credential.certificateUrl} target="_blank" rel="noopener noreferrer">
                <Award className="h-3.5 w-3.5" />
                Voir le certificat
                <ExternalLink className="h-2.5 w-2.5 opacity-50" />
              </a>
            </Button>
          )}
          {credential.url && credential.url !== credential.certificateUrl && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 px-3 rounded-lg" asChild>
              <a href={credential.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Page Accredible
              </a>
            </Button>
          )}
        </div>

        {(badgeEmbedCode || iframeEmbedCode) && (
          <div className="border-t border-border/50 pt-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Code className="h-3.5 w-3.5" />
              Code d'intégration
            </div>

            {badgeEmbedCode && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Badge (image)</span>
                  <CopyButton text={badgeEmbedCode} label="le code badge" />
                </div>
                <pre className="rounded-lg bg-muted/70 dark:bg-muted/30 px-3 py-2.5 text-[11px] leading-relaxed font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all select-all">
                  {badgeEmbedCode}
                </pre>
              </div>
            )}

            {iframeEmbedCode && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Certificat (iframe)</span>
                  <CopyButton text={iframeEmbedCode} label="le code iframe" />
                </div>
                <pre className="rounded-lg bg-muted/70 dark:bg-muted/30 px-3 py-2.5 text-[11px] leading-relaxed font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all select-all">
                  {iframeEmbedCode}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Trainings() {
  const [refundTarget, setRefundTarget] = useState<string | null>(null);
  const { enrollments, isLoading, isError } = useEnrollments();
  const { data: categories = [] } = usePrograms();
  const { data: nameMap } = useProgramNames();
  const { profileData } = useProfile();
  const { data: extranetData } = useExtranetUrl();
  const { data: extranetSessionsData } = useExtranetSessions();

  const extranetUrl = extranetData?.url ?? null;
  const extranetSessions = extranetSessionsData?.sessions ?? [];

  const programMap = useMemo(() => {
    const m = new Map<string, ProgramInfo>();
    if (nameMap) {
      for (const [code, entry] of Object.entries(nameMap)) {
        m.set(code, {
          name: entry.name,
          imageUrl: entry.imageUrl,
          durationInDays: null,
          durationInHours: null,
          dfCost: null,
        });
      }
    }
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
  }, [categories, nameMap]);

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

  const renderCard = (e: EnrollmentWithAssignments, index: number, isCompletedSection: boolean) => {
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
      <div key={e.id} className={cn("animate-slide-up", `stagger-${Math.min(index + 1, 8)}`)}>
        <TrainingCard
          enrollment={e}
          programInfo={info}
          extranetUrl={extranetUrl}
          sessionExtranetUrl={sessionExtranet}
          onRefundRequest={setRefundTarget}
          isCompleted={isCompletedSection}
        />
      </div>
    );
  };

  return (
    <div className="max-w-3xl space-y-6 pb-12 animate-page-enter">
      <div className="space-y-1.5">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Mes formations</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Retrouvez vos inscriptions, accédez à vos espaces de formation et certificats.
        </p>
      </div>

      {extranetUrl && (
        <a
          href={extranetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-4 rounded-2xl border bg-gradient-to-r from-brand-teal/5 to-brand-terracotta/5 dark:from-brand-teal/10 dark:to-brand-terracotta/10 p-4 sm:p-5 card-hover shadow-xs animate-fade-in"
        >
          <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-brand-teal/10 group-hover:bg-brand-teal/15 transition-colors">
            <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6 text-brand-teal" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm sm:text-base leading-tight">
              Espace apprenant DigiForma
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              Accédez à vos documents, évaluations et ressources pédagogiques
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-brand-teal group-hover:text-brand-teal/80 transition-colors">
            <span className="hidden sm:inline">Ouvrir</span>
            <ExternalLink className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </a>
      )}

      {isError && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive animate-fade-in flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 shrink-0">
            <BookOpen className="h-4 w-4" />
          </div>
          Impossible de charger vos formations. Réessayez dans un instant.
        </div>
      )}

      <Tabs defaultValue="formations" className="space-y-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="formations" className="gap-1.5 flex-1 sm:flex-initial">
            <BookOpen className="h-3.5 w-3.5" />
            Formations
            {enrollments.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1 h-4 min-w-[1rem] flex items-center justify-center">
                {enrollments.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="certificats" className="gap-1.5 flex-1 sm:flex-initial">
            <Award className="h-3.5 w-3.5" />
            Certificats
            {credentials.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1 h-4 min-w-[1rem] flex items-center justify-center">
                {credentials.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="formations">
          {isLoading ? (
            <TrainingsSkeleton />
          ) : enrollments.length === 0 ? (
            <div className="rounded-2xl border border-dashed py-16 px-6 flex flex-col items-center gap-4 text-center bg-gradient-to-b from-muted/30 to-transparent animate-fade-in">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <BookOpen className="h-7 w-7 text-primary" />
              </div>
              <div className="space-y-1.5">
                <p className="text-base font-semibold">Aucune formation enregistrée</p>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
                  Inscrivez-vous à une formation pour la retrouver ici.
                </p>
              </div>
              <Button size="sm" className="mt-2 gap-1.5 rounded-lg" asChild>
                <Link to="/catalogue">
                  <BookOpen className="h-3.5 w-3.5" />
                  Voir le catalogue
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-10">
              {upcoming.length > 0 && (
                <section className="space-y-4 animate-fade-in">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-terracotta/10">
                        <CalendarClock className="h-3.5 w-3.5 text-brand-terracotta" />
                      </div>
                      <span className="text-base font-semibold tracking-tight">
                        À venir
                      </span>
                      <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                        {upcoming.length}
                      </Badge>
                    </div>
                    <div className="flex-1 border-t border-border/50" />
                  </div>
                  <div className="space-y-3">
                    {upcoming.map((e, i) => renderCard(e, i, false))}
                  </div>
                </section>
              )}

              {completed.length > 0 && (
                <section className="space-y-4 animate-fade-in stagger-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
                        <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <span className="text-base font-semibold tracking-tight text-muted-foreground">
                        Terminées
                      </span>
                      <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                        {completed.length}
                      </Badge>
                    </div>
                    <div className="flex-1 border-t border-border/50" />
                  </div>
                  <div className="space-y-3">
                    {completed.map((e, i) => renderCard(e, i, true))}
                  </div>
                </section>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="certificats">
          {credentials.length === 0 ? (
            <div className="rounded-2xl border border-dashed py-16 px-6 flex flex-col items-center gap-4 text-center bg-gradient-to-b from-muted/30 to-transparent animate-fade-in">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-teal/10">
                <Award className="h-7 w-7 text-brand-teal" />
              </div>
              <div className="space-y-1.5">
                <p className="text-base font-semibold">Aucun certificat disponible</p>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
                  Vos certificats apparaîtront ici une fois vos formations terminées et validées.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {credentials.map((c, i) => (
                <div key={c.id} className={cn("animate-slide-up", `stagger-${Math.min(i + 1, 8)}`)}>
                  <CredentialCard credential={c} />
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <RefundDialog
        enrollmentId={refundTarget}
        programName={refundProgramName}
        onClose={() => setRefundTarget(null)}
      />
    </div>
  );
}
