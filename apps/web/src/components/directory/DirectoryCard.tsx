import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { type DirectoryEntry, fullName, initials } from "@/hooks/useDirectory";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

function AvatarCircle({ entry }: { entry: DirectoryEntry }) {
  if (entry.profileImageUrl) {
    return (
      <img
        src={entry.profileImageUrl}
        alt={fullName(entry)}
        className="h-14 w-14 rounded-full object-cover border shrink-0"
      />
    );
  }
  return (
    <div className="h-14 w-14 rounded-full bg-muted border flex items-center justify-center shrink-0">
      <span className="text-base font-semibold text-muted-foreground select-none">
        {initials(entry)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DirectoryCard
// ---------------------------------------------------------------------------

export function DirectoryCard({ entry }: { entry: DirectoryEntry }) {
  const { isAuthenticated } = useAuth();

  // Choose route based on auth context. Both routes register "$userId" param.
  const to = (
    isAuthenticated ? "/user/annuaire/$userId" : "/annuaire/$userId"
  ) as "/annuaire/$userId";

  return (
    <Link
      to={to}
      params={{ userId: entry.userId }}
      className={cn(
        "block rounded-xl border bg-card p-5 transition-colors",
        "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      {/* Top row: avatar + identity */}
      <div className="flex items-start gap-4">
        <AvatarCircle entry={entry} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm leading-tight truncate">
            {fullName(entry)}
          </p>
          {entry.practiceName && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {entry.practiceName}
            </p>
          )}
          {(entry.city || entry.country) && (
            <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {[entry.city, entry.country].filter(Boolean).join(", ")}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Credential badges */}
      {entry.credentials.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {entry.credentials.map((c) =>
            c.badgeUrl ? (
              <img
                key={c.credentialName}
                src={c.badgeUrl}
                alt={c.credentialName}
                title={c.credentialName}
                className="h-7 w-7 rounded object-contain"
              />
            ) : (
              <span
                key={c.credentialName}
                className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground border"
              >
                {c.credentialName}
              </span>
            )
          )}
        </div>
      )}

      {/* Specialties */}
      {entry.specialties && entry.specialties.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {entry.specialties.slice(0, 4).map((s) => (
            <span
              key={s}
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-secondary text-secondary-foreground"
            >
              {s}
            </span>
          ))}
          {entry.specialties.length > 4 && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] text-muted-foreground">
              +{entry.specialties.length - 4}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
