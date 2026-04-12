import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Calendar, MapPin, Wifi, Users, ChevronRight } from "lucide-react";
import { useInstructorSessions } from "@/hooks/useInstructor";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function SessionsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-start gap-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="ml-auto h-5 w-16 rounded-full" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-36" />
          </div>
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return "Dates non définies";
  const s = new Date(start);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  if (!end || start === end) return s.toLocaleDateString("fr-CH", opts);
  const e = new Date(end);
  return `${s.toLocaleDateString("fr-CH", opts)} — ${e.toLocaleDateString("fr-CH", opts)}`;
}

function sessionStatus(startDate: string | null, endDate: string | null): { label: string; variant: "default" | "secondary" | "outline" } {
  if (!startDate) return { label: "Non planifiée", variant: "outline" };
  const now = Date.now();
  const start = new Date(startDate).getTime();
  const end = endDate ? new Date(endDate).getTime() : start;
  if (now < start) return { label: "À venir", variant: "default" };
  if (now <= end + 86400000) return { label: "En cours", variant: "secondary" };
  return { label: "Terminée", variant: "outline" };
}

export default function TrainerSessions() {
  const { sessions, isLoading, isError } = useInstructorSessions();

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up = sessions.filter((s) => {
      const end = s.endDate ? new Date(s.endDate).getTime() : s.startDate ? new Date(s.startDate).getTime() : 0;
      return end + 86400000 >= now;
    });
    const done = sessions.filter((s) => {
      const end = s.endDate ? new Date(s.endDate).getTime() : s.startDate ? new Date(s.startDate).getTime() : 0;
      return end + 86400000 < now;
    });
    up.sort((a, b) => {
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });
    done.sort((a, b) => {
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    });
    return { upcoming: up, past: done };
  }, [sessions]);

  if (isLoading) {
    return (
      <div className="max-w-3xl space-y-6 pb-12">
        <div>
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <SessionsSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
        Impossible de charger vos sessions.
      </div>
    );
  }

  const renderSession = (s: typeof sessions[number]) => {
    const status = sessionStatus(s.startDate, s.endDate);
    return (
      <Link
        key={s.id}
        to="/trainer/sessions/$sessionId"
        params={{ sessionId: s.id }}
        className="block rounded-xl border bg-card overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
      >
        <div className="p-4 sm:p-5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <h3 className="font-semibold text-sm leading-tight line-clamp-2">
                {s.programName ?? s.name ?? "Session"}
              </h3>
              {s.code && (
                <p className="text-xs text-muted-foreground font-mono">{s.code}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={status.variant}>{status.label}</Badge>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {formatDateRange(s.startDate, s.endDate)}
            </span>
            {s.remote ? (
              <span className="inline-flex items-center gap-1.5">
                <Wifi className="h-3.5 w-3.5" />
                En ligne
              </span>
            ) : (s.placeName || s.place) ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {s.placeName ?? s.place}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {s.participantCount} participant{s.participantCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="max-w-3xl space-y-8 pb-12 animate-page-enter">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Mes sessions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Les sessions de formation auxquelles vous êtes assigné(e).
        </p>
      </div>

      {sessions.length === 0 && (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">Aucune session assignée</p>
          <p className="text-xs text-muted-foreground mt-1">
            Vous n'avez actuellement aucune session de formation assignée.
          </p>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Sessions à venir ({upcoming.length})
          </h2>
          <div className="space-y-3">
            {upcoming.map(renderSession)}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Sessions passées ({past.length})
          </h2>
          <div className="space-y-3">
            {past.map(renderSession)}
          </div>
        </div>
      )}
    </div>
  );
}
