import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarDays,
  Users,
  MapPin,
  GraduationCap,
  Briefcase,
  User,
  Bell,
  ChevronRight,
  Calendar,
  Monitor,
  ArrowRight,
  Receipt,
  ExternalLink,
  Award,
  FileText,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  useEnrollments,
  useExtranetUrl,
  activeAssignment,
  type EnrollmentWithAssignments,
} from "@/hooks/useEnrollments";
import { useRecentNotifications } from "@/hooks/useNotifications";
import {
  usePrograms,
  formatSessionDateRange,
  upcomingSessions,
  type CatalogueProgram,
} from "@/hooks/useCatalogue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProgramInfo {
  name: string;
  imageUrl: string | null;
}

function useResolvedPrograms() {
  const { data: categories = [] } = usePrograms();
  return useMemo(() => {
    const m = new Map<string, ProgramInfo>();
    for (const cat of categories) {
      for (const prog of cat.programs) {
        m.set(prog.programCode, {
          name: prog.name,
          imageUrl: prog.imageUrl,
        });
      }
    }
    return m;
  }, [categories]);
}

function greetingText(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

function UpcomingTrainingCard({
  enrollment,
  info,
}: {
  enrollment: EnrollmentWithAssignments;
  info: ProgramInfo;
}) {
  const assigned = activeAssignment(enrollment);
  const session = assigned?.session;

  return (
    <Link
      to="/user/trainings"
      className="group flex gap-4 rounded-xl border bg-card p-4 hover:shadow-md transition-all"
    >
      {info.imageUrl ? (
        <div className="hidden sm:block w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-muted">
          <img
            src={info.imageUrl}
            alt={info.name}
            className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
          />
        </div>
      ) : (
        <div className="hidden sm:flex w-20 h-20 rounded-lg bg-muted items-center justify-center shrink-0">
          <BookOpen className="h-6 w-6 text-muted-foreground/30" />
        </div>
      )}

      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-sm font-semibold leading-tight line-clamp-1 group-hover:text-foreground transition-colors">
          {info.name}
        </p>

        {session ? (
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
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            Session à choisir
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {enrollment.bexioDocumentNr ? (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
              <Receipt className="h-3 w-3" />
              N°{enrollment.bexioDocumentNr}
            </Badge>
          ) : enrollment.status === "active" ? (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-200 dark:border-amber-800">
              Facture en attente
            </Badge>
          ) : null}
          {assigned?.participationMode && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {assigned.participationMode === "remote" ? "En ligne" : "Présentiel"}
            </Badge>
          )}
        </div>
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground/30 shrink-0 mt-2 group-hover:text-muted-foreground transition-colors" />
    </Link>
  );
}

function NextSessionHighlight({
  categories,
}: {
  categories: { category: string; programs: CatalogueProgram[] }[];
}) {
  const nextSession = useMemo(() => {
    let best: { program: CatalogueProgram; session: CatalogueProgram["sessions"][0] } | null = null;
    for (const cat of categories) {
      for (const prog of cat.programs) {
        const upcoming = upcomingSessions(prog.sessions);
        if (upcoming.length > 0) {
          const s = upcoming[0];
          if (
            !best ||
            (s.startDate && (!best.session.startDate || s.startDate < best.session.startDate))
          ) {
            best = { program: prog, session: s };
          }
        }
      }
    }
    return best;
  }, [categories]);

  if (!nextSession) return null;

  const { program, session } = nextSession;

  return (
    <Link
      to="/catalogue/$code"
      params={{ code: program.programCode }}
      className="group relative overflow-hidden rounded-xl border bg-card hover:shadow-md transition-all"
    >
      <div className="flex">
        {program.imageUrl && (
          <div className="hidden sm:block w-40 shrink-0 bg-muted">
            <img
              src={program.imageUrl}
              alt={program.name}
              className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
            />
          </div>
        )}
        <div className="flex-1 p-4 sm:p-5 space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-[10px] px-1.5 py-0">
              Prochaine formation
            </Badge>
          </div>
          <p className="text-sm font-semibold leading-tight line-clamp-1 group-hover:text-foreground">
            {program.name}
          </p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
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
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground group-hover:text-foreground transition-colors pt-1">
            Voir le programme
            <ArrowRight className="h-3 w-3" />
          </div>
        </div>
      </div>
    </Link>
  );
}

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
    title: "Mes formations",
    description: "Suivi et documents",
    href: "/user/trainings",
    icon: FileText,
    featureKey: null,
  },
  {
    title: "Agenda",
    description: "Planning des sessions",
    href: "/user/agenda",
    icon: CalendarDays,
    featureKey: null,
  },
  {
    title: "Mon profil",
    description: "Informations personnelles",
    href: "/profile",
    icon: User,
    featureKey: null,
  },
  {
    title: "Communauté",
    description: "Échangez avec les praticiens",
    href: "/user/community",
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
    href: "/user/supervision",
    icon: GraduationCap,
    featureKey: "supervision",
  },
  {
    title: "Offres",
    description: "Avantages praticiens",
    href: "/user/offers",
    icon: Briefcase,
    featureKey: "offers",
  },
];

export default function Dashboard() {
  const { user, firstName, hasFeature } = useAuth();
  const { enrollments, isLoading, isError } = useEnrollments();
  const { notifications: recentNotifications } = useRecentNotifications();
  const programMap = useResolvedPrograms();
  const { data: categories = [] } = usePrograms();
  const { data: extranetData } = useExtranetUrl();
  const extranetUrl = extranetData?.url ?? null;

  const activeEnrollments = useMemo(
    () => enrollments.filter((e) => e.status === "active"),
    [enrollments]
  );

  const visibleLinks = QUICK_LINKS.filter(
    (l) => l.featureKey === null || hasFeature(l.featureKey)
  );

  const displayName = firstName || "";
  const greeting = greetingText();

  return (
    <div className="max-w-3xl space-y-6 sm:space-y-8 pb-12">
      <div className="relative -mx-4 -mt-4 sm:-mx-6 sm:-mt-6 mb-2 overflow-hidden rounded-b-2xl sm:rounded-b-3xl">
        <img
          src="/hero-training.jpg"
          alt="Formation MHP — Hypnose Contemporaine"
          className="w-full h-48 sm:h-60 md:h-72 object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
          <p className="text-white/70 text-sm sm:text-base">{greeting}</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white mt-0.5">
            {displayName || user?.email?.split("@")[0] || ""}
          </h1>
        </div>
      </div>

      {activeEnrollments.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight">
              Mes formations en cours
            </h2>
            <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" asChild>
              <Link to="/user/trainings">
                Tout voir
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-5 w-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {activeEnrollments.slice(0, 3).map((e) => {
                const info = programMap.get(e.programCode) ?? {
                  name: e.programCode,
                  imageUrl: null,
                };
                return (
                  <UpcomingTrainingCard key={e.id} enrollment={e} info={info} />
                );
              })}
              {activeEnrollments.length > 3 && (
                <Link
                  to="/user/trainings"
                  className="block text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
                >
                  + {activeEnrollments.length - 3} autre{activeEnrollments.length - 3 > 1 ? "s" : ""} formation{activeEnrollments.length - 3 > 1 ? "s" : ""}
                </Link>
              )}
            </div>
          )}
        </section>
      )}

      {isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
          Impossible de charger vos formations. Réessayez dans un instant.
        </div>
      )}

      {activeEnrollments.length === 0 && !isLoading && !isError && (
        <section className="space-y-3">
          <NextSessionHighlight categories={categories} />

          <div className="rounded-xl border border-dashed p-8 flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">
                Aucune formation en cours
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Découvrez nos programmes et lancez-vous dans votre prochaine formation.
              </p>
            </div>
            <Button size="sm" asChild>
              <Link to="/catalogue">
                Explorer le catalogue
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Link>
            </Button>
          </div>
        </section>
      )}

      {extranetUrl && (
        <a
          href={extranetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:shadow-sm transition-shadow group"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Award className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Espace apprenant DigiForma</p>
            <p className="text-xs text-muted-foreground">
              Accédez à vos supports de cours, documents et évaluations
            </p>
          </div>
          <ExternalLink className="h-4 w-4 text-muted-foreground/40 shrink-0 group-hover:text-muted-foreground transition-colors" />
        </a>
      )}

      {recentNotifications.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold tracking-tight">
                Notifications récentes
              </h2>
            </div>
            <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" asChild>
              <Link to="/notifications">
                Voir tout
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <div className="divide-y rounded-xl border overflow-hidden bg-card">
            {recentNotifications.map((n) => {
              const merge = (n.mergeData ?? {}) as Record<string, string>;
              const title =
                merge.programName || merge.credentialName || "Notification";
              const isUnread = n.status !== "read";

              return (
                <Link
                  key={n.id}
                  to="/notifications"
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors",
                    isUnread && "bg-accent/10"
                  )}
                >
                  {isUnread && (
                    <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm truncate",
                        isUnread ? "font-medium" : "text-muted-foreground"
                      )}
                    >
                      {title}
                    </p>
                    {n.createdAt && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(n.createdAt).toLocaleDateString("fr-CH", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight">Accès rapides</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {visibleLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="flex flex-col items-center gap-2 rounded-xl border p-4 hover:bg-accent transition-colors group text-center"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted group-hover:bg-background transition-colors">
                <link.icon className="h-4.5 w-4.5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs font-medium leading-tight">{link.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight hidden sm:block">
                  {link.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
