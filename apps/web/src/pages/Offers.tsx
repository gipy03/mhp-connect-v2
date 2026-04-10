import { useState } from "react";
import {
  Briefcase,
  Tag,
  Building2,
  Zap,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  Filter,
  Shield,
  Wrench,
  BookOpen,
  Heart,
} from "lucide-react";
import { toast } from "sonner";
import { FeatureGate } from "@/components/FeatureGate";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMemberOffers, useTrackOfferClick, type Offer } from "@/hooks/useOffers";

const CATEGORY_OPTIONS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  equipment: { label: "Matériel", icon: Tag },
  workspace: { label: "Espace professionnel", icon: Building2 },
  software: { label: "Logiciel", icon: Zap },
  services: { label: "Services", icon: Wrench },
  training: { label: "Formation", icon: BookOpen },
  insurance: { label: "Assurance", icon: Shield },
  other: { label: "Autre", icon: Heart },
};

function getCategoryInfo(cat: string | null) {
  if (!cat) return { label: "Autre", icon: Briefcase };
  return CATEGORY_OPTIONS[cat] ?? { label: cat, icon: Briefcase };
}

function OfferCardItem({ offer }: { offer: Offer }) {
  const [codeCopied, setCodeCopied] = useState(false);
  const [codeRevealed, setCodeRevealed] = useState(false);
  const trackClick = useTrackOfferClick();

  const catInfo = getCategoryInfo(offer.category);
  const Icon = catInfo.icon;

  const handleLinkClick = () => {
    trackClick.mutate(offer.id);
    if (offer.redemptionUrl) {
      window.open(offer.redemptionUrl, "_blank", "noopener");
    }
  };

  const handleCodeReveal = () => {
    trackClick.mutate(offer.id);
    setCodeRevealed(true);
  };

  const handleCopyCode = () => {
    if (offer.redemptionCode) {
      navigator.clipboard.writeText(offer.redemptionCode);
      setCodeCopied(true);
      toast.success("Code copié !");
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {offer.partnerLogoUrl ? (
              <img
                src={offer.partnerLogoUrl}
                alt={offer.partnerName}
                className="h-9 w-9 rounded-lg object-cover shrink-0"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                <Icon className="h-4.5 w-4.5 text-muted-foreground" />
              </div>
            )}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                {catInfo.label}
              </p>
              <CardTitle className="text-sm mt-0.5">{offer.title}</CardTitle>
            </div>
          </div>
          {offer.discountText && (
            <Badge variant="secondary" className="shrink-0 text-xs">
              {offer.discountText}
            </Badge>
          )}
        </div>
        <CardDescription className="mt-1 text-xs font-medium text-primary/70">
          {offer.partnerName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {offer.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {offer.description}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {offer.redemptionUrl && (
            <Button
              size="sm"
              variant="default"
              className="text-xs"
              onClick={handleLinkClick}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Accéder à l'offre
            </Button>
          )}

          {offer.redemptionCode && !codeRevealed && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={handleCodeReveal}
            >
              Révéler le code
            </Button>
          )}

          {offer.redemptionCode && codeRevealed && (
            <div className="flex items-center gap-2">
              <code className="rounded bg-muted px-2 py-1 text-xs font-mono font-semibold">
                {offer.redemptionCode}
              </code>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={handleCopyCode}
              >
                {codeCopied ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          )}
        </div>

        {offer.validUntil && (
          <p className="text-[11px] text-muted-foreground">
            Valable jusqu'au{" "}
            {new Date(offer.validUntil).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function OffersContent() {
  const { data: offers, isLoading, isError } = useMemberOffers();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-3xl">
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-8 text-center">
          <p className="text-sm font-medium text-destructive">
            Impossible de charger les offres. Veuillez réessayer.
          </p>
        </div>
      </div>
    );
  }

  const allOffers = offers ?? [];

  const categories = Array.from(
    new Set(allOffers.map((o) => o.category).filter(Boolean))
  ) as string[];

  const filtered = selectedCategory
    ? allOffers.filter((o) => o.category === selectedCategory)
    : allOffers;

  return (
    <div className="max-w-3xl space-y-6 pb-12 animate-page-enter">
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

      {categories.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Button
            size="sm"
            variant={selectedCategory === null ? "default" : "outline"}
            className="text-xs h-7"
            onClick={() => setSelectedCategory(null)}
          >
            Tout
          </Button>
          {categories.map((cat) => {
            const info = getCategoryInfo(cat);
            return (
              <Button
                key={cat}
                size="sm"
                variant={selectedCategory === cat ? "default" : "outline"}
                className="text-xs h-7"
                onClick={() => setSelectedCategory(cat)}
              >
                {info.label}
              </Button>
            );
          })}
        </div>
      )}

      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((offer) => (
            <OfferCardItem key={offer.id} offer={offer} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-muted/20 px-5 py-8 text-center">
          <Briefcase className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium">Aucune offre disponible</p>
          <p className="text-xs text-muted-foreground mt-1">
            De nouvelles offres partenaires seront bientôt disponibles.
          </p>
        </div>
      )}
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
