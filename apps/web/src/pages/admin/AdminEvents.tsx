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
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    if (!title.trim()) {
      toast.error("Le titre est requis.");
      return;
    }
    if (!startAt || !endAt) {
      toast.error("Les dates de début et fin sont requises.");
      return;
    }
    onSubmit({
      title: title.trim(),
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
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="ev-title">Titre *</Label>
          <Input
            id="ev-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre de l'événement"
          />
        </div>

        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="ev-desc">Description</Label>
          <Textarea
            id="ev-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Description de l'événement..."
          />
        </div>

        <div className="space-y-1.5">
          <Label>Type *</Label>
          <Select value={eventType} onValueChange={setEventType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {EVENT_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ev-prog">Code programme</Label>
          <Input
            id="ev-prog"
            value={programCode}
            onChange={(e) => setProgramCode(e.target.value)}
            placeholder="Optionnel"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ev-start">Début *</Label>
          <Input
            id="ev-start"
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ev-end">Fin *</Label>
          <Input
            id="ev-end"
            type="datetime-local"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 pt-6">
          <Checkbox
            id="ev-remote"
            checked={isRemote}
            onCheckedChange={(v) => setIsRemote(v === true)}
          />
          <Label htmlFor="ev-remote" className="cursor-pointer">
            À distance
          </Label>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ev-max">Nombre max de participants</Label>
          <Input
            id="ev-max"
            type="number"
            value={maxAttendees}
            onChange={(e) => setMaxAttendees(e.target.value)}
            min="1"
            placeholder="Illimité"
          />
        </div>

        {!isRemote && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="ev-location">Lieu</Label>
              <Input
                id="ev-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Nom du lieu"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-address">Adresse</Label>
              <Input
                id="ev-address"
                value={locationAddress}
                onChange={(e) => setLocationAddress(e.target.value)}
                placeholder="Adresse complète"
              />
            </div>
          </>
        )}

        {isRemote && (
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="ev-url">URL de la réunion</Label>
            <Input
              id="ev-url"
              type="url"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="https://zoom.us/..."
            />
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <Checkbox
            id="ev-published"
            checked={published}
            onCheckedChange={(v) => setPublished(v === true)}
          />
          <Label htmlFor="ev-published" className="cursor-pointer">
            Publié
          </Label>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
          {initial ? "Mettre à jour" : "Créer"}
        </Button>
      </DialogFooter>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setRsvpEventId(event.id);
                          setRsvpEventTitle(event.title);
                        }}
                        title="Voir les RSVPs"
                      >
                        <Users className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditing(event)}
                        title="Modifier"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("Supprimer cet événement ?")) {
                            deleteMutation.mutate(event.id);
                          }
                        }}
                        title="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
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
