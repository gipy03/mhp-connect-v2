import { useEffect } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  useDirectoryEntry,
  fullName,
} from "@/hooks/useDirectory";
import { DirectoryDetail } from "@/components/directory/DirectoryDetail";

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="flex items-start gap-6">
        <div className="h-24 w-24 rounded-full bg-muted shrink-0" />
        <div className="flex-1 space-y-2.5 pt-2">
          <div className="h-6 w-1/2 rounded bg-muted" />
          <div className="h-4 w-1/3 rounded bg-muted" />
          <div className="h-3.5 w-1/4 rounded bg-muted" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-5/6 rounded bg-muted" />
        <div className="h-3 w-4/6 rounded bg-muted" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DirectoryDetailPage
// ---------------------------------------------------------------------------

export default function DirectoryDetailPage() {
  const { isAuthenticated } = useAuth();
  const { userId } = useParams({ strict: false }) as { userId: string };

  const { data: entry, isLoading, isError } = useDirectoryEntry(userId ?? "");

  // SEO for public route
  useEffect(() => {
    if (!isAuthenticated && entry) {
      const name = fullName(entry);
      const location = [entry.city, entry.country].filter(Boolean).join(", ");
      const specStr = entry.specialties?.slice(0, 3).join(", ");

      const prev = document.title;
      document.title = [name, location, "Annuaire MHP"]
        .filter(Boolean)
        .join(" — ");

      const meta = document.querySelector('meta[name="description"]');
      const prevContent = meta?.getAttribute("content") ?? "";
      meta?.setAttribute(
        "content",
        [entry.practiceName, specStr, location].filter(Boolean).join(". ")
      );

      return () => {
        document.title = prev;
        meta?.setAttribute("content", prevContent);
      };
    }
  }, [isAuthenticated, entry]);

  const backPath = isAuthenticated ? "/user/annuaire" : "/annuaire";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Back link */}
      <Link
        to={backPath as "/annuaire"}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Retour à l'annuaire
      </Link>

      {isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
          Praticien introuvable ou profil non disponible.
        </div>
      ) : isLoading || !entry ? (
        <DetailSkeleton />
      ) : (
        <DirectoryDetail entry={entry} isMember={isAuthenticated} />
      )}
    </div>
  );
}
