import { Link } from "@tanstack/react-router";
import { Calendar, Clock, MapPin, Monitor, ChevronRight, Heart, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  upcomingSessions,
  formatSessionDateRange,
  type CatalogueProgram,
} from "@/hooks/useCatalogue";

function formatCHF(amount: number): string {
  if (amount <= 0) return "";
  const formatted = new Intl.NumberFormat("fr-CH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `CHF ${formatted}`;
}

interface ProgramRowProps {
  program: CatalogueProgram;
  isWishlisted: boolean;
  onToggleWishlist: () => void;
  showWishlistButton: boolean;
  onWishlistLoginPrompt?: () => void;
}

export function ProgramRow({
  program,
  isWishlisted,
  onToggleWishlist,
  showWishlistButton,
  onWishlistLoginPrompt,
}: ProgramRowProps) {
  const upcoming = upcomingSessions(program.sessions);
  const nextSession = upcoming[0];
  const dfCost = program.digiforma?.costs?.[0]?.cost ?? null;
  const duration = program.durationInDays ?? program.digiforma?.durationInDays;

  const location = nextSession
    ? nextSession.remote
      ? "En ligne"
      : nextSession.placeName ?? nextSession.place ?? "Lieu à confirmer"
    : null;

  return (
    <div className="group flex items-center gap-4 rounded-xl border bg-card p-3 hover:shadow-md transition-all duration-200">
      <Link
        to="/catalogue/$code"
        params={{ code: program.programCode }}
        search={{}}
        className="shrink-0 w-20 h-16 rounded-lg overflow-hidden bg-muted"
      >
        {program.imageUrl ? (
          <img
            src={program.imageUrl}
            alt={program.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-muted-foreground/30" />
          </div>
        )}
      </Link>

      <Link
        to="/catalogue/$code"
        params={{ code: program.programCode }}
        search={{}}
        className="flex-1 min-w-0 space-y-1"
      >
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
            {program.name}
          </h3>
          {program.highlightLabel && (
            <Badge className="text-[10px] bg-primary text-primary-foreground shrink-0">
              {program.highlightLabel}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          {dfCost != null && dfCost > 0 && (
            <span className="font-semibold text-primary">{formatCHF(dfCost)}</span>
          )}

          {duration && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {duration} jour{duration > 1 ? "s" : ""}
            </span>
          )}

          {nextSession ? (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatSessionDateRange(nextSession.startDate, nextSession.endDate)}
            </span>
          ) : (
            <span className="text-muted-foreground/60">Dates à venir</span>
          )}

          {location && (
            <span className="flex items-center gap-1">
              {nextSession?.remote ? (
                <Monitor className="h-3 w-3" />
              ) : (
                <MapPin className="h-3 w-3" />
              )}
              {location}
            </span>
          )}
        </div>
      </Link>

      <div className="flex items-center gap-2 shrink-0">
        {showWishlistButton && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onWishlistLoginPrompt) {
                onWishlistLoginPrompt();
              } else {
                onToggleWishlist();
              }
            }}
            className="p-1.5 rounded-full hover:bg-muted transition-colors"
            aria-label={isWishlisted ? "Retirer des favoris" : "Ajouter aux favoris"}
          >
            <Heart
              className={cn(
                "h-4 w-4 transition-colors",
                isWishlisted ? "fill-red-500 text-red-500" : "text-muted-foreground"
              )}
            />
          </button>
        )}
        {upcoming.length > 0 && (
          <Button asChild size="sm" className="h-7 text-xs">
            <Link
              to="/catalogue/$code"
              params={{ code: program.programCode }}
              search={{ enroll: "true" }}
            >
              S'inscrire
            </Link>
          </Button>
        )}
        <Link
          to="/catalogue/$code"
          params={{ code: program.programCode }}
          search={{}}
          className="text-xs font-medium text-muted-foreground flex items-center gap-0.5 hover:underline"
        >
          Voir
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
