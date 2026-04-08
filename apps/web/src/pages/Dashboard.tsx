import { Link, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarDays,
  Users,
  MapPin,
  GraduationCap,
  Briefcase,
  User,
  AlertCircle,
  ClipboardList,
  RefreshCw,
  XCircle,
  PlusCircle,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  useEnrollments,
  activeAssignment,
  invoiceLabel,
  type EnrollmentWithAssignments,
} from "@/hooks/useEnrollments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Enrollment status badge
// ---------------------------------------------------------------------------

function EnrollmentStatusBadge({
  status,
}: {
  status: EnrollmentWithAssignments["status"];
}) {
  const map: Record<
    string,
    { label: string; variant: "secondary" | "success" | "destructive" | "outline" }
  > = {
    active: { label: "Actif", variant: "secondary" },
    completed: { label: "Complété", variant: "success" },
    refunded: { label: "Remboursé", variant: "destructive" },
  };
  const config = map[status] ?? { label: status, variant: "outline" };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// ---------------------------------------------------------------------------
// Single enrollment card
// ---------------------------------------------------------------------------

function EnrollmentCard({
  enrollment,
}: {
  enrollment: EnrollmentWithAssignments;
}) {
  const navigate = useNavigate();
  const { cancelSession } = useEnrollments();
  const assigned = activeAssignment(enrollment);
  const { label: invoiceText, variant: invoiceVariant } =
    invoiceLabel(enrollment);

  const handleCancelSession = async () => {
    if (
      !window.confirm(
        "Confirmez-vous l'annulation de votre session ? Cette action est irréversible."
      )
    )
      return;
    try {
      await cancelSession.mutateAsync(enrollment.id);
      toast.success("Session annulée avec succès.");
    } catch {
      toast.error("Impossible d'annuler la session. Réessayez.");
    }
  };

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      {/* Top row: program code + status badges */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-foreground">
            {enrollment.programCode}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Inscrit le{" "}
            {new Date(enrollment.enrolledAt).toLocaleDateString("fr-CH", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <EnrollmentStatusBadge status={enrollment.status} />
          <Badge variant={invoiceVariant}>{invoiceText}</Badge>
          {enrollment.bexioDocumentNr && (
            <span className="text-xs text-muted-foreground">
              N° {enrollment.bexioDocumentNr}
            </span>
          )}
          {enrollment.bexioTotal && (
            <span className="text-xs font-medium">
              CHF {enrollment.bexioTotal}
            </span>
          )}
        </div>
      </div>

      <Separator />

      {/* Session info */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Session
        </p>
        {assigned ? (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
            <p className="text-sm text-foreground">
              Session assignée
              <span className="ml-2 text-xs text-muted-foreground font-mono">
                #{assigned.sessionId}
              </span>
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Aucune session assignée — choisissez une date dans le catalogue.
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
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
                onClick={handleCancelSession}
              >
                <XCircle className="h-3.5 w-3.5" />
                Annuler la session
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => navigate({ to: "/catalogue" })}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Choisir une session
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick links
// ---------------------------------------------------------------------------

interface QuickLink {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  featureKey: string | null;
}

const QUICK_LINKS: QuickLink[] = [
  {
    title: "Catalogue",
    description: "Parcourez nos formations",
    href: "/catalogue",
    icon: BookOpen,
    featureKey: null,
  },
  {
    title: "Mon profil",
    description: "Gérez vos informations",
    href: "/profile",
    icon: User,
    featureKey: null,
  },
  {
    title: "Calendrier",
    description: "Vos sessions à venir",
    href: "/calendar",
    icon: CalendarDays,
    featureKey: null,
  },
  {
    title: "Communauté",
    description: "Échangez avec les praticiens",
    href: "/community",
    icon: Users,
    featureKey: "community",
  },
  {
    title: "Annuaire",
    description: "Trouvez un praticien",
    href: "/user/annuaire",
    icon: MapPin,
    featureKey: "directory",
  },
  {
    title: "Supervision",
    description: "Réservez une supervision",
    href: "/supervision",
    icon: GraduationCap,
    featureKey: "supervision",
  },
  {
    title: "Offres",
    description: "Opportunités professionnelles",
    href: "/offers",
    icon: Briefcase,
    featureKey: "offers",
  },
];

function QuickLinkCard({ link }: { link: QuickLink }) {
  return (
    <Link
      to={link.href}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4",
        "hover:bg-accent transition-colors group"
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted group-hover:bg-background transition-colors">
        <link.icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-snug">{link.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {link.description}
        </p>
      </div>
      <ExternalLink className="h-3 w-3 text-muted-foreground/40 shrink-0 mt-1 group-hover:text-muted-foreground/70 transition-colors" />
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const { user, hasFeature } = useAuth();
  const { enrollments, isLoading, isError } = useEnrollments();

  // Active enrollments with an assigned session — shown in the reminder banner
  const enrollmentsWithSession = enrollments.filter(
    (e) => e.status === "active" && activeAssignment(e)
  );

  // Unlocked quick links only
  const visibleLinks = QUICK_LINKS.filter(
    (l) => l.featureKey === null || hasFeature(l.featureKey)
  );

  return (
    <div className="max-w-3xl space-y-8 pb-12">
      {/* ---------------------------------------------------------------- */}
      {/* Welcome                                                          */}
      {/* ---------------------------------------------------------------- */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Tableau de bord
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bienvenue{user ? ` — ${user.email}` : ""}.
        </p>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Upcoming session reminder                                        */}
      {/* Shown when at least one active enrollment has an assigned        */}
      {/* session. (Date-based filtering requires DigiForma session fetch) */}
      {/* ---------------------------------------------------------------- */}
      {enrollmentsWithSession.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 px-5 py-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                {enrollmentsWithSession.length === 1
                  ? "Vous avez une session assignée"
                  : `Vous avez ${enrollmentsWithSession.length} sessions assignées`}
              </p>
              <ul className="mt-1 space-y-0.5">
                {enrollmentsWithSession.map((e) => (
                  <li
                    key={e.id}
                    className="text-xs text-amber-800 dark:text-amber-300"
                  >
                    {e.programCode}
                    <span className="ml-2 font-mono opacity-70">
                      #{activeAssignment(e)?.sessionId}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* My enrollments                                                   */}
      {/* ---------------------------------------------------------------- */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold tracking-tight">
            Mes inscriptions
          </h2>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
            Impossible de charger vos inscriptions. Réessayez dans un instant.
          </div>
        ) : enrollments.length === 0 ? (
          /* Empty state */
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <BookOpen className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  Vous n'avez pas encore d'inscription
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Découvrez nos formations et inscrivez-vous.
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/catalogue">
                  <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                  Voir le catalogue
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {enrollments.map((enrollment) => (
              <EnrollmentCard key={enrollment.id} enrollment={enrollment} />
            ))}
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Quick links                                                      */}
      {/* ---------------------------------------------------------------- */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            Accès rapides
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Fonctionnalités disponibles dans votre espace
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visibleLinks.map((link) => (
            <QuickLinkCard key={link.href} link={link} />
          ))}
        </div>
      </section>
    </div>
  );
}
