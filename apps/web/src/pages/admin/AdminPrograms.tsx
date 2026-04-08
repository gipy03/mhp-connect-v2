import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, X, Trash2, Save, AlertCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OverrideIndicator {
  programCode: string;
  published: boolean;
}

interface DigiformaAdminProgram {
  id: string;
  code: string | null;
  name: string;
  description?: string | null;
  override: OverrideIndicator | null;
}

interface PricingTier {
  id: string;
  programCode: string;
  pricingType: string;
  label: string;
  amount: string;
  unit: string;
  currency: string;
  conditions: Record<string, unknown> | null;
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;
}

interface FeatureGrant {
  id: string;
  programCode: string;
  featureKey: string;
  credentialRequired: boolean;
}

interface ProgramOverrideData {
  id: string;
  displayName: string | null;
  description: string | null;
  imageUrl: string | null;
  tags: string[] | null;
  category: string | null;
  sortOrder: number;
  highlightLabel: string | null;
  published: boolean;
}

interface ProgramDetail {
  programCode: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  tags: string[];
  category: string | null;
  sortOrder: number;
  highlightLabel: string | null;
  published: boolean;
  pricingTiers: PricingTier[];
  featureGrants: FeatureGrant[];
  override: ProgramOverrideData | null;
  digiforma: { name: string; description?: string | null } | null;
}

type TabId = "presentation" | "tarifs" | "acces";

const FEATURE_KEYS = ["community", "directory", "supervision", "offers"];
const PRICING_TYPES = ["standard", "retake", "earlybird", "group", "custom"];
const PRICING_UNITS = ["total", "per_day", "per_session"];

// ---------------------------------------------------------------------------
// AdminPrograms — shell
// ---------------------------------------------------------------------------

export default function AdminPrograms() {
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("presentation");

  const { data: programs = [], isLoading } = useQuery<DigiformaAdminProgram[]>({
    queryKey: ["admin", "digiforma-programs"],
    queryFn: () => api.get<DigiformaAdminProgram[]>("/programs/admin/digiforma"),
  });

  const handleSelect = (code: string | null) => {
    setSelectedCode(code);
    setTab("presentation");
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Programmes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gérez les overrides, tarifs et accès pour les programmes DigiForma.
        </p>
      </div>

      <div className="flex h-[calc(100vh-13rem)] gap-0 overflow-hidden rounded-xl border">
        {/* Left: program list */}
        <div className="w-72 shrink-0 border-r flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b shrink-0">
            <p className="text-xs text-muted-foreground">
              {programs.length} programme{programs.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-4 w-4 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
              </div>
            ) : (
              programs.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelect(p.code)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b hover:bg-accent transition-colors",
                    selectedCode === p.code && "bg-accent"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium leading-snug break-words min-w-0">
                      {p.name}
                    </span>
                    <span className="shrink-0">
                      {p.override ? (
                        <Badge
                          variant={p.override.published ? "success" : "secondary"}
                          className="text-[10px]"
                        >
                          {p.override.published ? "Publié" : "Brouillon"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          —
                        </Badge>
                      )}
                    </span>
                  </div>
                  {p.code && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                      {p.code}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: editor */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {selectedCode ? (
            <ProgramEditor
              code={selectedCode}
              dfName={programs.find((p) => p.code === selectedCode)?.name ?? ""}
              tab={tab}
              setTab={setTab}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Sélectionnez un programme pour l'éditer.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProgramEditor — fetches detail, tab router
// ---------------------------------------------------------------------------

function ProgramEditor({
  code,
  dfName,
  tab,
  setTab,
}: {
  code: string;
  dfName: string;
  tab: TabId;
  setTab: (t: TabId) => void;
}) {
  const { data: detail, isLoading, isError } = useQuery<ProgramDetail | null>({
    queryKey: ["admin", "program", code],
    queryFn: async () => {
      try {
        return await api.get<ProgramDetail>(`/programs/${code}`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    staleTime: 0,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-5 w-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 justify-center h-full text-sm text-destructive">
        <AlertCircle className="h-4 w-4" />
        Erreur lors du chargement.
      </div>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "presentation", label: "Présentation" },
    { id: "tarifs", label: "Tarifs" },
    { id: "acces", label: "Accès" },
  ];

  return (
    <>
      {/* Tab bar */}
      <div className="border-b flex items-center gap-0 px-4 shrink-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-3 text-sm border-b-2 -mb-px transition-colors",
              tab === t.id
                ? "border-foreground text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto py-2 pr-1">
          <p className="text-xs font-mono text-muted-foreground">{code}</p>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === "presentation" && (
          <PresentationTab code={code} dfName={dfName} detail={detail} />
        )}
        {tab === "tarifs" && (
          <TarifsTab code={code} tiers={detail?.pricingTiers ?? []} />
        )}
        {tab === "acces" && (
          <AccesTab code={code} grants={detail?.featureGrants ?? []} />
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Tab: Présentation
// ---------------------------------------------------------------------------

function PresentationTab({
  code,
  dfName,
  detail,
}: {
  code: string;
  dfName: string;
  detail: ProgramDetail | null | undefined;
}) {
  const qc = useQueryClient();
  const ov = detail?.override;

  const [displayName, setDisplayName] = useState(ov?.displayName ?? dfName);
  const [description, setDescription] = useState(ov?.description ?? "");
  const [imageUrl, setImageUrl] = useState(ov?.imageUrl ?? "");
  const [category, setCategory] = useState(ov?.category ?? "");
  const [tags, setTags] = useState<string[]>(ov?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [sortOrder, setSortOrder] = useState(String(ov?.sortOrder ?? 0));
  const [highlightLabel, setHighlightLabel] = useState(ov?.highlightLabel ?? "");
  const [published, setPublished] = useState(ov?.published ?? false);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put(`/programs/admin/${code}/override`, {
        displayName: displayName || null,
        description: description || null,
        imageUrl: imageUrl || null,
        category: category || null,
        tags,
        sortOrder: parseInt(sortOrder, 10) || 0,
        highlightLabel: highlightLabel || null,
        published,
      }),
    onSuccess: () => {
      toast.success("Override sauvegardé.");
      qc.invalidateQueries({ queryKey: ["admin", "program", code] });
      qc.invalidateQueries({ queryKey: ["admin", "digiforma-programs"] });
    },
    onError: () => toast.error("Erreur lors de la sauvegarde."),
  });

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag));

  return (
    <div className="max-w-lg space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="displayName">Nom affiché</Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={dfName}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          placeholder="Description du programme…"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="imageUrl">URL image</Label>
        <Input
          id="imageUrl"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="category">Catégorie</Label>
        <Input
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="ex. Fondamentaux, Avancé…"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Tags</Label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-xs"
            >
              {tag}
              <button onClick={() => removeTag(tag)} className="text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
            placeholder="Ajouter un tag…"
            className="flex-1"
          />
          <Button variant="outline" size="sm" onClick={addTag} type="button">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="sortOrder">Ordre d'affichage</Label>
          <Input
            id="sortOrder"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="highlightLabel">Label highlight</Label>
          <Input
            id="highlightLabel"
            value={highlightLabel}
            onChange={(e) => setHighlightLabel(e.target.value)}
            placeholder="ex. Nouveau, Complet…"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-lg border p-4">
        <Switch
          id="published"
          checked={published}
          onCheckedChange={setPublished}
        />
        <div>
          <Label htmlFor="published" className="cursor-pointer">
            Publié dans le catalogue
          </Label>
          <p className="text-xs text-muted-foreground">
            {published ? "Visible dans le catalogue public" : "Brouillon — non visible"}
          </p>
        </div>
      </div>

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="gap-2"
      >
        <Save className="h-4 w-4" />
        {saveMutation.isPending ? "Sauvegarde…" : "Sauvegarder"}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Tarifs
// ---------------------------------------------------------------------------

function TarifsTab({ code, tiers }: { code: string; tiers: PricingTier[] }) {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "program", code] });

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {tiers.length} tarif{tiers.length !== 1 ? "s" : ""}
        </p>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowNew(true)}>
          <Plus className="h-3.5 w-3.5" />
          Ajouter un tarif
        </Button>
      </div>

      {tiers.map((tier) => (
        <TierCard key={tier.id} tier={tier} onSaved={invalidate} />
      ))}

      {tiers.length === 0 && !showNew && (
        <div className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
          Aucun tarif configuré pour ce programme.
        </div>
      )}

      {showNew && (
        <NewTierForm
          code={code}
          onSaved={() => { setShowNew(false); invalidate(); }}
          onCancel={() => setShowNew(false)}
        />
      )}
    </div>
  );
}

function TierCard({ tier, onSaved }: { tier: PricingTier; onSaved: () => void }) {
  const qc = useQueryClient();
  const [label, setLabel] = useState(tier.label);
  const [amount, setAmount] = useState(tier.amount);
  const [unit, setUnit] = useState(tier.unit);
  const [pricingType, setPricingType] = useState(tier.pricingType);
  const [conditions, setConditions] = useState(
    tier.conditions ? JSON.stringify(tier.conditions, null, 2) : ""
  );
  const [validFrom, setValidFrom] = useState(tier.validFrom ?? "");
  const [validUntil, setValidUntil] = useState(tier.validUntil ?? "");
  const [active, setActive] = useState(tier.active);
  const [editing, setEditing] = useState(false);

  const updateMutation = useMutation({
    mutationFn: () => {
      let parsedConditions: Record<string, unknown> | null = null;
      if (conditions.trim()) {
        try { parsedConditions = JSON.parse(conditions); } catch { /* ignore */ }
      }
      return api.patch(`/programs/admin/pricing/${tier.id}`, {
        label,
        amount,
        unit,
        pricingType,
        conditions: parsedConditions,
        validFrom: validFrom || null,
        validUntil: validUntil || null,
        active,
      });
    },
    onSuccess: () => { toast.success("Tarif mis à jour."); setEditing(false); onSaved(); },
    onError: () => toast.error("Erreur lors de la mise à jour."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/programs/admin/pricing/${tier.id}`),
    onSuccess: () => { toast.success("Tarif supprimé."); onSaved(); },
    onError: () => toast.error("Impossible de supprimer ce tarif."),
  });

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono">{pricingType}</Badge>
          <span className="text-sm font-medium">{label}</span>
          <span className="text-sm text-muted-foreground">{tier.currency} {amount} / {unit}</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={active} onCheckedChange={setActive} disabled={!editing} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing(!editing)}
            className="text-xs"
          >
            {editing ? "Annuler" : "Modifier"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (window.confirm("Supprimer ce tarif ?")) deleteMutation.mutate();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {editing && (
        <>
          <Separator />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <select
                value={pricingType}
                onChange={(e) => setPricingType(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {PRICING_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Label</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Montant (CHF)</Label>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Unité</Label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {PRICING_UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valide du</Label>
              <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valide jusqu'au</Label>
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Conditions (JSON)</Label>
            <Textarea
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              rows={3}
              className="font-mono text-xs"
              placeholder='{ "requiresCredential": true }'
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Sauvegarde…" : "Sauvegarder"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Annuler
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function NewTierForm({
  code,
  onSaved,
  onCancel,
}: {
  code: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("total");
  const [pricingType, setPricingType] = useState("standard");
  const [active, setActive] = useState(true);

  const createMutation = useMutation({
    mutationFn: () =>
      api.post(`/programs/admin/${code}/pricing`, {
        label,
        amount,
        unit,
        pricingType,
        active,
        currency: "CHF",
      }),
    onSuccess: () => { toast.success("Tarif créé."); onSaved(); },
    onError: () => toast.error("Erreur lors de la création."),
  });

  return (
    <div className="rounded-xl border border-dashed p-4 space-y-3">
      <p className="text-sm font-medium">Nouveau tarif</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Type</Label>
          <select
            value={pricingType}
            onChange={(e) => setPricingType(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {PRICING_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Label</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} className="h-8 text-sm" placeholder="Tarif standard" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Montant (CHF)</Label>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} className="h-8 text-sm" placeholder="490.00" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Unité</Label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {PRICING_UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Switch id="newActive" checked={active} onCheckedChange={setActive} />
        <Label htmlFor="newActive" className="text-sm cursor-pointer">Actif</Label>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !label || !amount}>
          {createMutation.isPending ? "Création…" : "Créer"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Annuler</Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Accès
// ---------------------------------------------------------------------------

function AccesTab({ code, grants }: { code: string; grants: FeatureGrant[] }) {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [newFeatureKey, setNewFeatureKey] = useState(FEATURE_KEYS[0]);
  const [newCredentialRequired, setNewCredentialRequired] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "program", code] });

  const addMutation = useMutation({
    mutationFn: () =>
      api.post(`/programs/admin/${code}/grants`, {
        featureKey: newFeatureKey,
        credentialRequired: newCredentialRequired,
      }),
    onSuccess: () => {
      toast.success("Accès ajouté.");
      setShowNew(false);
      setNewFeatureKey(FEATURE_KEYS[0]);
      setNewCredentialRequired(false);
      invalidate();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        toast.error("Cet accès est déjà configuré.");
      } else {
        toast.error("Erreur lors de l'ajout.");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (grantId: string) => api.delete(`/programs/admin/grants/${grantId}`),
    onSuccess: () => { toast.success("Accès supprimé."); invalidate(); },
    onError: () => toast.error("Impossible de supprimer cet accès."),
  });

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {grants.length} accès configuré{grants.length !== 1 ? "s" : ""}
        </p>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowNew(true)}>
          <Plus className="h-3.5 w-3.5" />
          Ajouter un accès
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {grants.map((grant) => (
          <div
            key={grant.id}
            className="flex items-center gap-2 rounded-full border bg-muted px-3 py-1.5"
          >
            <span className="text-sm font-medium">{grant.featureKey}</span>
            <span className="text-xs text-muted-foreground">
              {grant.credentialRequired ? "✓ credential requis" : "inscription suffisante"}
            </span>
            <button
              onClick={() => {
                if (window.confirm(`Supprimer l'accès "${grant.featureKey}" ?`))
                  deleteMutation.mutate(grant.id);
              }}
              className="text-muted-foreground hover:text-destructive transition-colors ml-1"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {grants.length === 0 && !showNew && (
        <div className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
          Aucun accès configuré pour ce programme.
        </div>
      )}

      {showNew && (
        <div className="rounded-xl border p-4 space-y-3">
          <p className="text-sm font-medium">Nouvel accès</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Fonctionnalité</Label>
              <select
                value={newFeatureKey}
                onChange={(e) => setNewFeatureKey(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {FEATURE_KEYS.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end pb-1">
              <div className="flex items-center gap-2">
                <Switch
                  id="credentialRequired"
                  checked={newCredentialRequired}
                  onCheckedChange={setNewCredentialRequired}
                />
                <Label htmlFor="credentialRequired" className="text-sm cursor-pointer">
                  Credential requis
                </Label>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
              {addMutation.isPending ? "Ajout…" : "Ajouter"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowNew(false)}>Annuler</Button>
          </div>
        </div>
      )}
    </div>
  );
}
