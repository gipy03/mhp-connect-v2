import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, Calendar, ChevronRight, Clock, MapPin, Monitor, Heart } from "lucide-react";
import {
  usePrograms,
  upcomingSessions,
  formatSessionDateRange,
  type CatalogueProgram,
} from "@/hooks/useCatalogue";
import { useCatalogueFilters } from "@/hooks/useCatalogueFilters";
import { useWishlist } from "@/hooks/useWishlist";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CatalogueToolbar } from "@/components/catalogue/CatalogueToolbar";
import { FilterPanel } from "@/components/catalogue/FilterPanel";
import { ProgramRow } from "@/components/catalogue/ProgramRow";
import { EmptyState } from "@/components/catalogue/EmptyState";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
      {[1, 2, 3, 4, 5, 6].map((i) => (
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

function WishlistButton({
  isWishlisted,
  onToggle,
  isAuthenticated,
}: {
  isWishlisted: boolean;
  onToggle: () => void;
  isAuthenticated: boolean;
}) {
  if (!isAuthenticated) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors shadow-sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              aria-label="Connectez-vous pour ajouter aux favoris"
            >
              <Heart className="h-4 w-4 text-muted-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Connectez-vous pour sauvegarder vos favoris
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <button
      className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors shadow-sm"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      aria-label={isWishlisted ? "Retirer des favoris" : "Ajouter aux favoris"}
    >
      <Heart
        className={cn(
          "h-4 w-4 transition-colors",
          isWishlisted ? "fill-red-500 text-red-500" : "text-muted-foreground hover:text-red-400"
        )}
      />
    </button>
  );
}

function ProgramCard({
  program,
  isWishlisted,
  onToggleWishlist,
  isAuthenticated,
}: {
  program: CatalogueProgram;
  isWishlisted: boolean;
  onToggleWishlist: () => void;
  isAuthenticated: boolean;
}) {
  const upcoming = upcomingSessions(program.sessions);
  const nextSession = upcoming[0];
  const dfCost = program.digiforma?.costs?.[0]?.cost ?? null;
  const instructorList = program.instructors;

  return (
    <div className="group relative flex flex-col rounded-xl border bg-card hover:shadow-lg hover:-translate-y-1 transition-all duration-300 overflow-hidden">
      <WishlistButton
        isWishlisted={isWishlisted}
        onToggle={onToggleWishlist}
        isAuthenticated={isAuthenticated}
      />

      <Link
        to="/catalogue/$code"
        params={{ code: program.programCode }}
        search={{}}
        className="flex flex-col flex-1"
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

          {instructorList && instructorList.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {instructorList.slice(0, 3).map((t, i) => (
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
                {instructorList.map(t => t.name).join(", ")}
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
                        ) : (
                          <><MapPin className="h-3 w-3 text-muted-foreground/50" /> Lieu à confirmer</>
                        )
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
    </div>
  );
}

export default function Catalogue() {
  const { data: catalogue, isLoading, isError } = usePrograms();
  const { user, isAuthenticated } = useAuth();
  const { wishlist, isWishlisted, toggleWishlist } = useWishlist();
  const {
    search,
    setFilters,
    resetFilters,
    filtered,
    categories,
    allTags,
    activeFilterCount,
    view,
  } = useCatalogueFilters(catalogue ?? undefined);

  const [filtersOpen, setFiltersOpen] = useState(false);

  const displayedPrograms = search.favoris
    ? filtered.filter((p) => isWishlisted(p.programCode))
    : filtered;

  const totalCount = catalogue
    ? catalogue.reduce((sum, c) => sum + c.programs.length, 0)
    : 0;

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
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-10 space-y-6 animate-page-enter">
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

      {!isLoading && catalogue && (
        <CatalogueToolbar
          search={search}
          setFilters={setFilters}
          categories={categories}
          totalCount={totalCount}
          activeFilterCount={activeFilterCount}
          view={view}
          onOpenFilters={() => setFiltersOpen(true)}
          isAuthenticated={isAuthenticated}
        />
      )}

      <div className="flex gap-6 items-start">
        <FilterPanel
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          search={search}
          setFilters={setFilters}
          resetFilters={resetFilters}
          allTags={allTags}
          activeFilterCount={activeFilterCount}
        />

        <div className="flex-1 min-w-0">
          {isLoading && <CatalogueSkeleton />}

          {isError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-5 text-sm text-destructive">
              Impossible de charger le catalogue. Veuillez réessayer dans un
              instant.
            </div>
          )}

          {catalogue && displayedPrograms.length === 0 && (
            <EmptyState activeFilterCount={activeFilterCount} onReset={resetFilters} />
          )}

          {catalogue && displayedPrograms.length > 0 && (
            <div className="animate-fade-in">
              {view === "grid" ? (
                <div className={cn(
                  "grid grid-cols-1 sm:grid-cols-2 gap-5",
                  filtersOpen ? "lg:grid-cols-2" : "lg:grid-cols-3"
                )}>
                  {displayedPrograms.map((p) => (
                    <ProgramCard
                      key={p.programCode}
                      program={p}
                      isWishlisted={isWishlisted(p.programCode)}
                      onToggleWishlist={() => toggleWishlist(p.programCode)}
                      isAuthenticated={isAuthenticated}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {displayedPrograms.map((p) => (
                    <ProgramRow
                      key={p.programCode}
                      program={p}
                      isWishlisted={isWishlisted(p.programCode)}
                      onToggleWishlist={() => toggleWishlist(p.programCode)}
                      showWishlistButton={true}
                      onWishlistLoginPrompt={!isAuthenticated ? () => {
                        import("sonner").then(({ toast }) => toast.info("Connectez-vous pour sauvegarder vos favoris"));
                      } : undefined}
                    />
                  ))}
                </div>
              )}

              <p className="text-xs text-muted-foreground text-center pt-6">
                {displayedPrograms.length} formation{displayedPrograms.length > 1 ? "s" : ""}
                {activeFilterCount > 0 && " (filtrées)"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
