import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, Calendar, ChevronRight, Tag } from "lucide-react";
import {
  usePrograms,
  cheapestTier,
  formatPrice,
  upcomingSessions,
  type CatalogueProgram,
} from "@/hooks/useCatalogue";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Greyscale image placeholder
// ---------------------------------------------------------------------------

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
        className="w-full h-full object-cover grayscale"
        loading="lazy"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Programme card
// ---------------------------------------------------------------------------

function ProgramCard({ program }: { program: CatalogueProgram }) {
  const cheapest = cheapestTier(program.pricingTiers);
  const upcoming = upcomingSessions(program.sessions);

  return (
    <Link
      to="/catalogue/$code"
      params={{ code: program.programCode }}
      className="group flex flex-col rounded-xl border bg-card hover:shadow-md transition-shadow overflow-hidden"
    >
      {/* Image */}
      <ProgramImage src={program.imageUrl} alt={program.name} />

      {/* Content */}
      <div className="flex flex-col flex-1 p-5 gap-3">
        {/* Badges row */}
        <div className="flex items-center gap-1.5 flex-wrap min-h-[22px]">
          {program.highlightLabel && (
            <Badge variant="default" className="text-[11px]">
              {program.highlightLabel}
            </Badge>
          )}
          {program.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="outline" className="text-[11px]">
              {tag}
            </Badge>
          ))}
        </div>

        {/* Name */}
        <h3 className="font-semibold text-sm leading-snug tracking-tight group-hover:text-foreground transition-colors line-clamp-2">
          {program.name}
        </h3>

        {/* Description */}
        {program.description && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 flex-1">
            {program.description}
          </p>
        )}

        {/* Footer: price + sessions */}
        <div className="flex items-center justify-between pt-2 border-t mt-auto">
          <div>
            {cheapest ? (
              <p className="text-xs font-medium text-foreground">
                dès{" "}
                <span className="font-semibold">
                  {formatPrice(cheapest.amount, cheapest.currency, cheapest.unit)}
                </span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Prix sur demande</p>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              {upcoming.length > 0
                ? `${upcoming.length} session${upcoming.length > 1 ? "s" : ""}`
                : "Aucune session"}
            </span>
          </div>
        </div>
      </div>

      {/* Hover arrow */}
      <div className="flex items-center justify-end px-5 py-2 border-t bg-muted/30">
        <span className="text-xs text-muted-foreground flex items-center gap-0.5 group-hover:text-foreground transition-colors">
          Voir le programme
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Category section
// ---------------------------------------------------------------------------

function CategorySection({
  category,
  programs,
}: {
  category: string;
  programs: CatalogueProgram[];
}) {
  return (
    <section className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold tracking-tight">{category}</h2>
        </div>
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

// ---------------------------------------------------------------------------
// Catalogue page
// ---------------------------------------------------------------------------

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
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-14">
      {/* Hero text */}
      <div className="space-y-3 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">
          Catalogue de formations
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          Découvrez les formations de l'Institut MHP — certifiantes, spécialisées
          et pratiques. Développez votre expertise en santé mentale et
          psychothérapie.
        </p>
      </div>

      {/* States */}
      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <div className="h-6 w-6 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-5 text-sm text-destructive">
          Impossible de charger le catalogue. Veuillez réessayer dans un
          instant.
        </div>
      )}

      {catalogue && catalogue.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">
            Aucun programme publié pour le moment.
          </p>
        </div>
      )}

      {/* Category groups */}
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
