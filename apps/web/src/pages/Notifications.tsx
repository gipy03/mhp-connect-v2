import { useState } from "react";
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Clock,
  Loader2,
  Award,
  CalendarDays,
  BookOpen,
  RefreshCw,
  CreditCard,
} from "lucide-react";
import { useNotifications, type AppNotification } from "@/hooks/useNotifications";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FilterTab = "all" | "unread" | "read";

const EVENT_META: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  enrollment_confirmation: { icon: BookOpen, label: "Inscription confirmée" },
  session_rescheduled: { icon: CalendarDays, label: "Session reprogrammée" },
  session_reminder: { icon: Clock, label: "Rappel de session" },
  credential_issued: { icon: Award, label: "Certification délivrée" },
  refund_update: { icon: CreditCard, label: "Mise à jour remboursement" },
};

function notificationTitle(n: AppNotification): string {
  const merge = (n.mergeData ?? {}) as Record<string, unknown>;
  const templateId = n.templateId;

  for (const [eventType, meta] of Object.entries(EVENT_META)) {
    if (templateId?.includes(eventType) || merge.eventType === eventType) {
      return meta.label;
    }
  }

  if (merge.programName || merge.programCode) {
    return (merge.programName as string) ?? (merge.programCode as string) ?? "Notification";
  }

  return "Notification";
}

function notificationDescription(n: AppNotification): string | null {
  const merge = (n.mergeData ?? {}) as Record<string, unknown>;
  const parts: string[] = [];

  const programName = merge.programName as string | undefined;
  const programCode = merge.programCode as string | undefined;
  if (programName || programCode) {
    parts.push((programName ?? programCode)!);
  }

  const sessionDate = merge.sessionDate as string | undefined;
  if (sessionDate) {
    parts.push(
      `le ${new Date(sessionDate).toLocaleDateString("fr-CH", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })}`
    );
  }

  const credentialName = merge.credentialName as string | undefined;
  if (credentialName) {
    parts.push(credentialName);
  }

  if (merge.approved !== undefined) {
    const approved = merge.approved === true || merge.approved === "true";
    parts.push(approved ? "Approuvé" : "Refusé");
  }

  return parts.length > 0 ? parts.join(" — ") : null;
}

function notificationIcon(n: AppNotification) {
  const merge = (n.mergeData ?? {}) as Record<string, unknown>;

  for (const [eventType, meta] of Object.entries(EVENT_META)) {
    if (n.templateId?.includes(eventType) || merge.eventType === eventType) {
      return meta.icon;
    }
  }

  if (merge.programName || merge.programCode) return BookOpen;
  if (merge.credentialName) return Award;

  return Bell;
}

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "À l'instant";
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays < 7) return `Il y a ${diffDays}j`;

  return date.toLocaleDateString("fr-CH", {
    day: "numeric",
    month: "short",
    year: diffDays > 365 ? "numeric" : undefined,
  });
}

function NotificationItem({
  notification,
  onMarkRead,
  isMarkingRead,
}: {
  notification: AppNotification;
  onMarkRead: (id: string) => void;
  isMarkingRead: boolean;
}) {
  const isRead = notification.status === "read";
  const Icon = notificationIcon(notification);
  const title = notificationTitle(notification);
  const description = notificationDescription(notification);

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4 transition-colors",
        isRead ? "bg-card" : "bg-primary/[0.03] border-primary/20"
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg mt-0.5",
          isRead ? "bg-muted" : "bg-primary/10"
        )}
      >
        <Icon
          className={cn(
            "h-4 w-4",
            isRead ? "text-muted-foreground" : "text-primary"
          )}
        />
      </div>

      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "text-sm leading-snug",
              isRead ? "text-muted-foreground" : "font-medium"
            )}
          >
            {title}
          </p>
          <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
            {formatRelativeDate(notification.sentAt ?? notification.createdAt)}
          </span>
        </div>

        {description && (
          <p className="text-xs text-muted-foreground truncate">{description}</p>
        )}
      </div>

      {!isRead && (
        <Button
          size="sm"
          variant="ghost"
          className="shrink-0 h-7 text-xs text-muted-foreground hover:text-foreground"
          disabled={isMarkingRead}
          onClick={() => onMarkRead(notification.id)}
          title="Marquer comme lu"
        >
          {isMarkingRead ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Check className="h-3 w-3" />
          )}
        </Button>
      )}
    </div>
  );
}

export default function Notifications() {
  const { notifications, unreadCount, isLoading, isError, refetch, markRead } = useNotifications();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [markingId, setMarkingId] = useState<string | null>(null);

  const handleMarkRead = (id: string) => {
    setMarkingId(id);
    markRead.mutate(id, {
      onSettled: () => setMarkingId(null),
    });
  };

  const [markingAllRead, setMarkingAllRead] = useState(false);

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => n.status !== "read");
    if (unread.length === 0) return;
    setMarkingAllRead(true);
    try {
      await Promise.all(unread.map((n) => markRead.mutateAsync(n.id)));
    } finally {
      setMarkingAllRead(false);
    }
  };

  const filtered = notifications.filter((n) => {
    if (filter === "unread") return n.status !== "read";
    if (filter === "read") return n.status === "read";
    return true;
  });

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-5 pb-12 animate-page-enter">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-16 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-16 rounded-full" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border bg-card p-4">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-2xl space-y-5 pb-12">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Retrouvez l'historique de vos notifications.
          </p>
        </div>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive flex items-center justify-between">
          <span>Impossible de charger vos notifications. Réessayez dans un instant.</span>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  const tabs: { value: FilterTab; label: string; count?: number }[] = [
    { value: "all", label: "Toutes", count: notifications.length },
    { value: "unread", label: "Non lues", count: unreadCount },
    { value: "read", label: "Lues" },
  ];

  return (
    <div className="max-w-2xl space-y-5 pb-12 animate-page-enter">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Retrouvez l'historique de vos notifications.
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 text-xs"
            disabled={markingAllRead}
            onClick={handleMarkAllRead}
          >
            <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
            Tout marquer comme lu
          </Button>
        )}
      </div>

      <div className="flex items-center gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={cn(
              "px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
              filter === tab.value
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={cn(
                  "ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-medium",
                  filter === tab.value
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
            <BellOff className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">
            {filter === "unread"
              ? "Aucune notification non lue"
              : filter === "read"
                ? "Aucune notification lue"
                : "Aucune notification"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {filter === "all"
              ? "Vous n'avez pas encore reçu de notifications."
              : "Changez de filtre pour voir d'autres notifications."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onMarkRead={handleMarkRead}
              isMarkingRead={markingId === n.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
