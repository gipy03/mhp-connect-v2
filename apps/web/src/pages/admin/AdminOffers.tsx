import { useState } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  BarChart3,
  Briefcase,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAdminOffers,
  useCreateOffer,
  useUpdateOffer,
  useToggleOfferPublish,
  useDeleteOffer,
  type Offer,
  type OfferFormData,
} from "@/hooks/useOffers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AdminPageShell, AdminEmptyState } from "@/components/AdminPageShell";
import { Skeleton } from "@/components/ui/skeleton";

const CATEGORY_OPTIONS = [
  { value: "equipment", label: "Matériel" },
  { value: "workspace", label: "Espace professionnel" },
  { value: "software", label: "Logiciel" },
  { value: "services", label: "Services" },
  { value: "training", label: "Formation" },
  { value: "insurance", label: "Assurance" },
  { value: "other", label: "Autre" },
];

function categoryLabel(value: string | null) {
  if (!value) return "—";
  return CATEGORY_OPTIONS.find((c) => c.value === value)?.label ?? value;
}

function OfferForm({
  open,
  onClose,
  offer,
}: {
  open: boolean;
  onClose: () => void;
  offer?: Offer;
}) {
  const isEdit = !!offer;
  const [title, setTitle] = useState(offer?.title ?? "");
  const [description, setDescription] = useState(offer?.description ?? "");
  const [partnerName, setPartnerName] = useState(offer?.partnerName ?? "");
  const [partnerLogoUrl, setPartnerLogoUrl] = useState(offer?.partnerLogoUrl ?? "");
  const [discountText, setDiscountText] = useState(offer?.discountText ?? "");
  const [category, setCategory] = useState(offer?.category ?? "");
  const [redemptionUrl, setRedemptionUrl] = useState(offer?.redemptionUrl ?? "");
  const [redemptionCode, setRedemptionCode] = useState(offer?.redemptionCode ?? "");
  const [visibility, setVisibility] = useState<"all" | "feature_gated">(
    offer?.visibility ?? "all"
  );
  const [requiredFeature, setRequiredFeature] = useState(offer?.requiredFeature ?? "");
  const [validFrom, setValidFrom] = useState(
    offer?.validFrom ? offer.validFrom.slice(0, 10) : ""
  );
  const [validUntil, setValidUntil] = useState(
    offer?.validUntil ? offer.validUntil.slice(0, 10) : ""
  );
  const [sortOrder, setSortOrder] = useState(offer?.sortOrder ?? 0);
  const [published, setPublished] = useState(offer?.published ?? false);

  const createOffer = useCreateOffer();
  const updateOffer = useUpdateOffer();

  const handleSubmit = async () => {
    if (!title.trim() || !partnerName.trim()) {
      toast.error("Le titre et le nom du partenaire sont requis.");
      return;
    }

    const data: OfferFormData = {
      title: title.trim(),
      description: description.trim() || null,
      partnerName: partnerName.trim(),
      partnerLogoUrl: partnerLogoUrl.trim() || null,
      discountText: discountText.trim() || null,
      category: category || null,
      redemptionUrl: redemptionUrl.trim() || null,
      redemptionCode: redemptionCode.trim() || null,
      visibility,
      requiredFeature: visibility === "feature_gated" ? (requiredFeature.trim() || null) : null,
      validFrom: validFrom || null,
      validUntil: validUntil || null,
      sortOrder,
      published,
    };

    try {
      if (isEdit) {
        await updateOffer.mutateAsync({ id: offer.id, ...data });
        toast.success("Offre mise à jour.");
      } else {
        await createOffer.mutateAsync(data);
        toast.success("Offre créée.");
      }
      onClose();
    } catch {
      toast.error("Erreur lors de l'enregistrement.");
    }
  };

  const isPending = createOffer.isPending || updateOffer.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier l'offre" : "Nouvelle offre"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="of-title">Titre *</Label>
            <Input
              id="of-title"
              placeholder="Titre de l'offre"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="of-partner">Partenaire *</Label>
            <Input
              id="of-partner"
              placeholder="Nom du partenaire"
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="of-logo">Logo partenaire (URL)</Label>
            <Input
              id="of-logo"
              placeholder="https://..."
              value={partnerLogoUrl}
              onChange={(e) => setPartnerLogoUrl(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="of-desc">Description</Label>
            <Textarea
              id="of-desc"
              placeholder="Description de l'offre..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="of-discount">Remise</Label>
              <Input
                id="of-discount"
                placeholder="−30 %"
                value={discountText}
                onChange={(e) => setDiscountText(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Choisir...</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="of-url">Lien de rédemption</Label>
            <Input
              id="of-url"
              placeholder="https://partenaire.com/offre"
              value={redemptionUrl}
              onChange={(e) => setRedemptionUrl(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="of-code">Code promo</Label>
            <Input
              id="of-code"
              placeholder="MHP2024"
              value={redemptionCode}
              onChange={(e) => setRedemptionCode(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="of-from">Valide du</Label>
              <Input
                id="of-from"
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="of-until">Valide jusqu'au</Label>
              <Input
                id="of-until"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Visibilité</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as "all" | "feature_gated")}
            >
              <option value="all">Tous les membres</option>
              <option value="feature_gated">Accès conditionnel</option>
            </select>
          </div>

          {visibility === "feature_gated" && (
            <div className="space-y-1.5">
              <Label htmlFor="of-feature">Feature requise</Label>
              <Input
                id="of-feature"
                placeholder="ex: directory, supervision, offers"
                value={requiredFeature}
                onChange={(e) => setRequiredFeature(e.target.value)}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="of-sort">Ordre d'affichage</Label>
              <Input
                id="of-sort"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={published}
                  onChange={(e) => setPublished(e.target.checked)}
                  className="rounded border-input"
                />
                <span className="text-sm">Publié</span>
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OfferRow({ offer }: { offer: Offer }) {
  const [editing, setEditing] = useState(false);
  const togglePublish = useToggleOfferPublish();
  const deleteOffer = useDeleteOffer();

  const handleDelete = async () => {
    if (!confirm("Supprimer cette offre ?")) return;
    try {
      await deleteOffer.mutateAsync(offer.id);
      toast.success("Offre supprimée.");
    } catch {
      toast.error("Erreur lors de la suppression.");
    }
  };

  const handleToggle = async () => {
    try {
      await togglePublish.mutateAsync(offer.id);
      toast.success(offer.published ? "Offre dépubliée." : "Offre publiée.");
    } catch {
      toast.error("Erreur lors du changement de statut.");
    }
  };

  const isExpired =
    offer.validUntil && new Date(offer.validUntil) < new Date();

  return (
    <>
      <Card className="group">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              {offer.partnerLogoUrl ? (
                <img
                  src={offer.partnerLogoUrl}
                  alt={offer.partnerName}
                  className="h-10 w-10 rounded-lg object-cover shrink-0"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0">
                  <Briefcase className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-medium truncate">{offer.title}</h3>
                  {offer.published ? (
                    <Badge variant="default" className="text-[10px]">Publié</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">Brouillon</Badge>
                  )}
                  {isExpired && (
                    <Badge variant="destructive" className="text-[10px]">Expiré</Badge>
                  )}
                  {offer.discountText && (
                    <Badge variant="outline" className="text-[10px]">{offer.discountText}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {offer.partnerName}
                  {offer.category && ` · ${categoryLabel(offer.category)}`}
                  {offer.visibility === "feature_gated" && offer.requiredFeature && (
                    <span className="ml-1 text-amber-600">
                      · {offer.requiredFeature}
                    </span>
                  )}
                </p>
                {offer.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {offer.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <BarChart3 className="h-3 w-3" />
                    {offer.clickCount} clic{offer.clickCount !== 1 ? "s" : ""}
                  </span>
                  {offer.validFrom && (
                    <span>
                      Du {new Date(offer.validFrom).toLocaleDateString("fr-FR")}
                    </span>
                  )}
                  {offer.validUntil && (
                    <span>
                      Au {new Date(offer.validUntil).toLocaleDateString("fr-FR")}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleToggle}
                disabled={togglePublish.isPending}
                title={offer.published ? "Dépublier" : "Publier"}
              >
                {offer.published ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setEditing(true)}
                title="Modifier"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={handleDelete}
                disabled={deleteOffer.isPending}
                title="Supprimer"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      {editing && (
        <OfferForm
          open={editing}
          onClose={() => setEditing(false)}
          offer={offer}
        />
      )}
    </>
  );
}

export default function AdminOffers() {
  const { data: offers, isLoading, isError } = useAdminOffers();
  const [creating, setCreating] = useState(false);

  return (
    <AdminPageShell
      title="Offres partenaires"
      description={`${offers?.length ?? 0} offre${(offers?.length ?? 0) !== 1 ? "s" : ""}`}
      actions={
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Nouvelle offre
        </Button>
      }
    >
      <div className="max-w-3xl space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><div className="flex items-start gap-3"><Skeleton className="h-10 w-10 rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-32" /><Skeleton className="h-3 w-24" /></div></div></CardContent></Card>
          ))
        ) : isError ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-8 text-center">
            <p className="text-sm font-medium text-destructive">
              Impossible de charger les offres. Veuillez réessayer.
            </p>
          </div>
        ) : offers && offers.length > 0 ? (
          offers.map((offer) => <OfferRow key={offer.id} offer={offer} />)
        ) : (
          <AdminEmptyState icon={Briefcase} title="Aucune offre créée" description="Cliquez sur « Nouvelle offre » pour commencer." />
        )}
      </div>

      {creating && (
        <OfferForm open={creating} onClose={() => setCreating(false)} />
      )}
    </AdminPageShell>
  );
}
