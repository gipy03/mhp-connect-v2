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
  ChevronDown,
  Users,
  Accessibility,
  Award,
  Target,
  FileCheck,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useProgram,
  formatSessionDateRange,
  formatPrice,
  upcomingSessions,
  cheapestTier,
  type CalendarSession,
  type PricingTier,
  type CatalogueProgram,
} from "@/hooks/useCatalogue";
import { ENROLLMENTS_QUERY_KEY } from "@/hooks/useEnrollments";
import { useAuth } from "@/hooks/useAuth";
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

// ---------------------------------------------------------------------------
// Enrollment mutation
// ---------------------------------------------------------------------------

interface EnrollPayload {
  programCode: string;
  sessionId: string;
  pricingTierId: string;
}

interface EnrollmentResult {
  id: string;
  programCode: string;
  bexioDocumentNr: string | null;
  bexioTotal: string | null;
  enrolledAt: string;
}

function useEnroll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: EnrollPayload) =>
      api.post<EnrollmentResult>("/enrollments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ENROLLMENTS_QUERY_KEY });
    },
  });
}

// ---------------------------------------------------------------------------
// Enrollment dialog — internal state machine
// ---------------------------------------------------------------------------

type DialogStep =
  | { type: "auth_required" }
  | { type: "selecting"; sessionId: string; tierId: string }
  | { type: "success"; result: EnrollmentResult; sessionId: string }
  | { type: "error"; message: string };

interface EnrollmentDialogProps {
  program: CatalogueProgram;
  open: boolean;
  onClose: () => void;
  /** Session pre-selected when the user clicked a specific session's button */
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
  const defaultTier = cheapestTier(program.pricingTiers);

  const [step, setStep] = useState<DialogStep>(() => {
    if (!user) return { type: "auth_required" };
    return {
      type: "selecting",
      sessionId: initialSessionId ?? upcoming[0]?.id ?? "",
      tierId: defaultTier?.id ?? activeTiers[0]?.id ?? "",
    };
  });

  // Reset when dialog opens with fresh auth state
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
      return;
    }
    if (!user) {
      setStep({ type: "auth_required" });
    } else if (step.type === "auth_required") {
      setStep({
        type: "selecting",
        sessionId: initialSessionId ?? upcoming[0]?.id ?? "",
        tierId: defaultTier?.id ?? activeTiers[0]?.id ?? "",
      });
    }
  };

  const handleSubmit = async () => {
    if (step.type !== "selecting") return;
    if (!step.sessionId) {
      toast.error("Veuillez sélectionner une session.");
      return;
    }
    if (!step.tierId) {
      toast.error("Veuillez sélectionner un tarif.");
      return;
    }

    try {
      const result = await enrollMutation.mutateAsync({
        programCode: program.programCode,
        sessionId: step.sessionId,
        pricingTierId: step.tierId,
      });
      setStep({ type: "success", result, sessionId: step.sessionId });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Une erreur est survenue. Veuillez réessayer.";
      setStep({ type: "error", message: msg });
    }
  };

  // Helpers for "selecting" step
  const selectedSession =
    step.type === "selecting"
      ? program.sessions.find((s) => s.id === step.sessionId) ?? null
      : null;

  const selectedTier =
    step.type === "selecting"
      ? activeTiers.find((t) => t.id === step.tierId) ?? null
      : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        {/* ---------------------------------------------------------------- */}
        {/* Auth required                                                    */}
        {/* ---------------------------------------------------------------- */}
        {step.type === "auth_required" && (
          <>
            <DialogHeader>
              <DialogTitle>Connexion requise</DialogTitle>
              <DialogDescription>
                Vous devez être connecté pour vous inscrire à une formation.
              </DialogDescription>
            </DialogHeader>
            <div className="px-6 pb-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Créez un compte ou connectez-vous pour accéder à toutes les
                formations MHP et gérer vos inscriptions.
              </p>
              <div className="rounded-lg border p-4 bg-muted/30">
                <p className="text-sm font-medium mb-0.5">{program.name}</p>
                {defaultTier && (
                  <p className="text-xs text-muted-foreground">
                    dès {formatPrice(defaultTier.amount, defaultTier.currency, defaultTier.unit)}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={onClose}>
                Annuler
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate({ to: "/" })}
              >
                Se connecter
              </Button>
              <Button size="sm" onClick={() => navigate({ to: "/register" })}>
                Créer un compte
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Session + tier selection                                          */}
        {/* ---------------------------------------------------------------- */}
        {step.type === "selecting" && (
          <>
            <DialogHeader>
              <DialogTitle>S'inscrire</DialogTitle>
              <DialogDescription className="line-clamp-1">
                {program.name}
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 pb-2 space-y-5">
              {/* Session selector */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Session
                </p>
                {upcoming.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    Aucune session disponible pour le moment.
                    <br />
                    <span className="text-xs">
                      Contactez-nous pour être informé des prochaines dates.
                    </span>
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
                              {(s.placeName || s.place) && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  {s.remote ? (
                                    <Monitor className="h-3 w-3" />
                                  ) : (
                                    <MapPin className="h-3 w-3" />
                                  )}
                                  {s.placeName ?? s.place}
                                </p>
                              )}
                              {s.remote && !s.placeName && !s.place && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Monitor className="h-3 w-3" />
                                  En ligne
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

              {/* Pricing tier selector */}
              {activeTiers.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Tarif
                  </p>
                  <div className="space-y-2">
                    {activeTiers.map((tier) => {
                      const selected = step.tierId === tier.id;
                      const conds = tier.conditions as
                        | { requiresCredential?: boolean }
                        | null;
                      return (
                        <button
                          key={tier.id}
                          type="button"
                          onClick={() =>
                            setStep({ ...step, tierId: tier.id })
                          }
                          className={cn(
                            "w-full text-left rounded-lg border p-3 transition-colors",
                            selected
                              ? "border-foreground bg-primary/5"
                              : "hover:bg-accent"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-0.5">
                              <p className="text-sm font-medium">{tier.label}</p>
                              {conds?.requiresCredential && (
                                <p className="text-xs text-muted-foreground">
                                  Réservé aux diplômés
                                </p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-semibold">
                                {formatPrice(tier.amount, tier.currency, tier.unit)}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Summary */}
              {selectedSession && selectedTier && (
                <div className="rounded-lg bg-muted/40 border p-3 space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Récapitulatif
                  </p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {formatSessionDateRange(
                        selectedSession.startDate,
                        selectedSession.endDate
                      )}
                    </span>
                    <span className="font-semibold">
                      {formatPrice(
                        selectedTier.amount,
                        selectedTier.currency,
                        selectedTier.unit
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Une facture vous sera envoyée par email après confirmation.
                  </p>
                </div>
              )}
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
                  !step.tierId ||
                  upcoming.length === 0
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

        {/* ---------------------------------------------------------------- */}
        {/* Success                                                           */}
        {/* ---------------------------------------------------------------- */}
        {step.type === "success" && (
          <>
            <div className="px-6 pt-8 pb-4 flex flex-col items-center text-center gap-4">
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
                </p>
              </div>

              <div className="w-full rounded-lg border bg-muted/30 p-4 space-y-2 text-left">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Session</span>
                  <span className="font-medium">
                    {formatSessionDateRange(
                      program.sessions.find(
                        (s) => s.id === step.sessionId
                      )?.startDate ?? null,
                      program.sessions.find(
                        (s) => s.id === step.sessionId
                      )?.endDate ?? null
                    )}
                  </span>
                </div>
                {step.result.bexioDocumentNr && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">N° de facture</span>
                    <span className="font-medium font-mono text-xs">
                      {step.result.bexioDocumentNr}
                    </span>
                  </div>
                )}
                {step.result.bexioTotal && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Montant</span>
                    <span className="font-semibold">
                      CHF {step.result.bexioTotal}
                    </span>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Un email de confirmation vous a été envoyé.
                {step.result.bexioDocumentNr
                  ? " Votre facture sera disponible dans cet email."
                  : ""}
              </p>
            </div>

            <DialogFooter className="justify-center border-t px-6 py-4">
              <Button variant="outline" size="sm" onClick={onClose}>
                Fermer
              </Button>
              <Button
                size="sm"
                onClick={() => navigate({ to: "/dashboard" })}
              >
                Mon tableau de bord
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Error                                                             */}
        {/* ---------------------------------------------------------------- */}
        {step.type === "error" && (
          <>
            <DialogHeader>
              <DialogTitle>Erreur lors de l'inscription</DialogTitle>
            </DialogHeader>
            <div className="px-6 pb-4 space-y-4">
              <div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{step.message}</p>
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
                      tierId: defaultTier?.id ?? activeTiers[0]?.id ?? "",
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

// ---------------------------------------------------------------------------
// Session row
// ---------------------------------------------------------------------------

function SessionRow({
  session,
  onEnroll,
}: {
  session: CalendarSession;
  onEnroll: (sessionId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isPast =
    !!session.startDate && new Date(session.startDate).getTime() <= Date.now();

  const hasDaySchedule = session.dates.length > 0 && session.dates.some(
    (d) => d.startTime || d.endTime
  );

  return (
    <div
      className={cn(
        "py-4",
        isPast && "opacity-50"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <p className="text-sm font-medium">
            {formatSessionDateRange(session.startDate, session.endDate)}
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            {session.inter && (
              <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0">
                <Users className="h-3 w-3" />
                Inter-entreprises
              </Badge>
            )}
            {session.remote ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Monitor className="h-3.5 w-3.5" />
                En ligne
              </span>
            ) : (
              (session.placeName || session.place) && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {session.placeName ?? session.place}
                </span>
              )
            )}
            {session.dates.length > 0 && (
              <button
                type="button"
                onClick={() => hasDaySchedule && setExpanded(!expanded)}
                className={cn(
                  "flex items-center gap-1 text-xs text-muted-foreground",
                  hasDaySchedule && "hover:text-foreground transition-colors cursor-pointer"
                )}
              >
                <Calendar className="h-3.5 w-3.5" />
                {session.dates.length} jour{session.dates.length > 1 ? "s" : ""}
                {hasDaySchedule && (
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 transition-transform",
                      expanded && "rotate-180"
                    )}
                  />
                )}
              </button>
            )}
          </div>
        </div>
        <div className="shrink-0">
          {isPast ? (
            <Badge variant="outline" className="text-xs">
              Terminée
            </Badge>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => onEnroll(session.id)}
            >
              S'inscrire
            </Button>
          )}
        </div>
      </div>

      {expanded && hasDaySchedule && (
        <div className="mt-2 ml-1 space-y-1 border-l-2 border-muted pl-3">
          {session.dates.map((d, i) => {
            const dayDate = new Date(d.date);
            const dayLabel = new Intl.DateTimeFormat("fr-CH", {
              weekday: "short",
              day: "numeric",
              month: "short",
            }).format(dayDate);
            const timeRange = [d.startTime, d.endTime]
              .filter(Boolean)
              .join(" – ");
            return (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground/70 min-w-[5.5rem]">
                  {dayLabel}
                </span>
                {timeRange && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {timeRange}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pricing tier card
// ---------------------------------------------------------------------------

function PricingCard({
  tier,
  isStandard,
  onEnroll,
}: {
  tier: PricingTier;
  isStandard: boolean;
  onEnroll: () => void;
}) {
  const conds = tier.conditions as
    | { requiresCredential?: boolean; programCodes?: string[] }
    | null;

  return (
    <div
      className={cn(
        "rounded-xl border p-5 space-y-4",
        isStandard ? "border-foreground/20 bg-card shadow-sm" : "bg-muted/30"
      )}
    >
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold leading-snug">{tier.label}</p>
          {isStandard && (
            <Badge variant="default" className="text-[10px] shrink-0">
              Standard
            </Badge>
          )}
        </div>
        {conds?.requiresCredential && (
          <p className="text-xs text-muted-foreground">
            Réservé aux diplômés MHP
          </p>
        )}
        {tier.validFrom && (
          <p className="text-xs text-muted-foreground">
            Valable jusqu'au{" "}
            {tier.validUntil
              ? new Date(tier.validUntil).toLocaleDateString("fr-CH")
              : "—"}
          </p>
        )}
      </div>

      <p className="text-2xl font-semibold tracking-tight">
        {formatPrice(tier.amount, tier.currency, tier.unit)}
      </p>

      <Button
        size="sm"
        variant={isStandard ? "default" : "outline"}
        className="w-full text-xs"
        onClick={onEnroll}
      >
        S'inscrire à ce tarif
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Programme detail page
// ---------------------------------------------------------------------------

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

    const jsonLd = document.createElement("script");
    jsonLd.type = "application/ld+json";
    const cheapest = cheapestTier(program.pricingTiers);
    const nextSession = upcomingSessions(program.sessions)[0];
    jsonLd.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Course",
      name: program.name,
      description: description,
      provider: {
        "@type": "Organization",
        name: "MHP Hypnose / OMNI Hypnose® Suisse romande",
      },
      ...(program.imageUrl && { image: program.imageUrl }),
      ...(cheapest && {
        offers: {
          "@type": "Offer",
          price: cheapest.amount,
          priceCurrency: cheapest.currency || "CHF",
        },
      }),
      ...(nextSession?.startDate && {
        hasCourseInstance: {
          "@type": "CourseInstance",
          courseMode: nextSession.remote ? "online" : "onsite",
          startDate: nextSession.startDate,
          ...(nextSession.endDate && { endDate: nextSession.endDate }),
          ...(nextSession.place && {
            location: {
              "@type": "Place",
              name: nextSession.placeName || nextSession.place,
              address: nextSession.place,
            },
          }),
        },
      }),
    });
    document.head.appendChild(jsonLd);

    return () => {
      document.title = prevTitle;
      jsonLd.remove();
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
      <div className="flex items-center justify-center py-32">
        <div className="h-6 w-6 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
      </div>
    );
  }

  if (isError || !program) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center space-y-4">
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
  const allSorted = [...program.sessions].sort((a, b) => {
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });
  const activeTiers = program.pricingTiers.filter((t) => t.active);
  const df = program.digiforma;

  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                             */}
      {/* ---------------------------------------------------------------- */}
      <div className="relative">
        {program.imageUrl ? (
          <div className="h-64 sm:h-80 overflow-hidden">
            <img
              src={program.imageUrl}
              alt={program.name}
              className="w-full h-full object-cover grayscale"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          </div>
        ) : (
          <div className="h-32 sm:h-48 bg-muted" />
        )}

        {/* Breadcrumb + title overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-6 mx-auto max-w-6xl">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
            <Link to="/catalogue" className="hover:text-foreground transition-colors">
              Catalogue
            </Link>
            <ChevronLeft className="h-3 w-3 rotate-180" />
            <span className="text-foreground truncate">{program.name}</span>
          </nav>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                {program.category && (
                  <Badge variant="secondary" className="text-xs">
                    {program.category}
                  </Badge>
                )}
                {program.highlightLabel && (
                  <Badge variant="default" className="text-xs">
                    {program.highlightLabel}
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight max-w-2xl">
                {program.name}
              </h1>
              {df?.subtitle && (
                <p className="text-sm text-muted-foreground max-w-2xl">
                  {df.subtitle}
                </p>
              )}
            </div>
            {/* Quick stats */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground pb-0.5">
              {(df?.durationInDays ?? program.durationInDays) && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {df?.durationInDays ?? program.durationInDays} jour
                  {(df?.durationInDays ?? program.durationInDays ?? 0) > 1 ? "s" : ""}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {upcoming.length} session{upcoming.length !== 1 ? "s" : ""} à venir
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Body                                                             */}
      {/* ---------------------------------------------------------------- */}
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* ============================================================ */}
          {/* Left column (2/3)                                            */}
          {/* ============================================================ */}
          <div className="lg:col-span-2 space-y-10">
            {/* Description */}
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

            {/* Tags */}
            {program.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {program.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Goals */}
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

            {/* Programme structure / steps */}
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

            {/* Assessments */}
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

            {/* Modalities info */}
            {(df?.trainingModality || df?.admissionModality || df?.certificationModality || df?.handicappedAccessibility || df?.graduationModality || df?.graduationTarget || df?.certificationDetails) && (
              <section className="space-y-3">
                <h2 className="text-base font-semibold tracking-tight">
                  Modalités
                </h2>
                <dl className="space-y-3">
                  {df.trainingModality && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                        Format
                      </dt>
                      <dd className="text-sm">{df.trainingModality}</dd>
                    </div>
                  )}
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
                  {df.certificationDetails && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                        Détails de certification
                      </dt>
                      <dd className="text-sm whitespace-pre-line">{df.certificationDetails}</dd>
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

            {/* Satisfaction */}
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

            <Separator />

            {/* Sessions section */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold tracking-tight">
                  Sessions disponibles
                </h2>
                {upcoming.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {upcoming.length} à venir
                  </span>
                )}
              </div>

              {allSorted.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center space-y-2">
                  <Calendar className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    Aucune session planifiée pour le moment.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Contactez-nous pour être informé des prochaines dates.
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {allSorted.map((s) => (
                    <SessionRow
                      key={s.id}
                      session={s}
                      onEnroll={(sid) => openEnroll(sid)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* ============================================================ */}
          {/* Right column — sticky pricing sidebar                        */}
          {/* ============================================================ */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 space-y-4">
              {/* CTA card */}
              <div className="rounded-xl border bg-card p-5 space-y-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                    Tarifs
                  </p>
                  {cheapestTier(program.pricingTiers) ? (
                    <p className="text-xl font-semibold">
                      dès{" "}
                      {(() => {
                        const t = cheapestTier(program.pricingTiers)!;
                        return formatPrice(t.amount, t.currency, t.unit);
                      })()}
                    </p>
                  ) : df?.costs && df.costs.length > 0 && df.costs[0]!.cost > 0 ? (
                    <p className="text-xl font-semibold">
                      {formatPrice(String(df.costs[0]!.cost), "CHF", "total")}
                    </p>
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
                  <p className="text-xs text-center text-muted-foreground">
                    Contactez-nous pour les prochaines dates.
                  </p>
                )}

                {/* Quick info */}
                <div className="space-y-2 pt-2 border-t">
                  {(df?.durationInDays ?? program.durationInDays) && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      {df?.durationInDays ?? program.durationInDays} jour
                      {(df?.durationInDays ?? program.durationInDays ?? 0) > 1 ? "s" : ""}
                      {df?.durationInHours
                        ? ` (${df.durationInHours}h)`
                        : ""}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    {upcoming.length > 0
                      ? `${upcoming.length} session${upcoming.length > 1 ? "s" : ""} à venir`
                      : "Aucune session planifiée"}
                  </div>
                </div>
              </div>

              {/* Pricing tiers grid */}
              {activeTiers.length > 1 && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
                    Tous les tarifs
                  </p>
                  {activeTiers.map((tier) => (
                    <PricingCard
                      key={tier.id}
                      tier={tier}
                      isStandard={tier.pricingType === "standard"}
                      onEnroll={() => openEnroll()}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Enrollment dialog                                                */}
      {/* ---------------------------------------------------------------- */}
      {program && (
        <EnrollmentDialog
          program={program}
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          initialSessionId={dialogSessionId}
        />
      )}
    </>
  );
}
