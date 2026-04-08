import { useState, useRef } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  Plus,
  Trash2,
  X,
  CheckCircle,
  Lock,
  Globe,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { type CatalogueProgram } from "@/hooks/useCatalogue";

// ---------------------------------------------------------------------------
// Tab bar
// ---------------------------------------------------------------------------

type Tab = "presentation" | "tarifs" | "acces";

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { value: Tab; label: string }[] = [
    { value: "presentation", label: "Présentation" },
    { value: "tarifs", label: "Tarifs" },
    { value: "acces", label: "Accès" },
  ];
  return (
    <div className="flex border-b gap-1 mb-6">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={
            "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px " +
            (active === t.value
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground")
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared field helpers
// ---------------------------------------------------------------------------

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm " +
  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

// ---------------------------------------------------------------------------
// Tags input
// ---------------------------------------------------------------------------

function TagsInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput("");
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add(); }
          }}
          placeholder="Ajouter un tag..."
          className={`${inputCls} flex-1`}
        />
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium bg-secondary"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(value.filter((t) => t !== tag))}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Présentation
// ---------------------------------------------------------------------------

function PresentationTab({
  program,
  code,
}: {
  program: CatalogueProgram;
  code: string;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    displayName: program.name ?? "",
    description: program.description ?? "",
    imageUrl: program.imageUrl ?? "",
    category: program.category ?? "",
    sortOrder: program.sortOrder ?? 0,
    highlightLabel: program.highlightLabel ?? "",
    published: program.published ?? false,
    tags: program.tags ?? [],
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put(`/programs/admin/${code}/override`, {
        displayName: form.displayName || null,
        description: form.description || null,
        imageUrl: form.imageUrl || null,
        category: form.category || null,
        tags: form.tags,
        sortOrder: form.sortOrder,
        highlightLabel: form.highlightLabel || null,
        published: form.published,
      }),
    onSuccess: () => {
      toast.success("Programme enregistré.");
      qc.invalidateQueries({ queryKey: ["admin", "programs"] });
      qc.invalidateQueries({ queryKey: ["programs"] });
    },
    onError: () => toast.error("Erreur lors de la sauvegarde."),
  });

  return (
    <div className="space-y-5 max-w-lg">
      <div className="space-y-1.5">
        <FieldLabel>Nom d'affichage</FieldLabel>
        <input
          type="text"
          value={form.displayName}
          onChange={(e) => set("displayName", e.target.value)}
          className={inputCls}
          placeholder={program.name ?? undefined}
        />
        <p className="text-[11px] text-muted-foreground">
          Remplace le nom DigiForma dans le catalogue.
        </p>
      </div>

      <div className="space-y-1.5">
        <FieldLabel>Description</FieldLabel>
        <Textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          className="min-h-[120px]"
          placeholder="Description visible dans le catalogue…"
        />
      </div>

      <div className="space-y-1.5">
        <FieldLabel>URL de l'image</FieldLabel>
        <input
          type="url"
          value={form.imageUrl}
          onChange={(e) => set("imageUrl", e.target.value)}
          className={inputCls}
          placeholder="https://…"
        />
        {form.imageUrl && (
          <img
            src={form.imageUrl}
            alt="preview"
            className="mt-2 h-24 w-full object-cover rounded-lg border"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <FieldLabel>Catégorie</FieldLabel>
          <input
            type="text"
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
            className={inputCls}
            placeholder="ex. Praticien OMNI"
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Ordre d'affichage</FieldLabel>
          <input
            type="number"
            value={form.sortOrder}
            onChange={(e) => set("sortOrder", parseInt(e.target.value) || 0)}
            className={inputCls}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <FieldLabel>Label highlight</FieldLabel>
        <input
          type="text"
          value={form.highlightLabel}
          onChange={(e) => set("highlightLabel", e.target.value)}
          className={inputCls}
          placeholder="Nouveau · Prochainement · Complet"
        />
      </div>

      <div className="space-y-1.5">
        <FieldLabel>Tags</FieldLabel>
        <TagsInput value={form.tags} onChange={(t) => set("tags", t)} />
      </div>

      <div className="flex items-center gap-3 rounded-lg border p-3">
        <Switch
          checked={form.published}
          onCheckedChange={(v) => set("published", v)}
        />
        <div>
          <p className="text-sm font-medium">
            {form.published ? "Publié" : "Brouillon"}
          </p>
          <p className="text-xs text-muted-foreground">
            {form.published
              ? "Visible dans le catalogue public"
              : "Non visible — sauvegarde possible"}
          </p>
        </div>
      </div>

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
      >
        {saveMutation.isPending ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Tarifs
// ---------------------------------------------------------------------------

type PricingTierForm = {
  pricingType: string;
  label: string;
  amount: string;
  unit: string;
  currency: string;
  validFrom: string;
  validUntil: string;
  active: boolean;
};

const EMPTY_TIER: PricingTierForm = {
  pricingType: "standard",
  label: "",
  amount: "",
  unit: "total",
  currency: "CHF",
  validFrom: "",
  validUntil: "",
  active: true,
};

function TarifTab({ program, code }: { program: CatalogueProgram; code: string }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newTier, setNewTier] = useState<PricingTierForm>(EMPTY_TIER);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PricingTierForm>(EMPTY_TIER);

  const createMut = useMutation({
    mutationFn: () =>
      api.post(`/programs/admin/${code}/pricing`, {
        ...newTier,
        amount: newTier.amount,
        validFrom: newTier.validFrom || null,
        validUntil: newTier.validUntil || null,
      }),
    onSuccess: () => {
      toast.success("Tarif créé.");
      setAdding(false);
      setNewTier(EMPTY_TIER);
      qc.invalidateQueries({ queryKey: ["programs", code] });
    },
    onError: () => toast.error("Erreur lors de la création."),
  });

  const updateMut = useMutation({
    mutationFn: ({ tierId }: { tierId: string }) =>
      api.patch(`/programs/admin/pricing/${tierId}`, {
        ...editForm,
        validFrom: editForm.validFrom || null,
        validUntil: editForm.validUntil || null,
      }),
    onSuccess: () => {
      toast.success("Tarif mis à jour.");
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["programs", code] });
    },
    onError: () => toast.error("Erreur lors de la mise à jour."),
  });

  const deleteMut = useMutation({
    mutationFn: (tierId: string) =>
      api.delete<void>(`/programs/admin/pricing/${tierId}`),
    onSuccess: () => {
      toast.success("Tarif supprimé.");
      qc.invalidateQueries({ queryKey: ["programs", code] });
    },
    onError: () => toast.error("Erreur lors de la suppression."),
  });

  const TierForm = ({
    form,
    onChange,
  }: {
    form: PricingTierForm;
    onChange: (f: PricingTierForm) => void;
  }) => {
    const set = <K extends keyof PricingTierForm>(k: K, v: PricingTierForm[K]) =>
      onChange({ ...form, [k]: v });
    return (
      <div className="grid grid-cols-2 gap-3 p-4 rounded-lg border bg-muted/30">
        <div>
          <FieldLabel>Type</FieldLabel>
          <select
            value={form.pricingType}
            onChange={(e) => set("pricingType", e.target.value)}
            className={inputCls}
          >
            {["standard", "retake", "earlybird", "group", "custom"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Libellé</FieldLabel>
          <input type="text" value={form.label} onChange={(e) => set("label", e.target.value)} className={inputCls} placeholder="ex. Tarif standard" />
        </div>
        <div>
          <FieldLabel>Montant</FieldLabel>
          <input type="number" value={form.amount} onChange={(e) => set("amount", e.target.value)} className={inputCls} placeholder="3900" />
        </div>
        <div>
          <FieldLabel>Unité</FieldLabel>
          <select value={form.unit} onChange={(e) => set("unit", e.target.value)} className={inputCls}>
            <option value="total">total</option>
            <option value="per_day">par jour</option>
            <option value="per_session">par session</option>
          </select>
        </div>
        <div>
          <FieldLabel>Valide du</FieldLabel>
          <input type="date" value={form.validFrom} onChange={(e) => set("validFrom", e.target.value)} className={inputCls} />
        </div>
        <div>
          <FieldLabel>Valide jusqu'au</FieldLabel>
          <input type="date" value={form.validUntil} onChange={(e) => set("validUntil", e.target.value)} className={inputCls} />
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />
          <span className="text-sm">Actif</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 max-w-xl">
      {program.pricingTiers.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">Aucun tarif configuré.</p>
      )}

      {program.pricingTiers.map((tier) => (
        <div key={tier.id} className="rounded-xl border p-4 space-y-3">
          {editingId === tier.id ? (
            <>
              <TierForm
                form={editForm}
                onChange={setEditForm}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => updateMut.mutate({ tierId: tier.id })}
                  disabled={updateMut.isPending}
                >
                  Sauvegarder
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                  Annuler
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{tier.label || tier.pricingType}</span>
                  <Badge variant="outline" className="text-[10px]">{tier.pricingType}</Badge>
                  {!tier.active && <Badge variant="secondary" className="text-[10px]">Inactif</Badge>}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {tier.currency} {tier.amount}
                  {tier.unit !== "total" ? ` / ${tier.unit === "per_day" ? "jour" : "session"}` : ""}
                </p>
                {(tier.validFrom || tier.validUntil) && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tier.validFrom ?? "∞"} → {tier.validUntil ?? "∞"}
                  </p>
                )}
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setEditingId(tier.id);
                    setEditForm({
                      pricingType: tier.pricingType,
                      label: tier.label,
                      amount: tier.amount,
                      unit: tier.unit,
                      currency: tier.currency,
                      validFrom: tier.validFrom ?? "",
                      validUntil: tier.validUntil ?? "",
                      active: tier.active,
                    });
                  }}
                >
                  Éditer
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  disabled={deleteMut.isPending}
                  onClick={() => {
                    if (window.confirm("Supprimer ce tarif ?"))
                      deleteMut.mutate(tier.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}

      {adding ? (
        <div className="space-y-3">
          <TierForm form={newTier} onChange={setNewTier} />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createMut.mutate()} disabled={createMut.isPending}>
              Créer le tarif
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setNewTier(EMPTY_TIER); }}>
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" />
          Ajouter un tarif
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Accès (feature grants)
// ---------------------------------------------------------------------------

interface FeatureGrant {
  id: string;
  programCode: string;
  featureKey: string;
  credentialRequired: boolean;
  createdAt: string | null;
}

const FEATURE_KEYS = ["community", "directory", "supervision", "offers"];
const FEATURE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  community: Globe,
  directory: Globe,
  supervision: CheckCircle,
  offers: CheckCircle,
};

function AccesTab({
  program,
  code,
}: {
  program: CatalogueProgram & { featureGrants: FeatureGrant[] };
  code: string;
}) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newGrant, setNewGrant] = useState({ featureKey: "community", credentialRequired: true });

  const createMut = useMutation({
    mutationFn: () =>
      api.post(`/programs/admin/${code}/grants`, newGrant),
    onSuccess: () => {
      toast.success("Accès ajouté.");
      setAdding(false);
      qc.invalidateQueries({ queryKey: ["programs", code] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Erreur lors de l'ajout.";
      toast.error(msg);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (grantId: string) =>
      api.delete<void>(`/programs/admin/grants/${grantId}`),
    onSuccess: () => {
      toast.success("Accès supprimé.");
      qc.invalidateQueries({ queryKey: ["programs", code] });
    },
    onError: () => toast.error("Erreur lors de la suppression."),
  });

  const grants: FeatureGrant[] = (program as typeof program & { featureGrants?: FeatureGrant[] }).featureGrants ?? [];

  return (
    <div className="space-y-4 max-w-md">
      <p className="text-sm text-muted-foreground">
        Définissez quelles fonctionnalités sont déverrouillées après inscription ou certification à ce programme.
      </p>

      {grants.length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground">Aucun accès configuré.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {grants.map((g) => {
            const Icon = FEATURE_ICONS[g.featureKey] ?? CheckCircle;
            return (
              <div
                key={g.id}
                className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium bg-secondary"
              >
                {g.credentialRequired ? (
                  <Lock className="h-3 w-3 text-amber-500" />
                ) : (
                  <Icon className="h-3 w-3 text-emerald-500" />
                )}
                <span>{g.featureKey}</span>
                <span className="text-muted-foreground ml-1">
                  {g.credentialRequired ? "(certif.)" : "(inscription)"}
                </span>
                <button
                  onClick={() => {
                    if (window.confirm("Supprimer cet accès ?"))
                      deleteMut.mutate(g.id);
                  }}
                  className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {adding ? (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Fonctionnalité</FieldLabel>
              <select
                value={newGrant.featureKey}
                onChange={(e) => setNewGrant((g) => ({ ...g, featureKey: e.target.value }))}
                className={inputCls}
              >
                {FEATURE_KEYS.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2 pb-0.5">
              <Switch
                checked={newGrant.credentialRequired}
                onCheckedChange={(v) => setNewGrant((g) => ({ ...g, credentialRequired: v }))}
              />
              <span className="text-sm">Certificat requis</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createMut.mutate()} disabled={createMut.isPending}>
              Ajouter
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" />
          Ajouter un accès
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AdminProgramEditor
// ---------------------------------------------------------------------------

export default function AdminProgramEditor() {
  const { code } = useParams({ strict: false }) as { code: string };
  const [tab, setTab] = useState<Tab>("presentation");

  const { data: program, isLoading, isError } = useQuery<CatalogueProgram>({
    queryKey: ["programs", code],
    queryFn: () => api.get<CatalogueProgram>(`/programs/${code}`),
    enabled: !!code,
    staleTime: 2 * 60_000,
  });

  return (
    <div className="max-w-2xl space-y-6 pb-12">
      <Link
        to="/user/admin/programs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Retour aux programmes
      </Link>

      {isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
          Programme introuvable ou inaccessible.
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-5 w-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
        </div>
      ) : program ? (
        <>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{program.name}</h1>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">{code}</p>
          </div>

          <TabBar active={tab} onChange={setTab} />

          {tab === "presentation" && (
            <PresentationTab program={program} code={code} />
          )}
          {tab === "tarifs" && <TarifTab program={program} code={code} />}
          {tab === "acces" && (
            <AccesTab
              program={program as CatalogueProgram & { featureGrants: FeatureGrant[] }}
              code={code}
            />
          )}
        </>
      ) : null}
    </div>
  );
}
