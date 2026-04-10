import { GraduationCap, CalendarDays, ExternalLink } from "lucide-react";
import { FeatureGate } from "@/components/FeatureGate";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Configure via VITE_ACUITY_URL env var — fallback to generic MHP booking URL
const ACUITY_URL =
  (import.meta.env.VITE_ACUITY_URL as string | undefined) ??
  "https://mhp-hypnose.as.me";

function SupervisionContent() {
  return (
    <div className="max-w-3xl space-y-6 animate-page-enter">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Supervision</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Réservez une séance de supervision avec un formateur MHP.
        </p>
      </div>

      {/* Info card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Séances de supervision</CardTitle>
              <CardDescription>
                Accompagnement individuel avec un formateur certifié
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CalendarDays className="h-4 w-4 shrink-0 mt-0.5 text-primary/60" />
              Disponible en visioconférence ou en présentiel
            </li>
            <li className="flex items-start gap-2">
              <CalendarDays className="h-4 w-4 shrink-0 mt-0.5 text-primary/60" />
              Choisissez le créneau qui vous convient directement en ligne
            </li>
            <li className="flex items-start gap-2">
              <CalendarDays className="h-4 w-4 shrink-0 mt-0.5 text-primary/60" />
              Confirmation automatique par e-mail avec rappel
            </li>
          </ul>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => window.open(ACUITY_URL, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Ouvrir dans un nouvel onglet
          </Button>
        </CardContent>
      </Card>

      {/* Acuity iframe */}
      <div className="rounded-xl border overflow-hidden bg-background">
        <iframe
          src={ACUITY_URL}
          title="Réservation de supervision — MHP"
          width="100%"
          height="700"
          className="block border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>

      <p className="text-[11px] text-center text-muted-foreground">
        Réservation gérée via Acuity Scheduling.{" "}
        <a
          href={ACUITY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:no-underline"
        >
          Ouvrir dans un nouvel onglet
        </a>
        .
      </p>
    </div>
  );
}

export default function Supervision() {
  return (
    <FeatureGate
      feature="supervision"
      message="La supervision est réservée aux praticiens certifiés OMNI Praticien."
    >
      <SupervisionContent />
    </FeatureGate>
  );
}
