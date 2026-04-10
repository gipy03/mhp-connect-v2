import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface ConversationParticipant {
  userId: string;
  firstName: string | null;
  lastName: string | null;
}

export interface ConversationLastMessage {
  body: string;
  senderId: string;
  senderName: string;
  createdAt: string | null;
}

export interface ConversationListItem {
  id: string;
  title: string | null;
  isGroup: boolean;
  createdBy: string | null;
  lastMessageAt: string | null;
  createdAt: string | null;
  lastMessage: ConversationLastMessage | null;
  participants: ConversationParticipant[];
  unreadCount: number;
}

export interface MessageItem {
  id: string;
  conversationId: string;
  senderId: string;
  senderFirstName: string | null;
  senderLastName: string | null;
  body: string;
  createdAt: string | null;
}

export interface MessagesResponse {
  items: MessageItem[];
  hasMore: boolean;
}

export const CONVERSATIONS_KEY = ["conversations"] as const;
export const MESSAGES_KEY = ["messages"] as const;
export const UNREAD_COUNT_KEY = ["messages-unread-count"] as const;

export function useConversations() {
  return useQuery<ConversationListItem[]>({
    queryKey: CONVERSATIONS_KEY,
    queryFn: () => api.get<ConversationListItem[]>("/messages"),
    staleTime: 15_000,
    refetchInterval: 15_000,
  });
}

export function useMessages(conversationId: string | null) {
  return useInfiniteQuery<MessagesResponse, Error, { pages: MessagesResponse[]; pageParams: (string | undefined)[] }, readonly (string | null)[], string | undefined>({
    queryKey: [...MESSAGES_KEY, conversationId],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      if (pageParam) params.set("cursor", pageParam);
      params.set("limit", "50");
      const qs = params.toString();
      return api.get<MessagesResponse>(`/messages/${conversationId}/messages?${qs}`);
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || lastPage.items.length === 0) return undefined;
      return lastPage.items[lastPage.items.length - 1].createdAt;
    },
    enabled: !!conversationId,
    staleTime: 5_000,
    refetchInterval: 5_000,
  });
}

export function useMessagesUnreadCount(enabled = true) {
  return useQuery<{ count: number }>({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: () => api.get<{ count: number }>("/messages/unread-count"),
    staleTime: 30_000,
    refetchInterval: enabled ? 30_000 : false,
    enabled,
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { participantIds: string[]; title?: string }) =>
      api.post<{ id: string }>("/messages", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      conversationId,
      body,
    }: {
      conversationId: string;
      body: string;
    }) => api.post<MessageItem>(`/messages/${conversationId}/messages`, { body }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [...MESSAGES_KEY, vars.conversationId] });
      qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) =>
      api.post<{ ok: boolean }>(`/messages/${conversationId}/read`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      qc.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
    },
  });
}

export function useAddParticipants() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      conversationId,
      userIds,
    }: {
      conversationId: string;
      userIds: string[];
    }) =>
      api.post<{ ok: boolean }>(`/messages/${conversationId}/participants`, {
        userIds,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}

export function useRemoveParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      conversationId,
      userId,
    }: {
      conversationId: string;
      userId: string;
    }) =>
      api.delete<{ ok: boolean }>(
        `/messages/${conversationId}/participants/${userId}`
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}

export function useLeaveConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) =>
      api.post<{ ok: boolean }>(`/messages/${conversationId}/leave`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}
