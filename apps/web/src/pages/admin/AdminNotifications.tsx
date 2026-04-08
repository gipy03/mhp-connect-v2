import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Tag } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

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
// Merge tag definitions per event type
// ---------------------------------------------------------------------------

const MERGE_TAGS: Record<string, string[]> = {
  registration_confirmation: ["firstName", "lastName", "programName", "programCode"],
  invoice_sent: ["firstName", "lastName", "programName", "amount", "documentNr"],
  session_reminder: ["firstName", "programName", "sessionDate", "location"],
  session_rescheduled: ["firstName", "programName", "oldSession", "newSession"],
  credential_issued: ["firstName", "lastName", "credentialName", "certificateUrl"],
  refund_update: ["firstName", "programName", "status", "adminNote"],
  community_mention: ["firstName", "communityPostUrl"],
};

const EVENT_LABELS: Record<string, string> = {
  registration_confirmation: "Confirmation d'inscription",
  invoice_sent: "Facture envoyée",
  session_reminder: "Rappel de session",
  session_rescheduled: "Session reprogrammée",
  credential_issued: "Certification délivrée",
  refund_update: "Mise à jour remboursement",
  community_mention: "Mention communauté",
};

// ---------------------------------------------------------------------------
// Merge tag button row
// ---------------------------------------------------------------------------

function MergeTagBar({
  tags,
  onInsert,
}: {
  tags: string[];
  onInsert: (tag: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 py-1">
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => onInsert(`{{${tag}}}`)}
          className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-mono font-medium bg-muted hover:bg-accent transition-colors"
        >
          <Tag className="h-2.5 w-2.5" />
          {`{{${tag}}}`}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single template editor
// ---------------------------------------------------------------------------

function TemplateEditor({ template }: { template: NotificationTemplate }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(template.subject ?? "");
  const [body, setBody] = useState(template.body ?? "");
  const [active, setActive] = useState(template.active);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const mergeTags = MERGE_TAGS[template.eventType] ?? [];

  const insertAt = (
    ref: React.RefObject<HTMLInputElement | HTMLTextAreaElement>,
    setter: (v: string) => void,
    current: string,
    text: string
  ) => {
    const el = ref.current;
    if (!el) {
      setter(current + text);
      return;
    }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const next = current.slice(0, start) + text + current.slice(end);
    setter(next);
    // Restore cursor after state update
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + text.length;
      el.focus();
    });
  };

  const saveMut = useMutation({
    mutationFn: () =>
      api.put(`/notifications/admin/templates/${template.id}`, {
        subject: subject || null,
        body: body || null,
        active,
      }),
    onSuccess: () => {
      toast.success("Template mis à jour.");
      qc.invalidateQueries({ queryKey: ["admin", "notifications", "templates"] });
    },
    onError: () => toast.error("Erreur lors de la sauvegarde."),
  });

  return (
    <div className="border-b last:border-b-0">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {EVENT_LABELS[template.eventType] ?? template.eventType}
          </p>
          <p className="text-xs font-mono text-muted-foreground">
            {template.eventType}
          </p>
        </div>
        <Badge variant={active ? "success" : "secondary"}>
          {active ? "Actif" : "Inactif"}
        </Badge>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {open && (
        <div className="border-t bg-muted/10 px-5 py-4 space-y-4">
          {/* Active toggle */}
          <div className="flex items-center gap-2">
            <Switch
              checked={active}
              onCheckedChange={setActive}
              id={`active-${template.id}`}
            />
            <label
              htmlFor={`active-${template.id}`}
              className="text-sm cursor-pointer"
            >
              {active ? "Actif — e-mails envoyés" : "Inactif — e-mails supprimés"}
            </label>
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
              Sujet
            </label>
            {mergeTags.length > 0 && (
              <MergeTagBar
                tags={mergeTags}
                onInsert={(tag) =>
                  insertAt(subjectRef as React.RefObject<HTMLInputElement>, setSubject, subject, tag)
                }
              />
            )}
            <input
              ref={subjectRef}
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Sujet de l'e-mail…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
              Corps du message
            </label>
            {mergeTags.length > 0 && (
              <MergeTagBar
                tags={mergeTags}
                onInsert={(tag) =>
                  insertAt(bodyRef as React.RefObject<HTMLTextAreaElement>, setBody, body, tag)
                }
              />
            )}
            <Textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Corps de l'e-mail (HTML ou texte)…"
              className="min-h-[180px] font-mono text-xs"
            />
          </div>

          <div className="flex items-center justify-between">
            <Button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
              size="sm"
            >
              {saveMut.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
            {template.updatedAt && (
              <p className="text-xs text-muted-foreground">
                Mis à jour le{" "}
                {new Date(template.updatedAt).toLocaleDateString("fr-CH", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AdminNotifications
// ---------------------------------------------------------------------------

export default function AdminNotifications() {
  const { data: templates = [], isLoading } = useQuery<NotificationTemplate[]>({
    queryKey: ["admin", "notifications", "templates"],
    queryFn: () => api.get<NotificationTemplate[]>("/notifications/admin/templates"),
    staleTime: 5 * 60_000,
  });

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Templates de notification</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Éditez les e-mails automatiques envoyés aux membres.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-5 w-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-dashed py-14 text-center text-sm text-muted-foreground">
          Aucun template configuré. Vérifiez la base de données.
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          {templates.map((t) => (
            <TemplateEditor key={t.id} template={t} />
          ))}
        </div>
      )}
    </div>
  );
}
