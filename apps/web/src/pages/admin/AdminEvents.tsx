import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Users,
  BarChart3,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useAdminEvents,
  useAdminEventReport,
  useCreateEventMutation,
  useUpdateEventMutation,
  useDeleteEventMutation,
  useEventRsvps,
  type CommunityEventData,
} from "@/hooks/useEvents";
import { AdminPageShell, AdminTableSkeleton, AdminEmptyState } from "@/components/AdminPageShell";

const EVENT_TYPE_LABELS: Record<string, string> = {
  meetup: "Rencontre",
  webinar: "Webinaire",
  networking: "Networking",
  workshop: "Atelier",
  other: "Autre",
};

const EVENT_TYPES = ["meetup", "webinar", "networking", "workshop", "other"];

function EventForm({
  initial,
  onSubmit,
  onCancel,
  isPending,
}: {
  initial?: CommunityEventData | null;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [eventType, setEventType] = useState(initial?.eventType ?? "meetup");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [locationAddress, setLocationAddress] = useState(initial?.locationAddress ?? "");
  const [isRemote, setIsRemote] = useState(initial?.isRemote ?? false);
  const [meetingUrl, setMeetingUrl] = useState(initial?.meetingUrl ?? "");
  const [startAt, setStartAt] = useState(
    initial?.startAt ? new Date(initial.startAt).toISOString().slice(0, 16) : ""
  );
  const [endAt, setEndAt] = useState(
    initial?.endAt ? new Date(initial.endAt).toISOString().slice(0, 16) : ""
  );
  const [maxAttendees, setMaxAttendees] = useState(
    initial?.maxAttendees?.toString() ?? ""
  );
  const [programCode, setProgramCode] = useState(initial?.programCode ?? "");
  const [published, setPublished] = useState(initial?.published ?? false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      description: description || null,
      eventType,
      location: location || null,
      locationAddress: locationAddress || null,
      isRemote,
      meetingUrl: meetingUrl || null,
      startAt: new Date(startAt).toISOString(),
      endAt: new Date(endAt).toISOString(),
      maxAttendees: maxAttendees ? parseInt(maxAttendees, 10) : null,
      programCode: programCode || null,
      published,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="text-sm font-medium">Titre *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
            required
          />
        </div>

        <div className="sm:col-span-2">
          <label className="text-sm font-medium">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Type *</label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EVENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium">Code programme</label>
          <input
            type="text"
            value={programCode}
            onChange={(e) => setProgramCode(e.target.value)}
            className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Optionnel"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Début *</label>
          <input
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
            required
          />
        </div>

        <div>
          <label className="text-sm font-medium">Fin *</label>
          <input
            type="datetime-local"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
            className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
            required
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isRemote"
            checked={isRemote}
            onChange={(e) => setIsRemote(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="isRemote" className="text-sm font-medium">
            À distance
          </label>
        </div>

        <div>
          <label className="text-sm font-medium">Nombre max de participants</label>
          <input
            type="number"
            value={maxAttendees}
            onChange={(e) => setMaxAttendees(e.target.value)}
            className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
            min="1"
            placeholder="Illimité"
          />
        </div>

        {!isRemote && (
          <>
            <div>
              <label className="text-sm font-medium">Lieu</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Adresse</label>
              <input
                type="text"
                value={locationAddress}
                onChange={(e) => setLocationAddress(e.target.value)}
                className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
          </>
        )}

        {isRemote && (
          <div className="sm:col-span-2">
            <label className="text-sm font-medium">URL de la réunion</label>
            <input
              type="url"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="https://zoom.us/..."
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="published"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="published" className="text-sm font-medium">
            Publié
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={isPending}>
          {initial ? "Mettre à jour" : "Créer"}
        </Button>
      </div>
    </form>
  );
}

function RsvpDialog({
  eventId,
  eventTitle,
  onClose,
}: {
  eventId: string;
  eventTitle: string;
  onClose: () => void;
}) {
  const { data: rsvps, isLoading } = useEventRsvps(eventId);

  const byStatus = {
    attending: rsvps?.filter((r) => r.status === "attending") ?? [],
    maybe: rsvps?.filter((r) => r.status === "maybe") ?? [],
    not_attending: rsvps?.filter((r) => r.status === "not_attending") ?? [],
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>RSVPs — {eventTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <div className="h-4 w-4 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            </div>
          ) : (
            <>
              {(["attending", "maybe", "not_attending"] as const).map((status) => {
                const labels: Record<string, string> = {
                  attending: "Confirmés",
                  maybe: "Peut-être",
                  not_attending: "Absents",
                };
                const list = byStatus[status];
                return (
                  <div key={status}>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      {labels[status]} ({list.length})
                    </h4>
                    {list.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Aucun</p>
                    ) : (
                      <ul className="space-y-1">
                        {list.map((r) => (
                          <li key={r.id} className="text-sm flex items-center gap-2">
                            <span className="font-medium">
                              {r.firstName} {r.lastName}
                            </span>
                            <span className="text-xs text-muted-foreground">{r.email}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminEvents() {
  const { data: events, isLoading } = useAdminEvents();
  const { data: report } = useAdminEventReport();
  const createMutation = useCreateEventMutation();
  const deleteMutation = useDeleteEventMutation();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CommunityEventData | null>(null);
  const [rsvpEventId, setRsvpEventId] = useState<string | null>(null);
  const [rsvpEventTitle, setRsvpEventTitle] = useState("");
  const [showReport, setShowReport] = useState(false);

  const handleCreate = (data: Record<string, unknown>) => {
    createMutation.mutate(data, {
      onSuccess: () => setShowForm(false),
    });
  };

  return (
    <AdminPageShell
      title="Événements"
      description="Gestion des événements communautaires"
      actions={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowReport(!showReport)}
          >
            <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
            Rapport
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Créer
          </Button>
        </>
      }
    >

      {showReport && report && (
        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="text-sm font-semibold">Rapport de participation</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">Événement</th>
                  <th className="pb-2 font-medium text-center">Confirmés</th>
                  <th className="pb-2 font-medium text-center">Peut-être</th>
                  <th className="pb-2 font-medium text-center">Absents</th>
                  <th className="pb-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {report.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2">{r.title}</td>
                    <td className="py-2 text-center font-medium text-emerald-600">
                      {r.rsvpCounts.attending}
                    </td>
                    <td className="py-2 text-center text-amber-600">
                      {r.rsvpCounts.maybe}
                    </td>
                    <td className="py-2 text-center text-muted-foreground">
                      {r.rsvpCounts.not_attending}
                    </td>
                    <td className="py-2 text-muted-foreground text-xs">
                      {new Date(r.startAt).toLocaleDateString("fr-CH")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <Dialog open={showForm} onOpenChange={() => setShowForm(false)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Créer un événement</DialogTitle>
            </DialogHeader>
            <EventForm
              onSubmit={handleCreate}
              onCancel={() => setShowForm(false)}
              isPending={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      )}

      {editing && (
        <EditEventDialog
          event={editing}
          onClose={() => setEditing(null)}
        />
      )}

      {rsvpEventId && (
        <RsvpDialog
          eventId={rsvpEventId}
          eventTitle={rsvpEventTitle}
          onClose={() => setRsvpEventId(null)}
        />
      )}

      {isLoading ? (
        <AdminTableSkeleton rows={5} cols={5} />
      ) : !events || events.length === 0 ? (
        <AdminEmptyState icon={CalendarDays} title="Aucun événement créé" description="Créez un événement pour commencer." />
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-4 py-3 font-medium">Titre</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Type</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Date</th>
                <th className="px-4 py-3 font-medium text-center">Statut</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="font-medium">{event.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 sm:hidden">
                      {EVENT_TYPE_LABELS[event.eventType]}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs">
                      {EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                    {new Date(event.startAt).toLocaleDateString("fr-CH", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {event.published ? (
                      <Eye className="h-4 w-4 text-emerald-500 inline" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground inline" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => {
                          setRsvpEventId(event.id);
                          setRsvpEventTitle(event.title);
                        }}
                        className="p-1.5 rounded hover:bg-accent transition-colors"
                        title="Voir les RSVPs"
                      >
                        <Users className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setEditing(event)}
                        className="p-1.5 rounded hover:bg-accent transition-colors"
                        title="Modifier"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Supprimer cet événement ?")) {
                            deleteMutation.mutate(event.id);
                          }
                        }}
                        className="p-1.5 rounded hover:bg-accent transition-colors text-destructive"
                        title="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPageShell>
  );
}

function EditEventDialog({
  event,
  onClose,
}: {
  event: CommunityEventData;
  onClose: () => void;
}) {
  const updateMutation = useUpdateEventMutation(event.id);

  const handleUpdate = (data: Record<string, unknown>) => {
    updateMutation.mutate(data, { onSuccess: onClose });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Modifier l'événement</DialogTitle>
        </DialogHeader>
        <EventForm
          initial={event}
          onSubmit={handleUpdate}
          onCancel={onClose}
          isPending={updateMutation.isPending}
        />
      </DialogContent>
    </Dialog>
  );
}
