import { Users, ExternalLink, MessageSquare } from "lucide-react";
import { FeatureGate } from "@/components/FeatureGate";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Configure via VITE_CIRCLE_URL env var — fallback to static URL
const CIRCLE_URL =
  (import.meta.env.VITE_CIRCLE_URL as string | undefined) ??
  "https://app.circle.so";

function CommunityContent() {
  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Communauté</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Échangez avec les autres praticiens certifiés MHP.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Espace communautaire</CardTitle>
              <CardDescription>
                Discussions, ressources et entraide entre praticiens
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <MessageSquare className="h-4 w-4 shrink-0 mt-0.5 text-primary/60" />
              Espaces de discussion par thématique
            </li>
            <li className="flex items-start gap-2">
              <MessageSquare className="h-4 w-4 shrink-0 mt-0.5 text-primary/60" />
              Partage de ressources et cas cliniques
            </li>
            <li className="flex items-start gap-2">
              <MessageSquare className="h-4 w-4 shrink-0 mt-0.5 text-primary/60" />
              Événements et webinaires réservés aux membres
            </li>
          </ul>

          <Button
            className="w-full gap-2"
            onClick={() => window.open(CIRCLE_URL, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="h-4 w-4" />
            Accéder à la communauté
          </Button>

          <p className="text-[11px] text-muted-foreground text-center">
            Vous serez redirigé vers la plateforme Circle, connecté automatiquement.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Community() {
  return (
    <FeatureGate
      feature="community"
      message="L'espace communautaire est réservé aux praticiens ayant complété une formation MHP."
    >
      <CommunityContent />
    </FeatureGate>
  );
}
