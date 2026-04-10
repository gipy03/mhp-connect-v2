import { Award, Check, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Section } from "./shared";

export function CredentialsSection({
  credentials,
}: {
  credentials: { id: string; credentialName: string; groupName: string | null; issuedAt: string | null; expiresAt: string | null; badgeUrl: string | null; certificateUrl: string | null; url: string | null }[];
}) {
  return (
    <Section
      title="Certifications Accredible"
      description="Certifications obtenues et vérifiées via Accredible."
      icon={Award}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {credentials.map((cred) => (
          <div
            key={cred.id}
            className="rounded-lg border bg-muted/20 p-4 space-y-3"
          >
            {cred.badgeUrl && (
              <div className="flex justify-center">
                <img
                  src={cred.badgeUrl}
                  alt={cred.credentialName}
                  className="h-16 w-16 object-contain"
                />
              </div>
            )}

            <div className="space-y-0.5">
              <div className="flex items-start gap-1.5">
                <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-sm font-semibold leading-snug">
                  {cred.credentialName}
                </p>
              </div>
              {cred.groupName && (
                <p className="text-xs text-muted-foreground pl-5">
                  {cred.groupName}
                </p>
              )}
            </div>

            <div className="space-y-0.5 text-xs text-muted-foreground">
              {cred.issuedAt && (
                <p>
                  Délivré le{" "}
                  {new Date(cred.issuedAt).toLocaleDateString("fr-CH", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
              {cred.expiresAt && (
                <p>
                  Expire le{" "}
                  {new Date(cred.expiresAt).toLocaleDateString("fr-CH", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>

            {(cred.url || cred.certificateUrl) && (
              <div className="flex items-center gap-2">
                {cred.url && (
                  <a
                    href={cred.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Vérifier
                  </a>
                )}
                {cred.certificateUrl && (
                  <a
                    href={cred.certificateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Award className="h-3 w-3" />
                    Certificat
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}
