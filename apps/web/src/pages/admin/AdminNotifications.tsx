import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, Send, ArrowLeft, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AdminPageShell, AdminListSkeleton, AdminDetailSkeleton, AdminTableSkeleton } from "@/components/AdminPageShell";

interface NotificationTemplate {
  id: string;
  eventType: string;
  subject: string | null;
  body: string | null;
  active: boolean;
  updatedAt: string | null;
}

interface NotificationLogItem {
  id: string;
  recipientId: string;
  recipientEmail: string;
  channel: string;
  status: string;
  eventType: string | null;
  sentAt: string | null;
  retryCount: number;
  createdAt: string | null;
}

interface NotificationLogResponse {
  items: NotificationLogItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

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
    event_reminder: "Rappel d'événement",
  };
  return labels[eventType] ?? eventType;
}

type TabType = "templates" | "log";

export default function AdminNotifications() {
  const [activeTab, setActiveTab] = useState<TabType>("templates");

  return (
    <AdminPageShell
      title="Notifications"
      description="Modèles d'emails et journal des envois."
    >
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setActiveTab("templates")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "templates"
              ? "border-[hsl(82,40%,35%)] text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Modèles
        </button>
        <button
          onClick={() => setActiveTab("log")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
            activeTab === "log"
              ? "border-[hsl(82,40%,35%)] text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Journal
        </button>
      </div>

      {activeTab === "templates" ? <TemplatesTab /> : <LogTab />}
    </AdminPageShell>
  );
}

function TemplatesTab() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: templates = [], isLoading, isError } = useQuery<NotificationTemplate[]>({
    queryKey: ["admin", "notification-templates"],
    queryFn: () => api.get<NotificationTemplate[]>("/notifications/admin/templates"),
  });

  const selected = templates.find((t) => t.id === selectedId) ?? null;

  return (
    <>
      {isError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive mt-4">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Erreur lors du chargement des templates.
        </div>
      )}

      <div className="flex h-[calc(100vh-16rem)] gap-0 overflow-hidden rounded-xl border mt-4">
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
              <AdminListSkeleton rows={6} />
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
    </>
  );
}

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
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors md:hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
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

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: "success" | "destructive" | "secondary" | "outline"; label: string }> = {
    sent: { variant: "success", label: "Envoyé" },
    read: { variant: "success", label: "Lu" },
    failed: { variant: "destructive", label: "Échoué" },
    pending: { variant: "secondary", label: "En attente" },
  };
  const config = variants[status] ?? { variant: "outline" as const, label: status };
  return <Badge variant={config.variant} className="text-[10px]">{config.label}</Badge>;
}

function LogTab() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const queryParams = new URLSearchParams();
  queryParams.set("page", String(page));
  queryParams.set("limit", "50");
  if (statusFilter && statusFilter !== "all") queryParams.set("status", statusFilter);
  if (eventTypeFilter && eventTypeFilter !== "all") queryParams.set("eventType", eventTypeFilter);
  if (search) queryParams.set("search", search);

  const { data, isLoading, isError } = useQuery<NotificationLogResponse>({
    queryKey: ["admin", "notification-log", page, statusFilter, eventTypeFilter, search],
    queryFn: () => api.get<NotificationLogResponse>(`/admin/notifications/log?${queryParams.toString()}`),
  });

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="sent">Envoyé</SelectItem>
            <SelectItem value="failed">Échoué</SelectItem>
            <SelectItem value="read">Lu</SelectItem>
          </SelectContent>
        </Select>
        <Select value={eventTypeFilter} onValueChange={(v) => { setEventTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Type d'événement" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="registration_confirmation">Confirmation d'inscription</SelectItem>
            <SelectItem value="invoice_sent">Facture envoyée</SelectItem>
            <SelectItem value="session_reminder">Rappel de session</SelectItem>
            <SelectItem value="session_rescheduled">Session reprogrammée</SelectItem>
            <SelectItem value="credential_issued">Credential émis</SelectItem>
            <SelectItem value="refund_update">Mise à jour remboursement</SelectItem>
            <SelectItem value="community_mention">Mention communauté</SelectItem>
            <SelectItem value="event_reminder">Rappel d'événement</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handleSearch}>
          Rechercher
        </Button>
      </div>

      {isError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Erreur lors du chargement du journal.
        </div>
      )}

      {isLoading ? (
        <AdminTableSkeleton rows={8} cols={6} />
      ) : data ? (
        <>
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Destinataire</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Canal</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Statut</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tentatives</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        Aucune notification trouvée.
                      </td>
                    </tr>
                  ) : (
                    data.items.map((item) => (
                      <tr key={item.id} className="border-b last:border-0 hover:bg-accent/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs">{item.recipientEmail}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs">
                            {item.eventType ? eventTypeLabel(item.eventType) : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-[10px]">
                            {item.channel === "email" ? "Email" : item.channel === "internal" ? "Interne" : item.channel}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="px-4 py-3 tabular-nums text-xs text-muted-foreground">
                          {item.retryCount}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleString("fr-CH", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {data.pagination.total} notification{data.pagination.total !== 1 ? "s" : ""} —
                page {data.pagination.page}/{data.pagination.totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Précédent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= data.pagination.totalPages}
                >
                  Suivant
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
