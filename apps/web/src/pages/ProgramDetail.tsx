import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "@tanstack/react-router";
import {
  ChevronLeft,
  Calendar,
  MapPin,
  Monitor,
  Clock,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Loader2,
  ArrowRight,
  Accessibility,
  Award,
  Target,
  FileCheck,
  ExternalLink,
  MessageSquare,
  Bell,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useProgram,
  formatSessionDateRange,
  upcomingSessions,
  type CalendarSession,
  type CatalogueProgram,
} from "@/hooks/useCatalogue";
import { ENROLLMENTS_QUERY_KEY } from "@/hooks/useEnrollments";
import { useAuth } from "@/hooks/useAuth";
import { useGetOrCreateProgramChannel } from "@/hooks/useForum";
import { api, ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function formatCHF(amount: number): string {
  if (amount <= 0) return "";
  const formatted = new Intl.NumberFormat("fr-CH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `CHF ${formatted}`;
}

interface EnrollPayload {
  programCode: string;
  sessionId: string;
  pricingTierId: string;
  participationMode?: "in_person" | "remote" | null;
}

interface EnrollmentData {
  id: string;
  programCode: string;
  bexioDocumentNr: string | null;
  bexioTotal: string | null;
  bexioNetworkLink: string | null;
  enrolledAt: string;
}

interface EnrollmentResponse {
  enrollment: EnrollmentData;
  warnings: string[];
}

interface EnrollmentResult {
  id: string;
  programCode: string;
  bexioDocumentNr: string | null;
  bexioTotal: string | null;
  bexioNetworkLink: string | null;
  enrolledAt: string;
  warnings: string[];
}

function useEnroll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: EnrollPayload): Promise<EnrollmentResult> => {
      const response = await api.post<EnrollmentResponse>("/enrollments", data);
      return {
        ...response.enrollment,
        warnings: response.warnings,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ENROLLMENTS_QUERY_KEY });
    },
  });
}

type DialogStep =
  | { type: "auth_required" }
  | { type: "selecting"; sessionId: string; tierId: string; participationMode: "in_person" | "remote" | null }
  | { type: "success"; result: EnrollmentResult; sessionId: string }
  | { type: "error"; message: string };

interface EnrollmentDialogProps {
  program: CatalogueProgram;
  open: boolean;
  onClose: () => void;
  initialSessionId?: string;
}

function EnrollmentDialog({
  program,
  open,
  onClose,
  initialSessionId,
}: EnrollmentDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const enrollMutation = useEnroll();

  const upcoming = upcomingSessions(program.sessions);
  const activeTiers = program.pricingTiers.filter((t) => t.active);
  const defaultTierId = activeTiers[0]?.id ?? "";

  const initialStep = (): DialogStep => {
    if (!user) return { type: "auth_required" };
    return {
      type: "selecting",
      sessionId: initialSessionId ?? upcoming[0]?.id ?? "",
      tierId: defaultTierId,
      participationMode: program.hybridEnabled ? "in_person" : null,
    };
  };

  const [step, setStep] = useState<DialogStep>(initialStep);
  const [tcAccepted, setTcAccepted] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(initialStep());
      setTcAccepted(false);
    }
  }, [open, initialSessionId]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
    }
  };

  const handleSubmit = async () => {
    if (step.type !== "selecting") return;
    if (!step.sessionId) {
      toast.error("Veuillez sélectionner une session.");
      return;
    }

    try {
      const result = await enrollMutation.mutateAsync({
        programCode: program.programCode,
        sessionId: step.sessionId,
        pricingTierId: step.tierId || "none",
        ...(step.participationMode ? { participationMode: step.participationMode } : {}),
      });
      setStep({ type: "success", result, sessionId: step.sessionId });
    } catch (err) {
      let msg: string;
      if (err instanceof ApiError) {
        if (err.status === 409) {
          msg = "Vous êtes déjà inscrit(e) à ce programme.";
        } else if (err.status === 400) {
          msg = err.message || "Données invalides. Veuillez vérifier votre sélection.";
        } else if (err.status >= 500) {
          msg = "Une erreur serveur est survenue. Veuillez réessayer plus tard.";
        } else {
          msg = err.message;
        }
      } else {
        msg = "Une erreur de connexion est survenue. Vérifiez votre connexion et réessayez.";
      }
      setStep({ type: "error", message: msg });
    }
  };

  const selectedSession =
    step.type === "selecting"
      ? program.sessions.find((s) => s.id === step.sessionId) ?? null
      : null;

  const stepIndex =
    step.type === "auth_required" ? 0
    : step.type === "selecting" ? 1
    : step.type === "success" ? 3
    : step.type === "error" ? 2
    : 1;

  const stepLabels = ["Connexion", "Sélection", "Confirmation", "Terminé"];

  const selectedTier = step.type === "selecting" && step.tierId
    ? activeTiers.find((t) => t.id === step.tierId) ?? null
    : null;

  const dfCost = program.digiforma?.costs?.[0]?.cost ?? null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <div className="flex items-center justify-center gap-2 pt-2 pb-1 px-4">
          {stepLabels.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "h-2 w-2 rounded-full transition-colors",
                    i <= stepIndex ? "bg-primary" : "bg-muted-foreground/20"
                  )}
                />
                <span className="text-[10px] text-muted-foreground hidden sm:block">
                  {label}
                </span>
              </div>
              {i < stepLabels.length - 1 && (
                <div
                  className={cn(
                    "h-px w-6 sm:w-10 transition-colors mb-3 sm:mb-0",
                    i < stepIndex ? "bg-primary" : "bg-muted-foreground/20"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {step.type === "auth_required" && (
          <>
            <DialogHeader>
              <DialogTitle>Connexion requise</DialogTitle>
              <DialogDescription>
                Vous devez être connecté pour vous inscrire à une formation.
              </DialogDescription>
            </DialogHeader>
            <div className="px-4 sm:px-6 pb-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Créez un compte ou connectez-vous pour accéder à toutes les
                formations MHP et gérer vos inscriptions.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={onClose}>
                Annuler
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  localStorage.setItem("mhp_enroll_intent", JSON.stringify({ programCode: program.programCode, sessionId: initialSessionId }));
                  navigate({ to: "/" });
                }}
              >
                Se connecter
              </Button>
              <Button size="sm" onClick={() => {
                localStorage.setItem("mhp_enroll_intent", JSON.stringify({ programCode: program.programCode, sessionId: initialSessionId }));
                navigate({ to: "/register" });
              }}>
                Créer un compte
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </DialogFooter>
          </>
        )}

        {step.type === "selecting" && (
          <>
            <DialogHeader>
              <DialogTitle>S'inscrire</DialogTitle>
              <DialogDescription className="line-clamp-1">
                {program.name}
              </DialogDescription>
            </DialogHeader>

            <div className="px-4 sm:px-6 pb-2 space-y-5">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Session
                </p>
                {upcoming.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Aucune session disponible pour le moment.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => {
                        toast.success("Nous vous informerons dès qu'une nouvelle session sera programmée.");
                        onClose();
                      }}
                    >
                      <Bell className="h-3.5 w-3.5" />
                      Être informé des prochaines dates
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {upcoming.map((s) => {
                      const selected = step.sessionId === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() =>
                            setStep({ ...step, sessionId: s.id })
                          }
                          className={cn(
                            "w-full text-left rounded-lg border p-3 transition-colors",
                            selected
                              ? "border-foreground bg-primary/5"
                              : "hover:bg-accent"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5">
                              <p className="text-sm font-medium">
                                {formatSessionDateRange(s.startDate, s.endDate)}
                              </p>
                              {s.remote ? (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Monitor className="h-3 w-3" />
                                  En ligne
                                </p>
                              ) : (s.placeName || s.place) ? (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {s.placeName ?? s.place}
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground/60 flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  Lieu à confirmer
                                </p>
                              )}
                            </div>
                            <div
                              className={cn(
                                "mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 transition-colors",
                                selected
                                  ? "border-foreground bg-foreground"
                                  : "border-muted-foreground/40"
                              )}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {program.hybridEnabled && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Mode de participation
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["in_person", "remote"] as const).map((mode) => {
                      const selected = step.participationMode === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() =>
                            setStep({ ...step, participationMode: mode })
                          }
                          className={cn(
                            "flex items-center gap-2 rounded-lg border p-3 transition-colors text-left",
                            selected
                              ? "border-foreground bg-primary/5"
                              : "hover:bg-accent"
                          )}
                        >
                          {mode === "in_person" ? (
                            <MapPin className="h-4 w-4 shrink-0" />
                          ) : (
                            <Monitor className="h-4 w-4 shrink-0" />
                          )}
                          <span className="text-sm font-medium">
                            {mode === "in_person" ? "Présentiel" : "En ligne"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedSession && (
                <div className="rounded-lg bg-muted/40 border p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Récapitulatif
                  </p>
                  <div className="text-sm space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Session</span>
                      <span className="font-medium">
                        {formatSessionDateRange(
                          selectedSession.startDate,
                          selectedSession.endDate
                        )}
                      </span>
                    </div>
                    {selectedTier && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Tarif</span>
                        <span className="font-medium">{selectedTier.label}</span>
                      </div>
                    )}
                    {(selectedTier || dfCost) && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Prix</span>
                        <span className="font-semibold text-primary">
                          CHF {selectedTier
                            ? new Intl.NumberFormat("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(selectedTier.amount))
                            : dfCost
                              ? new Intl.NumberFormat("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(dfCost)
                              : "—"
                          }
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground pt-1 border-t">
                    Une facture vous sera envoyée par email après confirmation.
                  </p>
                </div>
              )}

              <label className="flex items-start gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={tcAccepted}
                  onChange={(e) => setTcAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
                />
                <span className="text-xs text-muted-foreground leading-snug">
                  J'accepte les{" "}
                  <a
                    href="https://www.mhp-hypnose.com/cgi"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline hover:text-primary/80"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Conditions Générales d'Inscription
                  </a>
                </span>
              </label>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={onClose}>
                Annuler
              </Button>
              <Button
                size="sm"
                disabled={
                  enrollMutation.isPending ||
                  !step.sessionId ||
                  upcoming.length === 0 ||
                  !tcAccepted
                }
                onClick={handleSubmit}
              >
                {enrollMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Inscription en cours…
                  </>
                ) : (
                  "Confirmer l'inscription"
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {step.type === "success" && (
          <>
            <div className="px-4 sm:px-6 pt-8 pb-4 flex flex-col items-center text-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-lg font-semibold tracking-tight">
                  Inscription confirmée
                </h2>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Votre inscription au programme{" "}
                  <strong>{program.name}</strong> a bien été enregistrée.
                  Un email de confirmation vous a été envoyé.
                </p>
              </div>

              {(() => {
                const hasInvoiceWarning = step.result.warnings.some(
                  (w) => w.includes("invoice") || w.includes("bexio")
                );
                const hasSendFailure = step.result.warnings.some(
                  (w) => w.includes("invoice_send_failed")
                );
                const hasNonInvoiceWarning = step.result.warnings.some(
                  (w) => !w.includes("invoice") && !w.includes("bexio") && !w.includes("confirmation_email")
                );

                return (
                  <>
                    {step.result.bexioDocumentNr && (
                      <div className="w-full rounded-lg border bg-muted/30 p-4 space-y-2 text-left">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Facture</span>
                          <span className="font-medium">
                            N°{step.result.bexioDocumentNr}
                          </span>
                        </div>
                        {step.result.bexioTotal && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Montant</span>
                            <span className="font-medium">
                              CHF {step.result.bexioTotal}
                            </span>
                          </div>
                        )}
                        {step.result.bexioNetworkLink && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Facture en ligne</span>
                            <a
                              href={step.result.bexioNetworkLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-primary underline underline-offset-2 flex items-center gap-1"
                            >
                              Consulter
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        )}
                        {hasSendFailure && (
                          <p className="text-xs text-amber-700 dark:text-amber-300 pt-1 border-t">
                            L'envoi de la facture par email a échoué. Elle vous sera renvoyée sous peu.
                          </p>
                        )}
                      </div>
                    )}

                    {!step.result.bexioDocumentNr && hasInvoiceWarning && (
                      <div className="w-full rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 text-left">
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          Votre facture sera envoyée sous peu. Si vous ne la recevez pas dans les 24h, contactez-nous.
                        </p>
                      </div>
                    )}

                    {hasNonInvoiceWarning && (
                      <div className="w-full rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 text-left">
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          Certaines actions ont rencontré un problème mineur. Votre inscription reste valide.
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={onClose}>
                Fermer
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onClose();
                  navigate({ to: "/user/trainings" });
                }}
              >
                Mes formations
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </DialogFooter>
          </>
        )}

        {step.type === "error" && (
          <>
            <div className="px-4 sm:px-6 pt-8 pb-4 flex flex-col items-center text-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-7 w-7 text-destructive" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-lg font-semibold tracking-tight">
                  Erreur d'inscription
                </h2>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {step.message}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={onClose}>
                Fermer
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (!user) {
                    setStep({ type: "auth_required" });
                  } else {
                    setStep({
                      type: "selecting",
                      sessionId:
                        initialSessionId ?? upcomingSessions(program.sessions)[0]?.id ?? "",
                      tierId: defaultTierId,
                      participationMode: program.hybridEnabled ? "in_person" : null,
                    });
                  }
                }}
              >
                Réessayer
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SessionRow({
  session,
  onEnroll,
}: {
  session: CalendarSession;
  onEnroll: (sessionId: string) => void;
}) {
  return (
    <div className="py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <p className="text-sm font-medium">
            {formatSessionDateRange(session.startDate, session.endDate)}
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            {session.remote ? (
              <Badge variant="secondary" className="text-[11px] gap-1">
                <Monitor className="h-3 w-3" />
                En ligne
              </Badge>
            ) : (session.placeName || session.place) ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {session.placeName ?? session.place}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-muted-foreground/60">
                <MapPin className="h-3.5 w-3.5" />
                Lieu à confirmer
              </span>
            )}
            {session.dates.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {session.dates.length} jour{session.dates.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8"
            onClick={() => onEnroll(session.id)}
          >
            S'inscrire
          </Button>
        </div>
      </div>
    </div>
  );
}

function InstructorCard({
  instructor,
}: {
  instructor: { name: string; role?: string; photoUrl?: string; profileUrl?: string };
}) {
  const content = (
    <div className="flex items-center gap-3">
      {instructor.photoUrl ? (
        <img
          src={instructor.photoUrl}
          alt={instructor.name}
          className="h-12 w-12 rounded-full object-cover grayscale"
        />
      ) : (
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm font-medium">
          {instructor.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
        </div>
      )}
      <div>
        <p className="text-sm font-medium">{instructor.name}</p>
        {instructor.role && (
          <p className="text-xs text-muted-foreground">{instructor.role}</p>
        )}
      </div>
      {instructor.profileUrl && (
        <ExternalLink className="h-3 w-3 text-muted-foreground/50 ml-auto" />
      )}
    </div>
  );

  if (instructor.profileUrl) {
    return (
      <a
        href={instructor.profileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-lg border p-3 hover:bg-accent transition-colors"
      >
        {content}
      </a>
    );
  }

  return (
    <div className="rounded-lg border p-3">
      {content}
    </div>
  );
}

function ProgramChannelLink({
  programCode,
}: {
  programCode: string;
}) {
  const { hasFeature } = useAuth();
  const getOrCreate = useGetOrCreateProgramChannel();

  if (!hasFeature("community")) return null;

  const handleClick = async () => {
    try {
      const channel = await getOrCreate.mutateAsync({ programCode });
      window.location.href = `/user/community?channelId=${channel.id}`;
    } catch {
      toast.error("Impossible d'accéder à la discussion.");
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={getOrCreate.isPending}
      className="w-full rounded-xl border bg-card p-4 text-left hover:bg-accent transition-colors flex items-center gap-3"
    >
      <MessageSquare className="h-5 w-5 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Discussion du programme</p>
        <p className="text-xs text-muted-foreground">
          Rejoindre le canal de discussion
        </p>
      </div>
      {getOrCreate.isPending && (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      )}
    </button>
  );
}

export default function ProgramDetail() {
  const { code } = useParams({ strict: false }) as { code: string };
  const { data: program, isLoading, isError } = useProgram(code);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogSessionId, setDialogSessionId] = useState<string | undefined>();

  const openEnroll = (sessionId?: string) => {
    setDialogSessionId(sessionId);
    setDialogOpen(true);
  };

  useEffect(() => {
    if (!program) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("enroll") === "true") {
      const sid = params.get("sessionId") || undefined;
      if (sid) setDialogSessionId(sid);
      setDialogOpen(true);
      params.delete("enroll");
      params.delete("sessionId");
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params}`
        : window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, [program]);

  useEffect(() => {
    if (!program) return;
    const prevTitle = document.title;
    document.title = `${program.name} — Catalogue MHP`;

    const createdEls: HTMLElement[] = [];
    const prevMeta: Record<string, string | null> = {};

    const setMeta = (name: string, content: string) => {
      const attr = name.startsWith("og:") ? "property" : "name";
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
        createdEls.push(el);
      } else {
        prevMeta[name] = el.getAttribute("content");
      }
      el.setAttribute("content", content);
    };

    const description = program.description
      ? program.description.replace(/<[^>]*>/g, "").slice(0, 160)
      : `Formation ${program.name} — MHP Hypnose`;
    setMeta("description", description);
    setMeta("og:title", program.name);
    setMeta("og:description", description);
    setMeta("og:type", "website");
    if (program.imageUrl) setMeta("og:image", program.imageUrl);

    return () => {
      document.title = prevTitle;
      createdEls.forEach((el) => el.remove());
      for (const [name, prev] of Object.entries(prevMeta)) {
        const attr = name.startsWith("og:") ? "property" : "name";
        const el = document.querySelector(`meta[${attr}="${name}"]`);
        if (el && prev != null) el.setAttribute("content", prev);
      }
    };
  }, [program]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 space-y-8 animate-page-enter">
        <Skeleton className="h-5 w-32" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !program) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16 text-center space-y-4">
        <BookOpen className="h-10 w-10 text-muted-foreground/30 mx-auto" />
        <p className="text-muted-foreground text-sm">
          Programme introuvable ou non publié.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/catalogue">Retour au catalogue</Link>
        </Button>
      </div>
    );
  }

  const upcoming = upcomingSessions(program.sessions);
  const df = program.digiforma;
  const dfCost = df?.costs?.[0]?.cost ?? null;
  const days = df?.durationInDays ?? program.durationInDays ?? null;
  const hours = df?.durationInHours ?? null;
  const instructorList = program.instructors;

  return (
    <div className="animate-page-enter">
      <div className="relative">
        {program.imageUrl ? (
          <div className="h-64 sm:h-80 overflow-hidden">
            <img
              src={program.imageUrl}
              alt={program.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          </div>
        ) : (
          <div className="h-32 sm:h-48 bg-muted" />
        )}

        <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 pb-4 sm:pb-6 mx-auto max-w-6xl">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
            <Link to="/catalogue" className="hover:text-foreground transition-colors">
              Catalogue
            </Link>
            <ChevronLeft className="h-3 w-3 rotate-180" />
            <span className="text-foreground truncate">{program.name}</span>
          </nav>
          <div className="space-y-2">
            {program.highlightLabel && (
              <Badge variant="default" className="text-xs">
                {program.highlightLabel}
              </Badge>
            )}
            <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight max-w-2xl">
              {program.name}
            </h1>
            {df?.subtitle && (
              <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
                {df.subtitle}
              </p>
            )}
            <div className="flex items-center gap-3 sm:gap-4 text-xs text-muted-foreground flex-wrap">
              {days && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {days} jour{days > 1 ? "s" : ""}
                  {hours ? ` (${hours}h)` : ""}
                </span>
              )}
              {upcoming.length > 0 && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {upcoming.length} session{upcoming.length !== 1 ? "s" : ""} à venir
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-10">
          <div className="lg:col-span-2 space-y-10">
            <section className="space-y-3 rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold tracking-tight flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  Prochaines sessions
                </h2>
                {upcoming.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {upcoming.length} session{upcoming.length > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              {upcoming.length > 0 ? (
                <div className="divide-y">
                  {upcoming.map((s) => (
                    <SessionRow
                      key={s.id}
                      session={s}
                      onEnroll={(sid) => openEnroll(sid)}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-4 text-center space-y-3">
                  <Calendar className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    Aucune session planifiée pour le moment.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => {
                      toast.success("Nous vous informerons dès qu'une nouvelle session sera programmée.");
                    }}
                  >
                    <Bell className="h-3.5 w-3.5" />
                    Être informé des prochaines dates
                  </Button>
                </div>
              )}
            </section>

            {program.description && (
              <section className="space-y-3">
                <h2 className="text-base font-semibold tracking-tight">
                  Description
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {program.description}
                </p>
              </section>
            )}

            {program.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {program.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {df?.goals && df.goals.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-base font-semibold tracking-tight">
                  Objectifs pédagogiques
                </h2>
                <ul className="space-y-2">
                  {df.goals.map((g, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-foreground/50 shrink-0 mt-0.5" />
                      {g.text}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {df?.steps && df.steps.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-base font-semibold tracking-tight">
                  Programme
                </h2>
                <ol className="space-y-3">
                  {df.steps.map((step, i) => (
                    <li key={i}>
                      <div className="flex items-start gap-3">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground mt-0.5">
                          {i + 1}
                        </span>
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{step.text}</p>
                          {step.substeps?.length > 0 && (
                            <ul className="space-y-0.5 pl-3">
                              {step.substeps.map((sub, j) => (
                                <li key={j} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                  <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
                                  {sub.text}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {df?.assessments && df.assessments.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-base font-semibold tracking-tight">
                  Modalités d'évaluation
                </h2>
                <ul className="space-y-1.5">
                  {df.assessments.map((a, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                      {a.text}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(df?.admissionModality || df?.certificationModality || df?.graduationModality || df?.graduationTarget || df?.handicappedAccessibility) && (
              <section className="space-y-3">
                <h2 className="text-base font-semibold tracking-tight">
                  Informations pratiques
                </h2>
                <dl className="space-y-3">
                  {df.admissionModality && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                        Admission
                      </dt>
                      <dd className="text-sm">{df.admissionModality}</dd>
                    </div>
                  )}
                  {df.certificationModality && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
                        <FileCheck className="h-3.5 w-3.5" />
                        Certification
                      </dt>
                      <dd className="text-sm">{df.certificationModality}</dd>
                    </div>
                  )}
                  {df.graduationModality && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
                        <Award className="h-3.5 w-3.5" />
                        Diplôme
                      </dt>
                      <dd className="text-sm">{df.graduationModality}</dd>
                    </div>
                  )}
                  {df.graduationTarget && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
                        <Target className="h-3.5 w-3.5" />
                        Public visé
                      </dt>
                      <dd className="text-sm">{df.graduationTarget}</dd>
                    </div>
                  )}
                  {df.handicappedAccessibility && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
                        <Accessibility className="h-3.5 w-3.5" />
                        Accessibilité PMR
                      </dt>
                      <dd className="text-sm">{df.handicappedAccessibility}</dd>
                    </div>
                  )}
                </dl>
              </section>
            )}

            {df?.satisfactionRate && df.satisfactionRate.evaluationsCount > 0 && (
              <section className="rounded-xl border bg-muted/30 p-4 flex items-center gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold tracking-tight">
                    {Math.round(df.satisfactionRate.score * 10) / 10}
                    <span className="text-sm font-normal text-muted-foreground">/5</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Satisfaction
                  </p>
                </div>
                <Separator orientation="vertical" className="h-10" />
                <p className="text-xs text-muted-foreground">
                  Basé sur {df.satisfactionRate.evaluationsCount} évaluation
                  {df.satisfactionRate.evaluationsCount > 1 ? "s" : ""}
                </p>
              </section>
            )}

            {instructorList && instructorList.length > 0 && (
              <>
                <Separator />
                <section className="space-y-4">
                  <h2 className="text-base font-semibold tracking-tight">
                    Équipe pédagogique
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {instructorList.map((t, i) => (
                      <InstructorCard key={i} instructor={t} />
                    ))}
                  </div>
                </section>
              </>
            )}

          </div>

          <div className="lg:col-span-1 order-first lg:order-last">
            <div className="lg:sticky lg:top-20 space-y-4">
              <div className="rounded-xl border bg-card p-5 space-y-4">
                <div className="space-y-2">
                  {dfCost != null && dfCost > 0 ? (
                    <div>
                      <p className="text-xl font-semibold">
                        {formatCHF(dfCost)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        incl. 0% TVA
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Prix sur demande
                    </p>
                  )}

                </div>

                <Button
                  className="w-full"
                  disabled={upcoming.length === 0}
                  onClick={() => openEnroll()}
                >
                  {upcoming.length === 0 ? "Aucune session disponible" : "S'inscrire"}
                </Button>

                {upcoming.length === 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 text-xs"
                    onClick={() => {
                      toast.success("Nous vous informerons dès qu'une nouvelle session sera programmée.");
                    }}
                  >
                    <Bell className="h-3.5 w-3.5" />
                    Être informé des prochaines dates
                  </Button>
                )}

                <div className="space-y-2 pt-2 border-t">
                  {days && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      {days} jour{days > 1 ? "s" : ""}
                      {hours ? ` (${hours}h)` : ""}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    {upcoming.length > 0
                      ? `${upcoming.length} session${upcoming.length > 1 ? "s" : ""} à venir`
                      : "Aucune session planifiée"}
                  </div>
                </div>

                {upcoming.length > 0 && (
                  <div className="space-y-2 pt-2 border-t">
                    <p className="text-xs font-medium text-muted-foreground">Prochaines dates :</p>
                    {upcoming.slice(0, 3).map((s) => (
                      <button
                        key={s.id}
                        onClick={() => openEnroll(s.id)}
                        className="w-full text-left rounded-lg bg-muted/50 hover:bg-muted px-3 py-2 transition-colors"
                      >
                        <p className="text-xs font-medium">
                          {formatSessionDateRange(s.startDate, s.endDate)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {s.remote ? "En ligne" : (s.placeName ?? s.place ?? "Lieu à confirmer")}
                        </p>
                      </button>
                    ))}
                    {upcoming.length > 3 && (
                      <p className="text-[11px] text-muted-foreground text-center">
                        + {upcoming.length - 3} autre{upcoming.length - 3 > 1 ? "s" : ""} session{upcoming.length - 3 > 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <ProgramChannelLink
                programCode={program.programCode}
              />
            </div>
          </div>
        </div>
      </div>

      {program && (
        <EnrollmentDialog
          program={program}
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          initialSessionId={dialogSessionId}
        />
      )}
    </div>
  );
}
