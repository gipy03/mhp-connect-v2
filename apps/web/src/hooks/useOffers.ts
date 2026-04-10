import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Offer {
  id: string;
  title: string;
  description: string | null;
  partnerName: string;
  partnerLogoUrl: string | null;
  discountText: string | null;
  category: string | null;
  redemptionUrl: string | null;
  redemptionCode: string | null;
  visibility: "all" | "feature_gated";
  requiredFeature: string | null;
  validFrom: string | null;
  validUntil: string | null;
  published: boolean;
  clickCount: number;
  sortOrder: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface OfferFormData {
  title: string;
  description?: string | null;
  partnerName: string;
  partnerLogoUrl?: string | null;
  discountText?: string | null;
  category?: string | null;
  redemptionUrl?: string | null;
  redemptionCode?: string | null;
  visibility?: "all" | "feature_gated";
  requiredFeature?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  published?: boolean;
  sortOrder?: number;
}

export const ADMIN_OFFERS_KEY = ["admin", "offers"] as const;
export const MEMBER_OFFERS_KEY = ["offers"] as const;

export function useAdminOffers() {
  return useQuery<Offer[]>({
    queryKey: ADMIN_OFFERS_KEY,
    queryFn: () => api.get<Offer[]>("/admin/offers"),
    staleTime: 60_000,
  });
}

export function useMemberOffers() {
  return useQuery<Offer[]>({
    queryKey: MEMBER_OFFERS_KEY,
    queryFn: () => api.get<Offer[]>("/offers"),
    staleTime: 2 * 60_000,
  });
}

export function useCreateOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: OfferFormData) => api.post<Offer>("/admin/offers", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_OFFERS_KEY }),
  });
}

export function useUpdateOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: OfferFormData & { id: string }) =>
      api.put<Offer>(`/admin/offers/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_OFFERS_KEY }),
  });
}

export function useToggleOfferPublish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.patch<Offer>(`/admin/offers/${id}/toggle-publish`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_OFFERS_KEY }),
  });
}

export function useDeleteOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/offers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ADMIN_OFFERS_KEY }),
  });
}

export function useTrackOfferClick() {
  return useMutation({
    mutationFn: (id: string) => api.post(`/offers/${id}/track-click`, {}),
  });
}
