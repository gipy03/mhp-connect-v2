import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface CommunityEventData {
  id: string;
  title: string;
  description: string | null;
  eventType: string;
  location: string | null;
  locationAddress: string | null;
  isRemote: boolean;
  meetingUrl: string | null;
  startAt: string;
  endAt: string;
  maxAttendees: number | null;
  createdBy: string | null;
  programCode: string | null;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  rsvpCounts?: { attending: number; maybe: number; not_attending: number };
}

export interface RsvpData {
  id: string;
  eventId: string;
  userId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface RsvpWithUser {
  id: string;
  userId: string;
  status: string;
  createdAt: string;
  email?: string;
  firstName: string | null;
  lastName?: string | null;
}

export function useEvents(filters?: {
  from?: string;
  to?: string;
  eventType?: string;
  programCode?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.from) params.set("from", filters.from);
  if (filters?.to) params.set("to", filters.to);
  if (filters?.eventType) params.set("eventType", filters.eventType);
  if (filters?.programCode) params.set("programCode", filters.programCode);
  const qs = params.toString();

  return useQuery<CommunityEventData[]>({
    queryKey: ["events", qs],
    queryFn: () => api.get<CommunityEventData[]>(`/events${qs ? `?${qs}` : ""}`),
    staleTime: 2 * 60_000,
  });
}

export interface MergedEventsResponse {
  communityEvents: CommunityEventData[];
  trainingSessions: {
    id: string;
    digiformaId: string;
    name: string | null;
    code: string | null;
    programCode: string | null;
    programName: string | null;
    startDate: string | null;
    endDate: string | null;
    place: string | null;
    placeName: string | null;
    remote: boolean | null;
    inter: boolean | null;
    dates: unknown;
  }[];
}

export function useMergedEvents(filters?: {
  from?: string;
  to?: string;
  eventType?: string;
  programCode?: string;
  location?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.from) params.set("from", filters.from);
  if (filters?.to) params.set("to", filters.to);
  if (filters?.eventType) params.set("eventType", filters.eventType);
  if (filters?.programCode) params.set("programCode", filters.programCode);
  if (filters?.location) params.set("location", filters.location);
  const qs = params.toString();

  return useQuery<MergedEventsResponse>({
    queryKey: ["events", "merged", qs],
    queryFn: () => api.get<MergedEventsResponse>(`/events/merged${qs ? `?${qs}` : ""}`),
    staleTime: 2 * 60_000,
  });
}

export function useEvent(id: string) {
  return useQuery<CommunityEventData>({
    queryKey: ["events", id],
    queryFn: () => api.get<CommunityEventData>(`/events/${id}`),
    enabled: !!id,
  });
}

export function useMyRsvp(eventId: string, enabled = true) {
  return useQuery<RsvpData | null>({
    queryKey: ["events", eventId, "my-rsvp"],
    queryFn: () => api.get<RsvpData | null>(`/events/${eventId}/my-rsvp`),
    enabled: !!eventId && enabled,
  });
}

export function useEventRsvps(eventId: string) {
  return useQuery<RsvpWithUser[]>({
    queryKey: ["events", eventId, "rsvps"],
    queryFn: () => api.get<RsvpWithUser[]>(`/events/${eventId}/rsvps`),
    enabled: !!eventId,
  });
}

export function useRsvpMutation(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: string) =>
      api.post<RsvpData>(`/events/${eventId}/rsvp`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events", eventId] });
      qc.invalidateQueries({ queryKey: ["events", eventId, "my-rsvp"] });
      qc.invalidateQueries({ queryKey: ["events", eventId, "rsvps"] });
    },
  });
}

export function useCancelRsvpMutation(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`/events/${eventId}/rsvp`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events", eventId] });
      qc.invalidateQueries({ queryKey: ["events", eventId, "my-rsvp"] });
      qc.invalidateQueries({ queryKey: ["events", eventId, "rsvps"] });
    },
  });
}

export function useAdminEvents() {
  return useQuery<CommunityEventData[]>({
    queryKey: ["admin", "events"],
    queryFn: () => api.get<CommunityEventData[]>("/events/admin/all"),
    staleTime: 30_000,
  });
}

export function useAdminEventReport() {
  return useQuery<(CommunityEventData & { rsvpCounts: { attending: number; maybe: number; not_attending: number } })[]>({
    queryKey: ["admin", "events", "report"],
    queryFn: () => api.get("/events/admin/report"),
    staleTime: 30_000,
  });
}

export function useCreateEventMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<CommunityEventData>("/events/admin", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "events"] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useUpdateEventMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.put<CommunityEventData>(`/events/admin/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "events"] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useDeleteEventMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/events/admin/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "events"] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}
