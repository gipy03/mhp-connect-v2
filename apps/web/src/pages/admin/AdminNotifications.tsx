import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, Send, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
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

interface NotificationTemplate {
  id: string;
  eventType: string;
  subject: string | null;
  body: string | null;
  active: boolean;
  updatedAt: string | null;
}

// ---------------------------------------------------------------------------
// Merge tags per event type
// ---------------------------------------------------------------------------

const COMMON_MERGE_TAGS = [
  { tag: "{{firstName}}", label: "Prénom" },
  { tag: "{{lastName}}", label: "Nom" },
  { tag: "{{email}}", label: "Email" },
];

const EVENT_MERGE_TAGS: Record<string, { tag: string; label: string }[]> = {
  registration_confirmation: [
    ...COMMON_MERGE_TAGS,
    { tag: "{{programName}}", label: "Nom du programme" },
    { tag: "{{programCode}}", label: "Code programme" },
    { tag: "{{sessionId}}", label: "ID session" },
    { tag: "{{enrolledAt}}", label: "Date d'inscription" },
  ],
  invoice_sent: [
    ...COMMON_MERGE_TAGS,
    { tag: "{{programName}}", label: "Nom du programme" },
    { tag: "{{documentNr}}", label: "N° de facture" },
    { tag: "{{amount}}", label: "Montant" },
  ],
  session_reminder: [
    ...COMMON_MERGE_TAGS,
    { tag: "{{programName}}", label: "Nom du programme" },
    { tag: "{{sessionId}}", label: "ID session" },
    { tag: "{{sessionDate}}", label: "Date de session" },
  ],
  session_rescheduled: [
    ...COMMON_MERGE_TAGS,
    { tag: "{{programName}}", label: "Nom du programme" },
    { tag: "{{oldSessionId}}", label: "Ancienne session" },
    { tag: "{{newSessionId}}", label: "Nouvelle session" },
  ],
  credential_issued: [
    ...COMMON_MERGE_TAGS,
    { tag: "{{credentialName}}", label: "Nom du credential" },
    { tag: "{{issuedAt}}", label: "Date d'émission" },
    { tag: "{{badgeUrl}}", label: "URL du badge" },
    { tag: "{{certificateUrl}}", label: "URL du certificat" },
  ],
  refund_update: [
    ...COMMON_MERGE_TAGS,
    { tag: "{{programName}}", label: "Nom du programme" },
    { tag: "{{refundStatus}}", label: "Statut du remboursement" },
    { tag: "{{adminNote}}", label: "Note administrative" },
  ],
  community_mention: [
    ...COMMON_MERGE_TAGS,
    { tag: "{{mentionedBy}}", label: "Mentionné par" },
    { tag: "{{channelName}}", label: "Canal" },
    { tag: "{{postUrl}}", label: "Lien vers le message" },
  ],
};

function getMergeTags(eventType: string) {
  return EVENT_MERGE_TAGS[eventType] ?? COMMON_MERGE_TAGS;
}

function eventTypeLabel(eventType: string): string {
  const labels: Record<string, string> = {
    registration_confirmation: "Confirmation d'inscription",
    invoice_sent: "Facture envoyée",
    session_reminder: "Rappel de session",
    session_rescheduled: "Session reprogrammée",
    credential_issued: "Credential émis",
    refund_update: "Mise à jour remboursement",
    community_mention: "Mention communauté",
  };
  return labels[eventType] ?? eventType;
}

// ---------------------------------------------------------------------------
// AdminNotifications
// ---------------------------------------------------------------------------

export default function AdminNotifications() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: templates = [], isLoading, isError } = useQuery<NotificationTemplate[]>({
    queryKey: ["admin", "notification-templates"],
    queryFn: () => api.get<NotificationTemplate[]>("/notifications/admin/templates"),
  });

  const selected = templates.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Modèles de notification</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Éditez les templates d'emails envoyés automatiquement.
        </p>
      </div>

      {isError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Erreur lors du chargement des templates.
        </div>
      )}

      <div className="flex h-[calc(100vh-14rem)] gap-0 overflow-hidden rounded-xl border">
        {/* Left: template list */}
        <div className={cn(
          "w-full md:w-72 shrink-0 md:border-r flex flex-col overflow-hidden",
          selectedId && "hidden md:flex"
        )}>
          <div className="px-4 py-3 border-b shrink-0">
            <p className="text-xs text-muted-foreground">
              {templates.length} template{templates.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-4 w-4 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
              </div>
            ) : (
              templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedId(template.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b hover:bg-accent transition-colors",
                    selectedId === template.id && "bg-accent"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug">
                        {eventTypeLabel(template.eventType)}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                        {template.eventType}
                      </p>
                    </div>
                    <Badge
                      variant={template.active ? "success" : "secondary"}
                      className="text-[10px] shrink-0"
                    >
                      {template.active ? "Actif" : "Inactif"}
                    </Badge>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: template editor */}
        <div className={cn(
          "flex-1 overflow-y-auto",
          !selectedId && "hidden md:flex"
        )}>
          {selectedId && selected ? (
            <TemplateEditor
              template={selected}
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Sélectionnez un template pour l'éditer.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TemplateEditor
// ---------------------------------------------------------------------------

function TemplateEditor({
  template,
  onBack,
}: {
  template: NotificationTemplate;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const [subject, setSubject] = useState(template.subject ?? "");
  const [body, setBody] = useState(template.body ?? "");
  const [active, setActive] = useState(template.active);
  const [testEmail, setTestEmail] = useState("");
  const [showTestInput, setShowTestInput] = useState(false);
  const mergeTags = getMergeTags(template.eventType);

  // Keep local state in sync when a different template is selected
  const [currentId, setCurrentId] = useState(template.id);
  if (template.id !== currentId) {
    setCurrentId(template.id);
    setSubject(template.subject ?? "");
    setBody(template.body ?? "");
    setActive(template.active);
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put(`/notifications/admin/templates/${template.id}`, {
        subject: subject || null,
        body: body || null,
        active,
      }),
    onSuccess: () => {
      toast.success("Template sauvegardé.");
      qc.invalidateQueries({ queryKey: ["admin", "notification-templates"] });
    },
    onError: () => toast.error("Erreur lors de la sauvegarde."),
  });

  const testSendMutation = useMutation({
    mutationFn: () =>
      api.post(`/notifications/admin/templates/${template.id}/test-send`, {
        recipientEmail: testEmail,
      }),
    onSuccess: () => {
      toast.success(`Email de test envoyé à ${testEmail}.`);
      setShowTestInput(false);
      setTestEmail("");
    },
    onError: () => toast.error("Erreur lors de l'envoi du test."),
  });

  const insertIntoSubject = (tag: string) => {
    setSubject((prev) => prev + tag);
  };

  const insertIntoBody = (tag: string) => {
    setBody((prev) => prev + tag);
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-2xl">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors md:hidden"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour
      </button>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">{eventTypeLabel(template.eventType)}</h2>
          <p className="text-xs font-mono text-muted-foreground">{template.eventType}</p>
        </div>
        <div className="flex items-center gap-3">
          <Switch id="active" checked={active} onCheckedChange={setActive} />
          <Label htmlFor="active" className="cursor-pointer text-sm">
            {active ? "Actif" : "Inactif"}
          </Label>
        </div>
      </div>

      <Separator />

      {/* Merge tags reference */}
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          Variables disponibles
        </p>
        <div className="flex flex-wrap gap-1.5">
          {mergeTags.map(({ tag, label }) => (
            <span
              key={tag}
              className="group relative flex items-center gap-1 rounded-md border bg-muted px-2 py-0.5 text-xs"
              title={label}
            >
              <code className="font-mono">{tag}</code>
              <span className="text-muted-foreground">— {label}</span>
              <div className="absolute top-full left-0 mt-1 hidden group-hover:flex gap-1 z-10 bg-background border rounded-md shadow-sm p-1">
                <button
                  onClick={() => insertIntoSubject(tag)}
                  className="text-[10px] px-2 py-0.5 rounded hover:bg-accent"
                >
                  Sujet
                </button>
                <button
                  onClick={() => insertIntoBody(tag)}
                  className="text-[10px] px-2 py-0.5 rounded hover:bg-accent"
                >
                  Corps
                </button>
              </div>
            </span>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Survolez une variable pour l'insérer dans le sujet ou le corps.
        </p>
      </div>

      <Separator />

      {/* Subject */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="subject">Sujet de l'email</Label>
          <div className="flex gap-1">
            {mergeTags.slice(0, 3).map(({ tag }) => (
              <button
                key={tag}
                onClick={() => insertIntoSubject(tag)}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded border hover:bg-accent transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
        <Input
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="ex. Confirmation de votre inscription — {{programName}}"
        />
      </div>

      {/* Body */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="body">Corps du message</Label>
          <div className="flex gap-1 flex-wrap justify-end">
            {mergeTags.slice(0, 4).map(({ tag }) => (
              <button
                key={tag}
                onClick={() => insertIntoBody(tag)}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded border hover:bg-accent transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
        <Textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={14}
          placeholder="Bonjour {{firstName}},&#10;&#10;Votre inscription à…"
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          HTML supporté. Utilisez les variables ci-dessus pour personnaliser le message.
        </p>
      </div>

      {template.updatedAt && (
        <p className="text-xs text-muted-foreground">
          Dernière modification :{" "}
          {new Date(template.updatedAt).toLocaleString("fr-CH", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="gap-2"
        >
          {saveMutation.isPending ? "Sauvegarde…" : "Sauvegarder le template"}
        </Button>

        {showTestInput ? (
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="email@exemple.com"
              className="h-9 w-52 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && testEmail) testSendMutation.mutate();
                if (e.key === "Escape") setShowTestInput(false);
              }}
              autoFocus
            />
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => testEmail && testSendMutation.mutate()}
              disabled={!testEmail || testSendMutation.isPending}
            >
              <Send className="h-3.5 w-3.5" />
              {testSendMutation.isPending ? "Envoi…" : "Envoyer"}
            </Button>
            <button
              onClick={() => { setShowTestInput(false); setTestEmail(""); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Annuler
            </button>
          </div>
        ) : (
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setShowTestInput(true)}
          >
            <Send className="h-4 w-4" />
            Envoyer un test
          </Button>
        )}
      </div>
    </div>
  );
}
