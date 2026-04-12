import { useState, useMemo, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Wifi,
  ExternalLink,
  Calendar,
  List,
  LayoutGrid,
  Download,
  Users,
  Filter,
  Clock,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePrograms, type CalendarSession } from "@/hooks/useCatalogue";
import { formatSessionDateRange } from "@/hooks/useCatalogue";
import {
  useEvents,
  useMergedEvents,
  useMyRsvp,
  useRsvpMutation,
  useCancelRsvpMutation,
  useEventRsvps,
  type CommunityEventData,
} from "@/hooks/useEvents";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function AgendaSkeleton() {
  return (
    <div className="rounded-xl border overflow-hidden">
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="py-2 flex justify-center border-r last:border-r-0">
            <Skeleton className="h-4 w-8" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="min-h-[80px] border-r border-b p-2 space-y-1">
            <div className="flex justify-end">
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
            {i % 5 === 0 && <Skeleton className="h-4 w-full rounded" />}
            {i % 7 === 2 && <Skeleton className="h-4 w-3/4 rounded" />}
          </div>
        ))}
      </div>
    </div>
  );
}

type ViewMode = "month" | "week" | "list";
type EventTypeFilter = "all" | "training" | "community";
type LocationFilter = "all" | "remote" | "in-person";

interface SessionWithProgram extends CalendarSession {
  programCode: string;
  programName: string;
}

interface UnifiedEvent {
  id: string;
  title: string;
  type: "training" | "community";
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  isRemote: boolean;
  programCode: string | null;
  programName: string | null;
  dates: { date: string; startTime: string | null; endTime: string | null }[];
  session?: SessionWithProgram;
  event?: CommunityEventData;
}

const PALETTE = [
  "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
  "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200",
  "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200",
  "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-200",
  "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200",
  "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200",
];

const COMMUNITY_COLOR = "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-200";

function programColor(code: string): string {
  let h = 0;
  for (const c of code) h = (h * 31 + c.charCodeAt(0)) & 0xff;
  return PALETTE[h % PALETTE.length];
}

function getEventColor(event: UnifiedEvent): string {
  if (event.type === "community") return COMMUNITY_COLOR;
  return programColor(event.programCode ?? "default");
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  meetup: "Rencontre",
  webinar: "Webinaire",
  networking: "Networking",
  workshop: "Atelier",
  other: "Autre",
};

function extractSessions(
  data: ReturnType<typeof usePrograms>["data"]
): SessionWithProgram[] {
  if (!data) return [];
  const result: SessionWithProgram[] = [];
  for (const cat of data) {
    for (const prog of cat.programs) {
      for (const sess of prog.sessions) {
        result.push({
          ...sess,
          programCode: prog.programCode,
          programName: prog.name,
        });
      }
    }
  }
  return result;
}

function unifyEvents(
  sessions: SessionWithProgram[],
  communityEvents: CommunityEventData[]
): UnifiedEvent[] {
  const result: UnifiedEvent[] = [];

  for (const s of sessions) {
    result.push({
      id: `training-${s.id}`,
      title: s.programName,
      type: "training",
      startDate: s.startDate,
      endDate: s.endDate,
      location: s.placeName ?? s.place ?? null,
      isRemote: s.remote,
      programCode: s.programCode,
      programName: s.programName,
      dates: s.dates,
      session: s,
    });
  }

  for (const e of communityEvents) {
    const startStr = e.startAt ? new Date(e.startAt).toISOString().slice(0, 10) : null;
    const endStr = e.endAt ? new Date(e.endAt).toISOString().slice(0, 10) : null;
    result.push({
      id: `event-${e.id}`,
      title: e.title,
      type: "community",
      startDate: startStr,
      endDate: endStr,
      location: e.location,
      isRemote: e.isRemote,
      programCode: e.programCode,
      programName: null,
      dates: startStr
        ? [
            {
              date: startStr,
              startTime: e.startAt ? new Date(e.startAt).toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" }) : null,
              endTime: e.endAt ? new Date(e.endAt).toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" }) : null,
            },
          ]
        : [],
      event: e,
    });
  }

  return result;
}

function eventDateStrings(event: UnifiedEvent): string[] {
  if (event.dates.length > 0) {
    return event.dates.map((d) => d.date);
  }
  if (!event.startDate) return [];
  const dates: string[] = [];
  const start = new Date(event.startDate);
  const end = event.endDate ? new Date(event.endDate) : start;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function buildCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const dowOffset = (firstDay.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - dowOffset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function buildWeekDays(year: number, month: number, day: number): Date[] {
  const current = new Date(year, month, day);
  const dowOffset = (current.getDay() + 6) % 7;
  const start = new Date(current);
  start.setDate(current.getDate() - dowOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function EventDetailDialog({
  event,
  onClose,
}: {
  event: UnifiedEvent | null;
  onClose: () => void;
}) {
  const { isAuthenticated } = useAuth();

  if (!event) return null;

  if (event.type === "training" && event.session) {
    return <TrainingDetailDialog session={event.session} onClose={onClose} />;
  }

  if (event.type === "community" && event.event) {
    return (
      <CommunityEventDialog
        event={event.event}
        onClose={onClose}
        isAuthenticated={isAuthenticated}
      />
    );
  }

  return null;
}

function TrainingDetailDialog({
  session,
  onClose,
}: {
  session: SessionWithProgram;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{session.programName}</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {session.programCode}
            {session.code ? ` — Session ${session.code}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 sm:px-6 pb-2 space-y-4">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Dates
            </p>
            <p className="text-sm">
              {formatSessionDateRange(session.startDate, session.endDate)}
            </p>
            {session.dates.length > 0 && (
              <ul className="mt-1.5 space-y-1">
                {session.dates.map((d) => (
                  <li key={d.date} className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {new Date(d.date).toLocaleDateString("fr-CH", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })}
                    </span>
                    {d.startTime && d.endTime && (
                      <span>{d.startTime} – {d.endTime}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Lieu
            </p>
            {session.remote ? (
              <div className="flex items-center gap-2 text-sm">
                <Wifi className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>Formation à distance</span>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span>{session.placeName ?? session.place ?? "Lieu à confirmer"}</span>
              </div>
            )}
            {session.inter && (
              <p className="text-xs text-muted-foreground">Session inter-entreprises</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fermer</Button>
          <Button asChild>
            <Link
              to="/catalogue/$code"
              params={{ code: session.programCode }}
              search={{}}
              onClick={onClose}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              S'inscrire
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CommunityEventDialog({
  event,
  onClose,
  isAuthenticated,
}: {
  event: CommunityEventData;
  onClose: () => void;
  isAuthenticated: boolean;
}) {
  const { data: myRsvp } = useMyRsvp(event.id, isAuthenticated);
  const { data: rsvpList } = useEventRsvps(event.id);
  const rsvpMutation = useRsvpMutation(event.id);
  const cancelMutation = useCancelRsvpMutation(event.id);

  const startAt = new Date(event.startAt);
  const endAt = new Date(event.endAt);
  const counts = event.rsvpCounts ?? { attending: 0, maybe: 0, not_attending: 0 };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{event.title}</DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-800 dark:bg-pink-900/30 dark:text-pink-200">
              {EVENT_TYPE_LABELS[event.eventType] ?? event.eventType}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 sm:px-6 pb-2 space-y-4">
          {event.description && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Description
              </p>
              <p className="text-sm whitespace-pre-wrap">{event.description}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Date et heure
            </p>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>
                {startAt.toLocaleDateString("fr-CH", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                {" · "}
                {startAt.toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" })}
                {" – "}
                {endAt.toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Lieu
            </p>
            {event.isRemote ? (
              <div className="flex items-center gap-2 text-sm">
                <Wifi className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>En ligne</span>
                {event.meetingUrl && (
                  <a
                    href={event.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline text-xs"
                  >
                    Rejoindre
                  </a>
                )}
              </div>
            ) : (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <span>{event.location ?? "Lieu à confirmer"}</span>
                  {event.locationAddress && (
                    <p className="text-xs text-muted-foreground mt-0.5">{event.locationAddress}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Participants
            </p>
            <div className="flex items-center gap-3 text-sm">
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{counts.attending} confirmé{counts.attending !== 1 ? "s" : ""}</span>
              {counts.maybe > 0 && (
                <span className="text-muted-foreground">· {counts.maybe} peut-être</span>
              )}
              {event.maxAttendees && (
                <span className="text-muted-foreground">
                  · {event.maxAttendees - counts.attending} place{event.maxAttendees - counts.attending !== 1 ? "s" : ""} restante{event.maxAttendees - counts.attending !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {rsvpList && rsvpList.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {rsvpList
                  .filter((r) => r.status === "attending")
                  .slice(0, 10)
                  .map((r) => (
                    <span
                      key={r.id}
                      className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px]"
                    >
                      {r.firstName ?? r.email}
                    </span>
                  ))}
                {rsvpList.filter((r) => r.status === "attending").length > 10 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{rsvpList.filter((r) => r.status === "attending").length - 10} autres
                  </span>
                )}
              </div>
            )}
          </div>

          {isAuthenticated && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Votre réponse
              </p>
              <div className="flex gap-2">
                {(["attending", "maybe", "not_attending"] as const).map((status) => {
                  const labels: Record<string, string> = {
                    attending: "Participer",
                    maybe: "Peut-être",
                    not_attending: "Absent",
                  };
                  const isActive = myRsvp?.status === status;
                  return (
                    <Button
                      key={status}
                      size="sm"
                      variant={isActive ? "default" : "outline"}
                      onClick={() => rsvpMutation.mutate(status)}
                      disabled={rsvpMutation.isPending}
                    >
                      {labels[status]}
                    </Button>
                  );
                })}
                {myRsvp && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => cancelMutation.mutate()}
                    disabled={cancelMutation.isPending}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Annuler
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              window.open(`/api/events/${event.id}/ical`, "_blank");
            }}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Ajouter au calendrier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DayCellProps {
  date: Date;
  isCurrentMonth: boolean;
  events: UnifiedEvent[];
  onEventClick: (e: UnifiedEvent) => void;
  tall?: boolean;
}

function DayCell({ date, isCurrentMonth, events, onEventClick, tall }: DayCellProps) {
  const today = dateStr(new Date());
  const isToday = dateStr(date) === today;

  return (
    <div
      className={
        (tall ? "min-h-[120px] " : "min-h-[80px] ") +
        "border-r border-b p-1 " +
        (isCurrentMonth ? "bg-background" : "bg-muted/30")
      }
    >
      <div className="flex justify-end mb-1">
        <span
          className={
            "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium " +
            (isToday
              ? "bg-primary text-primary-foreground"
              : isCurrentMonth
              ? "text-foreground"
              : "text-muted-foreground/50")
          }
        >
          {date.getDate()}
        </span>
      </div>

      <div className="space-y-0.5">
        {events.slice(0, 3).map((e, idx) => (
          <button
            key={`${e.id}-${dateStr(date)}-${idx}`}
            onClick={() => onEventClick(e)}
            className={
              "w-full text-left rounded px-1 py-0.5 text-[10px] leading-tight truncate " +
              getEventColor(e)
            }
            title={e.title}
          >
            {e.title}
          </button>
        ))}
        {events.length > 3 && (
          <button
            onClick={() => onEventClick(events[3])}
            className="w-full text-left text-[10px] text-muted-foreground px-1"
          >
            +{events.length - 3} autres
          </button>
        )}
      </div>
    </div>
  );
}

function ListView({
  events,
  onEventClick,
}: {
  events: UnifiedEvent[];
  onEventClick: (e: UnifiedEvent) => void;
}) {
  const sorted = useMemo(
    () =>
      [...events].sort((a, b) => {
        const da = a.startDate ? new Date(a.startDate).getTime() : 0;
        const db = b.startDate ? new Date(b.startDate).getTime() : 0;
        return da - db;
      }),
    [events]
  );

  if (sorted.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Aucun événement à afficher
      </div>
    );
  }

  let lastMonth = "";

  return (
    <div className="space-y-1">
      {sorted.map((event) => {
        const startDate = event.startDate ? new Date(event.startDate) : null;
        const monthLabel = startDate
          ? `${MONTH_NAMES[startDate.getMonth()]} ${startDate.getFullYear()}`
          : "";
        const showHeader = monthLabel !== lastMonth;
        if (showHeader) lastMonth = monthLabel;

        return (
          <div key={event.id}>
            {showHeader && monthLabel && (
              <h3 className="text-sm font-semibold text-muted-foreground pt-4 pb-2 px-1">
                {monthLabel}
              </h3>
            )}
            <button
              onClick={() => onEventClick(event)}
              className="w-full text-left rounded-lg border p-3 hover:bg-accent/50 transition-colors flex items-start gap-3"
            >
              <div
                className={
                  "flex-shrink-0 w-12 h-12 rounded-lg flex flex-col items-center justify-center text-xs font-bold " +
                  getEventColor(event)
                }
              >
                {startDate ? (
                  <>
                    <span className="text-[10px] uppercase">
                      {startDate.toLocaleDateString("fr-CH", { month: "short" })}
                    </span>
                    <span className="text-base leading-none">{startDate.getDate()}</span>
                  </>
                ) : (
                  <span>?</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{event.title}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  {event.type === "community" && (
                    <span className="inline-flex items-center rounded-full bg-pink-100 px-1.5 py-0.5 text-[10px] font-medium text-pink-800 dark:bg-pink-900/30 dark:text-pink-200">
                      {EVENT_TYPE_LABELS[event.event?.eventType ?? ""] ?? "Événement"}
                    </span>
                  )}
                  {event.type === "training" && (
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                      Formation
                    </span>
                  )}
                  {event.isRemote ? (
                    <span className="flex items-center gap-1">
                      <Wifi className="h-3 w-3" /> En ligne
                    </span>
                  ) : event.location ? (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {event.location}
                    </span>
                  ) : null}
                  {event.event?.rsvpCounts && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {event.event.rsvpCounts.attending}
                    </span>
                  )}
                </div>
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default function AgendaPage() {
  const { isAuthenticated } = useAuth();
  const { data: categories } = usePrograms();
  const [selected, setSelected] = useState<UnifiedEvent | null>(null);
  const [view, setView] = useState<ViewMode>("month");
  const [typeFilter, setTypeFilter] = useState<EventTypeFilter>("all");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("all");
  const [programFilter, setProgramFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [weekDay, setWeekDay] = useState(today.getDate());

  const mergedFilters = useMemo(() => {
    const f: Record<string, string> = {};
    if (typeFilter !== "all") f.eventType = typeFilter;
    if (locationFilter !== "all") f.location = locationFilter;
    if (programFilter !== "all") f.programCode = programFilter;
    if (dateFrom) f.from = dateFrom;
    if (dateTo) f.to = dateTo;
    return f;
  }, [typeFilter, locationFilter, programFilter, dateFrom, dateTo]);

  const { data: mergedData, isLoading } = useMergedEvents(mergedFilters);

  const programList = useMemo(() => {
    if (!categories) return [];
    const progs: { code: string; name: string }[] = [];
    for (const cat of categories) {
      for (const prog of cat.programs) {
        if (!progs.some((p) => p.code === prog.programCode)) {
          progs.push({ code: prog.programCode, name: prog.name });
        }
      }
    }
    return progs.sort((a, b) => a.name.localeCompare(b.name));
  }, [categories]);

  const trainingSessions: SessionWithProgram[] = useMemo(() => {
    if (!mergedData?.trainingSessions) return [];
    return mergedData.trainingSessions.map((s) => ({
      id: s.id,
      name: s.name ?? "",
      code: s.code ?? "",
      programCode: s.programCode ?? "",
      programName: s.programName ?? "",
      startDate: s.startDate ?? "",
      endDate: s.endDate ?? "",
      place: s.place ?? "",
      placeName: s.placeName ?? "",
      remote: s.remote ?? false,
      inter: s.inter ?? false,
      program: s.programCode ? { id: s.id, name: s.programName ?? "", code: s.programCode } : null,
      image: null,
      dates: Array.isArray(s.dates) ? s.dates as { date: string; startTime: string | null; endTime: string | null }[] : [],
    }));
  }, [mergedData]);

  const allEvents = useMemo(
    () => unifyEvents(trainingSessions, mergedData?.communityEvents ?? []),
    [trainingSessions, mergedData]
  );

  const filteredEvents = allEvents;

  const eventsByDay = useMemo(() => {
    const map = new Map<string, UnifiedEvent[]>();
    for (const e of filteredEvents) {
      for (const ds of eventDateStrings(e)) {
        const arr = map.get(ds) ?? [];
        arr.push(e);
        map.set(ds, arr);
      }
    }
    return map;
  }, [filteredEvents]);

  const days = useMemo(() => buildCalendarDays(year, month), [year, month]);
  const weekDays = useMemo(
    () => buildWeekDays(year, month, weekDay),
    [year, month, weekDay]
  );

  useEffect(() => {
    if (!isAuthenticated) {
      const prev = document.title;
      document.title = "Agenda des formations et événements — mhp | connect";
      return () => { document.title = prev; };
    }
  }, [isAuthenticated]);

  const prevMonth = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  };
  const prevWeek = () => {
    const d = new Date(year, month, weekDay - 7);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setWeekDay(d.getDate());
  };
  const nextWeek = () => {
    const d = new Date(year, month, weekDay + 7);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setWeekDay(d.getDate());
  };
  const goToToday = () => {
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth());
    setWeekDay(t.getDate());
  };

  const activeFilters = (typeFilter !== "all" ? 1 : 0) + (locationFilter !== "all" ? 1 : 0) + (programFilter !== "all" ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-page-enter">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agenda</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Formations et événements communautaires
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center rounded-lg border p-0.5">
            {(
              [
                { key: "month" as ViewMode, icon: LayoutGrid, label: "Mois" },
                { key: "week" as ViewMode, icon: Calendar, label: "Semaine" },
                { key: "list" as ViewMode, icon: List, label: "Liste" },
              ] as const
            ).map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors " +
                  (view === key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent")
                }
                title={label}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="relative"
          >
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            Filtres
            {activeFilters > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                {activeFilters}
              </span>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open("/api/events/ical", "_blank")}
            title="Exporter le calendrier (iCal)"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">iCal</span>
          </Button>
        </div>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-3 p-3 rounded-lg border bg-muted/30">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as EventTypeFilter)}
              className="block w-full sm:w-auto rounded-md border bg-background px-2.5 py-1.5 text-sm"
            >
              <option value="all">Tous</option>
              <option value="training">Formations</option>
              <option value="community">Événements</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Lieu</label>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value as LocationFilter)}
              className="block w-full sm:w-auto rounded-md border bg-background px-2.5 py-1.5 text-sm"
            >
              <option value="all">Tous</option>
              <option value="remote">À distance</option>
              <option value="in-person">Présentiel</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Programme</label>
            <select
              value={programFilter}
              onChange={(e) => setProgramFilter(e.target.value)}
              className="block w-full sm:w-auto rounded-md border bg-background px-2.5 py-1.5 text-sm"
            >
              <option value="all">Tous les programmes</option>
              {programList.map((p) => (
                <option key={p.code} value={p.code}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Du</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="block w-full sm:w-auto rounded-md border bg-background px-2.5 py-1.5 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Au</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="block w-full sm:w-auto rounded-md border bg-background px-2.5 py-1.5 text-sm"
            />
          </div>
          {activeFilters > 0 && (
            <div className="flex items-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setTypeFilter("all"); setLocationFilter("all"); setProgramFilter("all"); setDateFrom(""); setDateTo(""); }}
              >
                Réinitialiser
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={view === "week" ? prevWeek : prevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-md border hover:bg-accent transition-colors"
            aria-label="Précédent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[140px] text-center text-sm font-medium">
            {view === "week"
              ? `${weekDays[0].toLocaleDateString("fr-CH", { day: "numeric", month: "short" })} – ${weekDays[6].toLocaleDateString("fr-CH", { day: "numeric", month: "short", year: "numeric" })}`
              : `${MONTH_NAMES[month]} ${year}`}
          </span>
          <button
            onClick={view === "week" ? nextWeek : nextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-md border hover:bg-accent transition-colors"
            aria-label="Suivant"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <Button variant="outline" size="sm" onClick={goToToday}>
          Aujourd'hui
        </Button>
      </div>

      {isLoading ? (
        <AgendaSkeleton />
      ) : view === "list" ? (
        <ListView events={filteredEvents} onEventClick={setSelected} />
      ) : (
        <div className="rounded-xl border overflow-hidden overflow-x-auto">
          <div className="min-w-[500px]">
            <div className="grid grid-cols-7 border-b bg-muted/40">
              {DAY_NAMES.map((name) => (
                <div
                  key={name}
                  className="py-2 text-center text-xs font-semibold text-muted-foreground border-r last:border-r-0"
                >
                  {name}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {(view === "week" ? weekDays : days).map((day, i) => (
                <DayCell
                  key={i}
                  date={day}
                  isCurrentMonth={view === "week" || day.getMonth() === month}
                  events={eventsByDay.get(dateStr(day)) ?? []}
                  onEventClick={setSelected}
                  tall={view === "week"}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {!isLoading && filteredEvents.length > 0 && view !== "list" && (
        <div className="flex flex-wrap gap-2">
          {typeFilter !== "community" && (
            <>
              {Array.from(new Set(filteredEvents.filter((e) => e.type === "training").map((e) => e.programCode))).map(
                (code) => {
                  if (!code) return null;
                  const prog = filteredEvents.find((e) => e.programCode === code);
                  return (
                    <span
                      key={code}
                      className={
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium " +
                        programColor(code)
                      }
                    >
                      {prog?.programName ?? code}
                    </span>
                  );
                }
              )}
            </>
          )}
          {typeFilter !== "training" && filteredEvents.some((e) => e.type === "community") && (
            <span
              className={
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium " +
                COMMUNITY_COLOR
              }
            >
              Événements communautaires
            </span>
          )}
        </div>
      )}

      <EventDetailDialog event={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
