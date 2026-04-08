import { Globe, Phone, Mail, MapPin, Lock, ExternalLink, Award } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { type DirectoryEntry, fullName, initials } from "@/hooks/useDirectory";
import { DirectoryMap } from "./DirectoryMap";
import { Link } from "@tanstack/react-router";

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

function AvatarLarge({ entry }: { entry: DirectoryEntry }) {
  if (entry.profileImageUrl) {
    return (
      <img
        src={entry.profileImageUrl}
        alt={fullName(entry)}
        className="h-24 w-24 rounded-full object-cover border-2 shrink-0"
      />
    );
  }
  return (
    <div className="h-24 w-24 rounded-full bg-muted border-2 flex items-center justify-center shrink-0">
      <span className="text-2xl font-bold text-muted-foreground select-none">
        {initials(entry)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Credential badge card
// ---------------------------------------------------------------------------

function CredentialBadge({
  credential,
}: {
  credential: DirectoryEntry["credentials"][number];
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-3">
      {credential.badgeUrl ? (
        <img
          src={credential.badgeUrl}
          alt={credential.credentialName}
          className="h-12 w-12 rounded object-contain shrink-0"
        />
      ) : (
        <div className="h-12 w-12 rounded bg-muted flex items-center justify-center shrink-0">
          <Award className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">
          {credential.credentialName}
        </p>
        {credential.issuedAt && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Délivré le{" "}
            {new Date(credential.issuedAt).toLocaleDateString("fr-CH", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DirectoryDetail — full practitioner profile
// ---------------------------------------------------------------------------

interface DirectoryDetailProps {
  entry: DirectoryEntry;
  /** True when rendered inside MemberLayout (contact info visible if toggled) */
  isMember?: boolean;
}

export function DirectoryDetail({ entry }: DirectoryDetailProps) {
  const { isAuthenticated } = useAuth();

  const hasContact = entry.phone || entry.email || entry.roadAddress;
  const hasMap =
    entry.showOnMap && entry.latitude != null && entry.longitude != null;

  return (
    <div className="space-y-10">
      {/* ------------------------------------------------------------------ */}
      {/* Hero — avatar, name, location                                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-start gap-6">
        <AvatarLarge entry={entry} />
        <div className="min-w-0 flex-1 space-y-1.5 pt-1">
          <h1 className="text-2xl font-bold tracking-tight leading-tight">
            {fullName(entry)}
          </h1>
          {entry.practiceName && (
            <p className="text-base text-muted-foreground">
              {entry.practiceName}
            </p>
          )}
          {(entry.city || entry.country) && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span>
                {[entry.city, entry.country].filter(Boolean).join(", ")}
              </span>
            </div>
          )}
          {entry.website && (
            <a
              href={
                entry.website.startsWith("http")
                  ? entry.website
                  : `https://${entry.website}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Globe className="h-3.5 w-3.5" />
              {entry.website.replace(/^https?:\/\//, "")}
              <ExternalLink className="h-3 w-3 opacity-50" />
            </a>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Bio                                                                 */}
      {/* ------------------------------------------------------------------ */}
      {entry.bio && (
        <Section title="Présentation">
          <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">
            {entry.bio}
          </p>
        </Section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Specialties                                                         */}
      {/* ------------------------------------------------------------------ */}
      {entry.specialties && entry.specialties.length > 0 && (
        <Section title="Spécialités">
          <div className="flex flex-wrap gap-2">
            {entry.specialties.map((s) => (
              <span
                key={s}
                className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium bg-secondary text-secondary-foreground"
              >
                {s}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Credentials                                                         */}
      {/* ------------------------------------------------------------------ */}
      {entry.credentials.length > 0 && (
        <Section title="Certifications">
          <div className="grid gap-3 sm:grid-cols-2">
            {entry.credentials.map((c) => (
              <CredentialBadge key={c.credentialName} credential={c} />
            ))}
          </div>
        </Section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Contact info                                                        */}
      {/* ------------------------------------------------------------------ */}
      <Section title="Contact">
        {hasContact ? (
          <div className="space-y-2.5">
            {entry.phone && (
              <div className="flex items-center gap-2.5 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <a
                  href={`tel:${entry.phone}`}
                  className="hover:text-foreground transition-colors text-muted-foreground"
                >
                  {entry.phone}
                </a>
              </div>
            )}
            {entry.email && (
              <div className="flex items-center gap-2.5 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <a
                  href={`mailto:${entry.email}`}
                  className="hover:text-foreground transition-colors text-muted-foreground"
                >
                  {entry.email}
                </a>
              </div>
            )}
            {entry.roadAddress && (
              <div className="flex items-start gap-2.5 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span className="text-muted-foreground">
                  {entry.roadAddress}
                </span>
              </div>
            )}
          </div>
        ) : !isAuthenticated ? (
          /* Public visitor — prompt to log in */
          <div className="rounded-xl border border-dashed bg-muted/30 px-5 py-6 flex flex-col items-center gap-3 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">
                Connectez-vous pour voir les coordonnées
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Les coordonnées sont réservées aux membres.
              </p>
            </div>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground underline underline-offset-4 hover:no-underline"
            >
              Se connecter
            </Link>
          </div>
        ) : (
          /* Member — no contact info shared by this practitioner */
          <p className="text-sm text-muted-foreground">
            Ce praticien n'a pas partagé ses coordonnées.
          </p>
        )}
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* Map                                                                 */}
      {/* ------------------------------------------------------------------ */}
      {hasMap && (
        <Section title="Localisation">
          <DirectoryMap entries={[entry]} heightClass="h-64" />
        </Section>
      )}
    </div>
  );
}
