import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Calendar,
  MapPin,
  Monitor,
  Users,
  ArrowUpDown,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ClipboardList,
} from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AdminPageShell, AdminTableSkeleton, AdminEmptyState } from "@/components/AdminPageShell";

interface SessionParticipants {
  assigned: number;
  attended: number;
  cancelled: number;
  noshow: number;
}

interface SessionInstructor {
  id: string;
  name: string;
}

interface AdminSession {
  id: string;
  digiformaId: string;
  name: string | null;
  code: string | null;
  programCode: string | null;
  programName: string | null;
  displayName: string | null;
  startDate: string | null;
  endDate: string | null;
  place: string | null;
  placeName: string | null;
  remote: boolean;
  inter: boolean;
  participants: SessionParticipants;
  instructors: SessionInstructor[];
}

type SortKey = "date" | "program" | "participants" | "location";
type SortDir = "asc" | "desc";
type TimeFilter = "all" | "upcoming" | "past";

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-CH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function totalParticipants(p: SessionParticipants): number {
  return p.assigned + p.attended;
}

export default function AdminSessions() {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const { data: sessions = [], isLoading } = useQuery<AdminSession[]>({
    queryKey: ["admin", "sessions"],
    queryFn: () => api.get<AdminSession[]>("/admin/sessions"),
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const now = new Date();
    let result = sessions;

    if (timeFilter === "upcoming") {
      result = result.filter((s) => s.startDate && new Date(s.startDate) >= now);
    } else if (timeFilter === "past") {
      result = result.filter((s) => s.endDate && new Date(s.endDate) < now);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          (s.displayName ?? s.programName ?? "").toLowerCase().includes(q) ||
          (s.name ?? "").toLowerCase().includes(q) ||
          (s.code ?? "").toLowerCase().includes(q) ||
          (s.programCode ?? "").toLowerCase().includes(q) ||
          (s.placeName ?? s.place ?? "").toLowerCase().includes(q) ||
          s.instructors.some((i) => i.name.toLowerCase().includes(q))
      );
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "date": {
          const aT = a.startDate ? new Date(a.startDate).getTime() : 0;
          const bT = b.startDate ? new Date(b.startDate).getTime() : 0;
          cmp = aT - bT;
          break;
        }
        case "program":
          cmp = (a.displayName ?? a.programName ?? "").localeCompare(
            b.displayName ?? b.programName ?? "",
            "fr"
          );
          break;
        case "participants":
          cmp = totalParticipants(a.participants) - totalParticipants(b.participants);
          break;
        case "location": {
          const aLoc = a.remote ? "En ligne" : a.placeName ?? a.place ?? "";
          const bLoc = b.remote ? "En ligne" : b.placeName ?? b.place ?? "";
          cmp = aLoc.localeCompare(bLoc, "fr");
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [sessions, search, sortKey, sortDir, timeFilter]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/40" />;
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3" />
    ) : (
      <ChevronDown className="h-3 w-3" />
    );
  };

  const extranetBaseUrl = "https://app.digiforma.com/admin/sessions/";

  return (
    <AdminPageShell
      title="Sessions"
      description="Vue d'ensemble de toutes les sessions de formation."
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher session, programme, lieu..."
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            <SelectItem value="upcoming">À venir</SelectItem>
            <SelectItem value="past">Passées</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground ml-auto">
          {filtered.length} session{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      {isLoading ? (
        <AdminTableSkeleton rows={8} cols={6} />
      ) : filtered.length === 0 ? (
        <AdminEmptyState
          icon={ClipboardList}
          title="Aucune session trouvée"
          description="Modifiez vos filtres ou synchronisez les données DigiForma."
        />
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-3 py-2.5">
                    <button
                      className="flex items-center gap-1 text-xs font-medium hover:text-foreground transition-colors"
                      onClick={() => toggleSort("program")}
                    >
                      Programme <SortIcon col="program" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5">
                    <button
                      className="flex items-center gap-1 text-xs font-medium hover:text-foreground transition-colors"
                      onClick={() => toggleSort("date")}
                    >
                      Dates <SortIcon col="date" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 hidden md:table-cell">
                    <button
                      className="flex items-center gap-1 text-xs font-medium hover:text-foreground transition-colors"
                      onClick={() => toggleSort("location")}
                    >
                      Lieu <SortIcon col="location" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 hidden lg:table-cell">
                    <span className="text-xs font-medium">Formateur</span>
                  </th>
                  <th className="px-3 py-2.5">
                    <button
                      className="flex items-center gap-1 text-xs font-medium hover:text-foreground transition-colors"
                      onClick={() => toggleSort("participants")}
                    >
                      <Users className="h-3 w-3" />
                      Inscrits <SortIcon col="participants" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-right">
                    <span className="text-xs font-medium">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((session) => {
                  const total = totalParticipants(session.participants);
                  const isPast = session.endDate && new Date(session.endDate) < new Date();

                  return (
                    <tr
                      key={session.id}
                      className={cn(
                        "border-b last:border-0 hover:bg-muted/20 transition-colors",
                        isPast && "opacity-60"
                      )}
                    >
                      <td className="px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="font-medium text-sm leading-tight truncate max-w-[200px]">
                            {session.displayName ?? session.programName ?? "—"}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">
                            {session.code ?? session.programCode}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3 shrink-0" />
                          <span className="whitespace-nowrap">
                            {formatDate(session.startDate)}
                            {session.endDate && session.endDate !== session.startDate && (
                              <> — {formatDate(session.endDate)}</>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 hidden md:table-cell">
                        {session.remote ? (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Monitor className="h-3 w-3" />
                            En ligne
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate max-w-[120px]">
                              {session.placeName ?? session.place ?? "—"}
                            </span>
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 hidden lg:table-cell">
                        {session.instructors.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {session.instructors.map((i) => (
                              <Badge
                                key={i.id}
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0"
                              >
                                {i.name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={total > 0 ? "secondary" : "outline"}
                            className="text-xs tabular-nums"
                          >
                            <Users className="h-3 w-3 mr-1" />
                            {total}
                          </Badge>
                          {session.participants.cancelled > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              ({session.participants.cancelled} ann.)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          asChild
                        >
                          <a
                            href={`${extranetBaseUrl}${session.digiformaId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            DigiForma
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}
