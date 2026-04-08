import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types — mirrors the `notifications` DB table (channel = "internal" only)
// ---------------------------------------------------------------------------

export interface AppNotification {
  id: string;
  recipientId: string;
  templateId: string | null;
  channel: string;
  /** pending | sent | failed | read */
  status: string;
  /** Merge data: { firstName?, programName?, sessionDates?, ... } */
  mergeData: Record<string, unknown> | null;
  sentAt: string | null;
  createdAt: string | null;
}

export const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;

// ---------------------------------------------------------------------------
// useNotifications
// ---------------------------------------------------------------------------

export function useNotifications() {
  const queryClient = useQueryClient();

  const query = useQuery<AppNotification[]>({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: () => api.get<AppNotification[]>("/notifications"),
    staleTime: 60_000, // 1 min — bell badge tolerate mild staleness
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) =>
      api.patch<void>(`/notifications/${id}/read`, {}),
    onSuccess: (_data, id) => {
      // Optimistic update — flip the item to "read" immediately
      queryClient.setQueryData<AppNotification[]>(
        NOTIFICATIONS_QUERY_KEY,
        (prev) =>
          prev?.map((n) => (n.id === id ? { ...n, status: "read" } : n)) ?? []
      );
    },
  });

  const notifications = query.data ?? [];
  const unreadCount = notifications.filter((n) => n.status !== "read").length;

  return {
    notifications,
    unreadCount,
    isLoading: query.isLoading,
    markRead: markReadMutation,
  };
}
