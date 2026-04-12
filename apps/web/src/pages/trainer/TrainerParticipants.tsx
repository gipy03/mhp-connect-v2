import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Search, Users, Monitor, MapPin } from "lucide-react";
import { useInstructorParticipants } from "@/hooks/useInstructor";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function ParticipantsSkeleton() {
  return (
    <div className="rounded-xl border overflow-hidden">
      <div className="border-b bg-muted/40 px-4 py-3">
        <Skeleton className="h-4 w-32" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 w-16 rounded-full ml-auto" />
        </div>
      ))}
    </div>
  );
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  assigned: { label: "Assigné", variant: "default" },
  attended: { label: "Présent", variant: "secondary" },
  cancelled: { label: "Annulé", variant: "destructive" },
  noshow: { label: "Absent", variant: "destructive" },
};

const MODE_LABELS: Record<string, string> = {
  remote: "En ligne",
  "in-person": "Présentiel",
  presentiel: "Présentiel",
};

export default function TrainerParticipants({ sessionId }: { sessionId: string }) {
  const { participants, isLoading, isError } = useInstructorParticipants(sessionId);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return participants;
    const q = search.toLowerCase();
    return participants.filter(
      (p) =>
        (p.firstName?.toLowerCase().includes(q)) ||
        (p.lastName?.toLowerCase().includes(q)) ||
        (p.email?.toLowerCase().includes(q))
    );
  }, [participants, search]);

  if (isLoading) {
    return (
      <div className="max-w-3xl space-y-6 pb-12">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded" />
          <div>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32 mt-1" />
          </div>
        </div>
        <ParticipantsSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-3xl space-y-4 pb-12">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/trainer/sessions">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Retour aux sessions
          </Link>
        </Button>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
          Impossible de charger les participants de cette session.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6 pb-12 animate-page-enter">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" className="shrink-0 mt-0.5" asChild>
          <Link to="/trainer/sessions">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Participants</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {participants.length} participant{participants.length !== 1 ? "s" : ""} inscrit{participants.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {participants.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un participant…"
            className="pl-9"
          />
        </div>
      )}

      {participants.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <Users className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">Aucun participant</p>
          <p className="text-xs text-muted-foreground mt-1">
            Aucun stagiaire n'est encore inscrit à cette session.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_1fr_auto_auto] gap-4 border-b bg-muted/40 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Nom</span>
            <span>Email</span>
            <span>Mode</span>
            <span>Statut</span>
          </div>
          {filtered.map((p) => {
            const statusInfo = STATUS_LABELS[p.assignmentStatus] ?? { label: p.assignmentStatus, variant: "outline" as const };
            return (
              <div
                key={p.assignmentId}
                className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-1 sm:gap-4 items-center px-4 py-3 border-b last:border-b-0 hover:bg-muted/30 transition-colors"
              >
                <div className="font-medium text-sm">
                  {p.firstName || p.lastName
                    ? `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim()
                    : "—"}
                </div>
                <div className="text-sm text-muted-foreground truncate">
                  {p.email ?? "—"}
                </div>
                <div>
                  {p.participationMode ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      {p.participationMode === "remote" ? (
                        <Monitor className="h-3 w-3" />
                      ) : (
                        <MapPin className="h-3 w-3" />
                      )}
                      {MODE_LABELS[p.participationMode] ?? p.participationMode}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <div>
                  <Badge variant={statusInfo.variant} className="text-[10px] px-1.5 py-0">
                    {statusInfo.label}
                  </Badge>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && search.trim() && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Aucun participant correspondant à « {search} ».
            </div>
          )}
        </div>
      )}
    </div>
  );
}
