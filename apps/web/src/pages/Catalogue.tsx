import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, Calendar, ChevronRight, Clock, MapPin, Monitor } from "lucide-react";
import {
  usePrograms,
  upcomingSessions,
  formatSessionDateRange,
  type CatalogueProgram,
} from "@/hooks/useCatalogue";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function formatCHF(amount: number): string {
  if (amount <= 0) return "";
  const formatted = new Intl.NumberFormat("fr-CH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  return `CHF ${formatted}.–`;
}

function ProgramImage({
  src,
  alt,
}: {
  src: string | null;
  alt: string;
}) {
  if (!src) {
    return (
      <div className="w-full h-48 bg-muted flex items-center justify-center rounded-t-xl overflow-hidden">
        <BookOpen className="h-10 w-10 text-muted-foreground/30" />
      </div>
    );
  }
  return (
    <div className="w-full h-48 overflow-hidden rounded-t-xl bg-muted">
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        loading="lazy"
      />
    </div>
  );
}

function CatalogueSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border bg-card overflow-hidden">
          <Skeleton className="w-full h-48 rounded-none" />
          <div className="p-5 space-y-3">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
            <div className="pt-2 border-t space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProgramCard({ program }: { program: CatalogueProgram }) {
  const upcoming = upcomingSessions(program.sessions);
  const nextSession = upcoming[0];
  const dfCost = program.digiforma?.costs?.[0]?.cost ?? null;
  const trainers = program.trainers;

  return (
    <Link
      to="/catalogue/$code"
      params={{ code: program.programCode }}
      className="group flex flex-col rounded-xl border bg-card hover:shadow-lg hover:-translate-y-1 transition-all duration-300 overflow-hidden"
    >
      <ProgramImage src={program.imageUrl} alt={program.name} />

      <div className="flex flex-col flex-1 p-5 gap-3">
        <div className="flex items-center gap-1.5 flex-wrap min-h-[22px]">
          {program.highlightLabel && (
            <Badge className="text-[11px] bg-primary text-primary-foreground">
              {program.highlightLabel}
            </Badge>
          )}
          {program.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="outline" className="text-[11px]">
              {tag}
            </Badge>
          ))}
        </div>

        <h3 className="font-semibold text-sm leading-snug tracking-tight group-hover:text-primary transition-colors line-clamp-2">
          {program.name}
        </h3>

        {program.description && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 flex-1">
            {program.description}
          </p>
        )}

        {trainers && trainers.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {trainers.slice(0, 3).map((t, i) => (
                t.photoUrl ? (
                  <img
                    key={i}
                    src={t.photoUrl}
                    alt={t.name}
                    className="h-6 w-6 rounded-full object-cover border-2 border-card"
                  />
                ) : (
                  <div
                    key={i}
                    className="h-6 w-6 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[9px] font-medium text-primary"
                  >
                    {t.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </div>
                )
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground truncate">
              {trainers.map(t => t.name).join(", ")}
            </span>
          </div>
        )}

        <div className="space-y-2 pt-2 border-t mt-auto">
          {dfCost != null && dfCost > 0 && (
            <p className="text-sm font-semibold text-primary">
              {formatCHF(dfCost)}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                incl. 0% TVA
              </span>
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            {(program.durationInDays ?? program.digiforma?.durationInDays) ? (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {program.durationInDays ?? program.digiforma?.durationInDays} jour{((program.durationInDays ?? program.digiforma?.durationInDays ?? 0) > 1) ? "s" : ""}
              </span>
            ) : <span />}
            {nextSession ? (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatSessionDateRange(nextSession.startDate, nextSession.endDate)}
              </span>
            ) : (
              <span className="text-muted-foreground/60">Dates à venir</span>
            )}
          </div>

          {upcoming.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t">
              {upcoming.slice(0, 2).map((s) => (
                <div key={s.id} className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">
                    {formatSessionDateRange(s.startDate, s.endDate)}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    {s.remote ? (
                      <><Monitor className="h-3 w-3" /> En ligne</>
                    ) : (
                      s.placeName || s.place ? (
                        <><MapPin className="h-3 w-3" /> {s.placeName ?? s.place}</>
                      ) : null
                    )}
                  </span>
                </div>
              ))}
              {upcoming.length > 2 && (
                <p className="text-[11px] text-muted-foreground/60">
                  + {upcoming.length - 2} autre{upcoming.length - 2 > 1 ? "s" : ""} session{upcoming.length - 2 > 1 ? "s" : ""}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between px-5 py-2.5 border-t bg-muted/30">
        <span className="text-xs font-medium text-primary flex items-center gap-0.5 group-hover:underline transition-colors">
          Voir le programme
          <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        </span>
        {upcoming.length > 0 && (
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {upcoming.length} session{upcoming.length > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </Link>
  );
}

function CategorySection({
  category,
  programs,
}: {
  category: string;
  programs: CatalogueProgram[];
}) {
  return (
    <section className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{category}</h2>
        <span className="text-sm text-muted-foreground">
          {programs.length} formation{programs.length > 1 ? "s" : ""}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {programs.map((p) => (
          <ProgramCard key={p.programCode} program={p} />
        ))}
      </div>
    </section>
  );
}

export default function Catalogue() {
  const { data: catalogue, isLoading, isError } = usePrograms();

  useEffect(() => {
    const prev = document.title;
    document.title = "Catalogue de formations — MHP Hypnose";
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    const prevDesc = meta?.getAttribute("content") ?? null;
    let created = false;
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
      created = true;
    }
    meta.setAttribute(
      "content",
      "Découvrez les formations certifiantes et spécialisations en hypnose de l'Institut MHP — OMNI Hypnose® Suisse romande."
    );
    return () => {
      document.title = prev;
      if (created) {
        meta?.remove();
      } else if (meta && prevDesc != null) {
        meta.setAttribute("content", prevDesc);
      }
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-10 space-y-10 sm:space-y-14 animate-page-enter">
      <div className="space-y-3 max-w-2xl animate-fade-in">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Catalogue de formations
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          Découvrez les formations de l'Institut MHP — certifiantes, spécialisées
          et pratiques. Développez votre expertise en santé mentale et
          psychothérapie.
        </p>
      </div>

      {isLoading && <CatalogueSkeleton />}

      {isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-5 text-sm text-destructive">
          Impossible de charger le catalogue. Veuillez réessayer dans un
          instant.
        </div>
      )}

      {catalogue && catalogue.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <BookOpen className="h-8 w-8 text-primary/40" />
          </div>
          <p className="text-muted-foreground text-sm">
            Aucun programme publié pour le moment.
          </p>
        </div>
      )}

      {catalogue &&
        catalogue.map(({ category, programs }) => (
          <CategorySection
            key={category}
            category={category}
            programs={programs}
          />
        ))}
    </div>
  );
}
