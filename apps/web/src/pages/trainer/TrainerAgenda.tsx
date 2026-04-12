import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Wifi,
  Calendar,
  List,
  Users,
} from "lucide-react";
import { useTrainerSessions } from "@/hooks/useTrainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type ViewMode = "month" | "list";

const DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const PALETTE = [
  "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
  "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200",
  "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200",
  "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-200",
];

function programColor(code: string): string {
  let h = 0;
  for (const c of code) h = (h * 31 + c.charCodeAt(0)) & 0xff;
  return PALETTE[h % PALETTE.length];
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

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return "Dates non définies";
  const s = new Date(start);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  if (!end || start === end) return s.toLocaleDateString("fr-CH", opts);
  const e = new Date(end);
  return `${s.toLocaleDateString("fr-CH", opts)} — ${e.toLocaleDateString("fr-CH", opts)}`;
}

export default function TrainerAgenda() {
  const { sessions, isLoading, isError } = useTrainerSessions();
  const [view, setView] = useState<ViewMode>("month");
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const dateIndex = useMemo(() => {
    const idx = new Map<string, typeof sessions>();
    for (const s of sessions) {
      if (s.dates && Array.isArray(s.dates) && s.dates.length > 0) {
        for (const d of s.dates) {
          const key = d.date;
          if (!idx.has(key)) idx.set(key, []);
          idx.get(key)!.push(s);
        }
      } else if (s.startDate) {
        const start = new Date(s.startDate);
        const end = s.endDate ? new Date(s.endDate) : start;
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const key = dateStr(d);
          if (!idx.has(key)) idx.set(key, []);
          idx.get(key)!.push(s);
        }
      }
    }
    return idx;
  }, [sessions]);

  const calendarDays = useMemo(() => buildCalendarDays(year, month), [year, month]);

  const prev = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const next = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };
  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl space-y-6 pb-12">
        <div>
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-56 mt-2" />
        </div>
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
              <div key={i} className="min-h-[80px] border-r border-b p-2">
                <Skeleton className="h-4 w-4 rounded-full ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
        Impossible de charger votre agenda.
      </div>
    );
  }

  const upcomingSessions = sessions
    .filter((s) => {
      const end = s.endDate ?? s.startDate;
      return end && new Date(end).getTime() + 86400000 >= Date.now();
    })
    .sort((a, b) => {
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });

  return (
    <div className="max-w-4xl space-y-6 pb-12 animate-page-enter">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Mon agenda</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vue calendrier de vos sessions assignées.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border p-0.5">
          <Button
            variant={view === "month" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() => setView("month")}
          >
            <Calendar className="h-3.5 w-3.5 mr-1" />
            Mois
          </Button>
          <Button
            variant={view === "list" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() => setView("list")}
          >
            <List className="h-3.5 w-3.5 mr-1" />
            Liste
          </Button>
        </div>
      </div>

      {view === "month" && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={prev}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-sm font-semibold min-w-[160px] text-center">
                {MONTH_NAMES[month]} {year}
              </h2>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={next}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="text-xs" onClick={goToday}>
              Aujourd'hui
            </Button>
          </div>

          <div className="rounded-xl border overflow-hidden">
            <div className="grid grid-cols-7 border-b bg-muted/40">
              {DAY_NAMES.map((d) => (
                <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground border-r last:border-r-0">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((day, i) => {
                const key = dateStr(day);
                const events = dateIndex.get(key) ?? [];
                const isCurrentMonth = day.getMonth() === month;
                const isToday = key === dateStr(today);
                return (
                  <div
                    key={i}
                    className={`min-h-[80px] border-r border-b p-1.5 ${
                      isCurrentMonth ? "bg-background" : "bg-muted/20"
                    }`}
                  >
                    <div className="flex justify-end mb-0.5">
                      <span
                        className={`text-xs tabular-nums ${
                          isToday
                            ? "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold"
                            : isCurrentMonth
                            ? "text-foreground"
                            : "text-muted-foreground/50"
                        }`}
                      >
                        {day.getDate()}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {events.slice(0, 3).map((ev) => (
                        <Link
                          key={ev.id}
                          to="/trainer/sessions/$sessionId"
                          params={{ sessionId: ev.id }}
                          className={`block rounded px-1 py-0.5 text-[10px] leading-tight truncate ${programColor(ev.programCode ?? "default")}`}
                        >
                          {ev.programName ?? ev.name}
                        </Link>
                      ))}
                      {events.length > 3 && (
                        <span className="text-[10px] text-muted-foreground px-1">
                          +{events.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {view === "list" && (
        <div className="space-y-3">
          {upcomingSessions.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">Aucune session à venir</p>
            </div>
          ) : (
            upcomingSessions.map((s) => (
              <Link
                key={s.id}
                to="/trainer/sessions/$sessionId"
                params={{ sessionId: s.id }}
                className="block rounded-xl border bg-card p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-sm">{s.programName ?? s.name}</h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDateRange(s.startDate, s.endDate)}
                      </span>
                      {s.remote ? (
                        <span className="inline-flex items-center gap-1">
                          <Wifi className="h-3.5 w-3.5" />
                          En ligne
                        </span>
                      ) : (s.placeName || s.place) ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {s.placeName ?? s.place}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {s.participantCount}
                      </span>
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {(() => {
                      const now = Date.now();
                      const start = s.startDate ? new Date(s.startDate).getTime() : 0;
                      const end = s.endDate ? new Date(s.endDate).getTime() : start;
                      if (now < start) return "À venir";
                      if (now <= end + 86400000) return "En cours";
                      return "Terminée";
                    })()}
                  </Badge>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
