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

  useEffect(() => {
    if (!entry) return;
    const name = fullName(entry);
    const location = [entry.city, entry.country].filter(Boolean).join(", ");
    const specStr = entry.specialties?.slice(0, 3).join(", ");

    const prevTitle = document.title;
    document.title = [name, location, "Annuaire MHP"]
      .filter(Boolean)
      .join(" — ");

    const createdEls: HTMLElement[] = [];
    const prevMeta: Record<string, string | null> = {};

    const setMeta = (attr: string, content: string) => {
      const prop = attr.startsWith("og:") ? "property" : "name";
      let el = document.querySelector(`meta[${prop}="${attr}"]`) as HTMLElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(prop, attr);
        document.head.appendChild(el);
        createdEls.push(el);
      } else {
        prevMeta[attr] = el.getAttribute("content");
      }
      el.setAttribute("content", content);
    };

    const desc = [entry.practiceName, specStr, location].filter(Boolean).join(". ");
    setMeta("description", desc);
    setMeta("og:title", `${name} — Annuaire MHP`);
    setMeta("og:description", desc);
    setMeta("og:type", "website");
    if (entry.profileImageUrl) setMeta("og:image", entry.profileImageUrl);

    const jsonLd = document.createElement("script");
    jsonLd.type = "application/ld+json";
    jsonLd.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: entry.practiceName || name,
      ...(desc && { description: desc }),
      ...(entry.profileImageUrl && { image: entry.profileImageUrl }),
      ...(entry.city && {
        address: {
          "@type": "PostalAddress",
          addressLocality: entry.city,
          ...(entry.roadAddress && { streetAddress: entry.roadAddress }),
          ...(entry.country && { addressCountry: entry.country }),
        },
      }),
      ...(entry.website && { url: entry.website }),
    });
    document.head.appendChild(jsonLd);

    return () => {
      document.title = prevTitle;
      jsonLd.remove();
      createdEls.forEach((el) => el.remove());
      for (const [attr, prev] of Object.entries(prevMeta)) {
        const prop = attr.startsWith("og:") ? "property" : "name";
        const el = document.querySelector(`meta[${prop}="${attr}"]`);
        if (el && prev != null) el.setAttribute("content", prev);
      }
    };
  }, [entry]);

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
