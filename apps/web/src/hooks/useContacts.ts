import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface ContactListItem {
  id: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  createdAt: string | null;
}

export interface ContactRequestItem {
  id: string;
  requesterId: string;
  requesterFirstName: string | null;
  requesterLastName: string | null;
  message: string | null;
  createdAt: string | null;
}

export const CONTACTS_KEY = ["contacts"] as const;
export const CONTACT_REQUESTS_KEY = ["contact-requests"] as const;

export function useContacts() {
  return useQuery<ContactListItem[]>({
    queryKey: CONTACTS_KEY,
    queryFn: () => api.get<ContactListItem[]>("/contacts"),
    staleTime: 30_000,
  });
}

export function useContactRequests() {
  return useQuery<ContactRequestItem[]>({
    queryKey: CONTACT_REQUESTS_KEY,
    queryFn: () => api.get<ContactRequestItem[]>("/contacts/requests"),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useSendContactRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { recipientId: string; message?: string }) =>
      api.post<{ id: string }>("/contacts/request", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CONTACTS_KEY });
      qc.invalidateQueries({ queryKey: CONTACT_REQUESTS_KEY });
    },
  });
}

export function useAcceptContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contactId: string) =>
      api.post<{ ok: boolean }>(`/contacts/${contactId}/accept`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CONTACTS_KEY });
      qc.invalidateQueries({ queryKey: CONTACT_REQUESTS_KEY });
    },
  });
}

export function useRejectContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contactId: string) =>
      api.post<{ ok: boolean }>(`/contacts/${contactId}/reject`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CONTACTS_KEY });
      qc.invalidateQueries({ queryKey: CONTACT_REQUESTS_KEY });
    },
  });
}
