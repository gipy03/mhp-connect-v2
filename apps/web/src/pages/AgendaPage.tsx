import { useState, useMemo, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, MapPin, Wifi, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePrograms, type CalendarSession } from "@/hooks/useCatalogue";
import { formatSessionDateRange } from "@/hooks/useCatalogue";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SessionWithProgram extends CalendarSession {
  programCode: string;
  programName: string;
}

// ---------------------------------------------------------------------------
// Color palette — deterministic per program code
// ---------------------------------------------------------------------------

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

function programColor(code: string): string {
  let h = 0;
  for (const c of code) h = (h * 31 + c.charCodeAt(0)) & 0xff;
  return PALETTE[h % PALETTE.length];
}

// ---------------------------------------------------------------------------
// Extract all sessions from the catalogue, flattened
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Get the concrete dates for a session (from dates[] or startDate–endDate range)
// ---------------------------------------------------------------------------

function sessionDateStrings(session: SessionWithProgram): string[] {
  if (session.dates.length > 0) {
    return session.dates.map((d) => d.date); // "2025-03-14"
  }
  if (!session.startDate) return [];
  const dates: string[] = [];
  const start = new Date(session.startDate);
  const end = session.endDate ? new Date(session.endDate) : start;
  for (
    let d = new Date(start);
    d <= end;
    d.setDate(d.getDate() + 1)
  ) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

// ---------------------------------------------------------------------------
// Build 42-cell calendar grid (6 rows × 7 cols, Mon-first)
// ---------------------------------------------------------------------------

function buildCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const dowOffset = (firstDay.getDay() + 6) % 7; // Mon=0 … Sun=6
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

const DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

// ---------------------------------------------------------------------------
// Session detail dialog
// ---------------------------------------------------------------------------

interface SessionDialogProps {
  session: SessionWithProgram | null;
  onClose: () => void;
}

function SessionDialog({ session, onClose }: SessionDialogProps) {
  if (!session) return null;

  return (
    <Dialog open={!!session} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{session.programName}</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {session.programCode}
            {session.code ? ` — Session ${session.code}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-2 space-y-4">
          {/* Dates */}
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
                      <span>
                        {d.startTime} – {d.endTime}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Location */}
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
                <span>
                  {session.placeName ?? session.place ?? "Lieu à confirmer"}
                </span>
              </div>
            )}
            {session.inter && (
              <p className="text-xs text-muted-foreground">
                Session inter-entreprises
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <Button asChild>
            <Link
              to="/catalogue/$code"
              params={{ code: session.programCode }}
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

// ---------------------------------------------------------------------------
// Calendar day cell
// ---------------------------------------------------------------------------

interface DayCellProps {
  date: Date;
  isCurrentMonth: boolean;
  sessions: SessionWithProgram[];
  onSessionClick: (s: SessionWithProgram) => void;
}

function DayCell({ date, isCurrentMonth, sessions, onSessionClick }: DayCellProps) {
  const today = dateStr(new Date());
  const isToday = dateStr(date) === today;

  return (
    <div
      className={
        "min-h-[80px] border-r border-b p-1 " +
        (isCurrentMonth ? "bg-background" : "bg-muted/30")
      }
    >
      {/* Day number */}
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

      {/* Session blocks (max 3 visible) */}
      <div className="space-y-0.5">
        {sessions.slice(0, 3).map((s, idx) => (
          <button
            key={`${s.id}-${dateStr(date)}-${idx}`}
            onClick={() => onSessionClick(s)}
            className={
              "w-full text-left rounded px-1 py-0.5 text-[10px] leading-tight truncate " +
              programColor(s.programCode)
            }
            title={`${s.programName}${s.placeName ? ` — ${s.placeName}` : ""}`}
          >
            {s.programName}
          </button>
        ))}
        {sessions.length > 3 && (
          <button
            onClick={() => onSessionClick(sessions[3])}
            className="w-full text-left text-[10px] text-muted-foreground px-1"
          >
            +{sessions.length - 3} autres
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AgendaPage — shared between /agenda (public) and /user/agenda (member)
// ---------------------------------------------------------------------------

export default function AgendaPage() {
  const { isAuthenticated } = useAuth();
  const { data: categories, isLoading } = usePrograms();
  const [selected, setSelected] = useState<SessionWithProgram | null>(null);

  // Current month state
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  // Flatten sessions
  const sessions = useMemo(() => extractSessions(categories), [categories]);

  // Build day → sessions map for this month's grid
  const days = useMemo(() => buildCalendarDays(year, month), [year, month]);

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, SessionWithProgram[]>();
    for (const s of sessions) {
      for (const ds of sessionDateStrings(s)) {
        const arr = map.get(ds) ?? [];
        arr.push(s);
        map.set(ds, arr);
      }
    }
    return map;
  }, [sessions]);

  // SEO (public only)
  useEffect(() => {
    if (!isAuthenticated) {
      const prev = document.title;
      document.title = "Agenda des formations — mhp | connect";
      return () => {
        document.title = prev;
      };
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

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agenda</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sessions de formation disponibles
          </p>
        </div>
        {/* Month navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-md border hover:bg-accent transition-colors"
            aria-label="Mois précédent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[140px] text-center text-sm font-medium">
            {MONTH_NAMES[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-md border hover:bg-accent transition-colors"
            aria-label="Mois suivant"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-5 w-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
        </div>
      ) : (
        /* Calendar grid */
        <div className="rounded-xl border overflow-hidden">
          {/* Day-of-week headers */}
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

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {days.map((day, i) => (
              <DayCell
                key={i}
                date={day}
                isCurrentMonth={day.getMonth() === month}
                sessions={sessionsByDay.get(dateStr(day)) ?? []}
                onSessionClick={setSelected}
              />
            ))}
          </div>
        </div>
      )}

      {/* Color legend */}
      {!isLoading && sessions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Array.from(new Set(sessions.map((s) => s.programCode))).map(
            (code) => {
              const prog = sessions.find((s) => s.programCode === code);
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
        </div>
      )}

      {/* Session detail dialog */}
      <SessionDialog session={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
