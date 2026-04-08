import { Briefcase, Tag, Building2, Zap, ChevronRight } from "lucide-react";
import { FeatureGate } from "@/components/FeatureGate";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Placeholder offer cards — replace with CMS or API data when available
// ---------------------------------------------------------------------------

interface OfferCard {
  id: string;
  category: string;
  title: string;
  partner: string;
  description: string;
  badge?: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PLACEHOLDER_OFFERS: OfferCard[] = [
  {
    id: "1",
    category: "Logiciel",
    title: "Praticien Pro Suite",
    partner: "MHP Digital",
    description:
      "Logiciel de gestion de cabinet (agenda, facturation, dossiers clients) avec 30 % de réduction réservé aux praticiens certifiés.",
    badge: "−30 %",
    icon: Zap,
  },
  {
    id: "2",
    category: "Espace professionnel",
    title: "Cabinets à la journée",
    partner: "CoWorkMed Genève",
    description:
      "Louez un cabinet médicalisé à la journée en centre-ville de Genève. Tarif préférentiel pour les membres MHP.",
    badge: "Partenaire",
    icon: Building2,
  },
  {
    id: "3",
    category: "Matériel",
    title: "Équipement professionnel",
    partner: "TherapyShop",
    description:
      "Sièges, mobilier et accessoires de pratique avec livraison offerte et 15 % de remise sur présentation de votre certificat MHP.",
    badge: "−15 %",
    icon: Tag,
  },
];

// ---------------------------------------------------------------------------
// Single offer card
// ---------------------------------------------------------------------------

function OfferCardItem({ offer }: { offer: OfferCard }) {
  return (
    <Card className="group hover:shadow-md transition-shadow cursor-default">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
              <offer.icon className="h-4.5 w-4.5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                {offer.category}
              </p>
              <CardTitle className="text-sm mt-0.5">{offer.title}</CardTitle>
            </div>
          </div>
          {offer.badge && (
            <Badge variant="secondary" className="shrink-0 text-xs">
              {offer.badge}
            </Badge>
          )}
        </div>
        <CardDescription className="mt-1 text-xs font-medium text-primary/70">
          {offer.partner}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {offer.description}
        </p>
        <button className="flex items-center gap-1 text-xs font-medium text-foreground hover:underline">
          En savoir plus
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Offers page
// ---------------------------------------------------------------------------

function OffersContent() {
  return (
    <div className="max-w-3xl space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
          <Briefcase className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Offres &amp; avantages
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Offres et avantages réservés aux praticiens certifiés MHP
          </p>
        </div>
      </div>

      {/* Coming soon banner */}
      <div className="rounded-xl border border-dashed bg-muted/20 px-5 py-4">
        <p className="text-sm font-medium">Bientôt disponible</p>
        <p className="text-xs text-muted-foreground mt-1">
          De nouvelles offres partenaires sont en cours de négociation. Les avantages
          confirmés apparaîtront ici en priorité pour les membres certifiés.
        </p>
      </div>

      {/* Placeholder cards */}
      <div className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Exemples d'avantages à venir
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PLACEHOLDER_OFFERS.map((offer) => (
            <OfferCardItem key={offer.id} offer={offer} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Offers() {
  return (
    <FeatureGate
      feature="offers"
      message="Les offres partenaires sont réservées aux praticiens certifiés OMNI Praticien."
    >
      <OffersContent />
    </FeatureGate>
  );
}
