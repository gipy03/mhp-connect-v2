import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionDetail {
  digiformaId: string;
  name: string | null;
  startDate: string | null;
  endDate: string | null;
  place: string | null;
  placeName: string | null;
  remote: boolean | null;
}

export interface SessionAssignment {
  id: string;
  enrollmentId: string;
  sessionId: string;
  status: string;
  participationMode: "in_person" | "remote" | null;
  assignedAt: string;
  cancelledAt: string | null;
  rescheduledFrom: string | null;
  createdAt: string | null;
  session?: SessionDetail;
}

export interface EnrollmentWithAssignments {
  id: string;
  userId: string;
  programCode: string;
  status: string;
  pricingTierUsed: string | null;
  bexioInvoiceId: string | null;
  bexioDocumentNr: string | null;
  bexioTotal: string | null;
  bexioNetworkLink: string | null;
  enrolledAt: string;
  cancelledAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  sessionAssignments: SessionAssignment[];
}

export const ENROLLMENTS_QUERY_KEY = ["enrollments", "me"] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The active session assignment, if any. */
export function activeAssignment(
  enrollment: EnrollmentWithAssignments
): SessionAssignment | undefined {
  return enrollment.sessionAssignments.find((a) => a.status === "assigned");
}

/** Derive a human-readable invoice status from enrollment data. */
export function invoiceLabel(
  enrollment: EnrollmentWithAssignments
): { label: string; variant: "success" | "warning" | "destructive" | "secondary" } {
  if (enrollment.status === "refunded")
    return { label: "Remboursé", variant: "destructive" };
  if (enrollment.bexioDocumentNr)
    return { label: "Facturé", variant: "secondary" };
  return { label: "En attente", variant: "warning" };
}

// ---------------------------------------------------------------------------
// useEnrollments
// ---------------------------------------------------------------------------

export function useEnrollments() {
  const queryClient = useQueryClient();

  const query = useQuery<EnrollmentWithAssignments[]>({
    queryKey: ENROLLMENTS_QUERY_KEY,
    queryFn: () =>
      api.get<EnrollmentWithAssignments[]>("/enrollments/me"),
    staleTime: 2 * 60_000, // 2 min
  });

  const cancelSessionMutation = useMutation({
    mutationFn: (enrollmentId: string) =>
      api.post<SessionAssignment>(
        `/enrollments/${enrollmentId}/cancel-session`,
        {}
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ENROLLMENTS_QUERY_KEY }),
  });

  const requestRefundMutation = useMutation({
    mutationFn: ({
      enrollmentId,
      reason,
    }: {
      enrollmentId: string;
      reason?: string;
    }) =>
      api.post<{ id: string }>(
        `/enrollments/${enrollmentId}/refund-request`,
        { reason }
      ),
  });

  return {
    enrollments: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    cancelSession: cancelSessionMutation,
    requestRefund: requestRefundMutation,
  };
}

// ---------------------------------------------------------------------------
// useExtranetUrl — DigiForma student portal link
// ---------------------------------------------------------------------------

export function useExtranetUrl() {
  return useQuery<{ url: string | null }>({
    queryKey: ["extranet-url"],
    queryFn: () => api.get<{ url: string | null }>("/enrollments/extranet-url"),
    staleTime: 10 * 60_000,
  });
}

// ---------------------------------------------------------------------------
// useExtranetSessions — per-session DigiForma learner portal URLs
// ---------------------------------------------------------------------------

export interface ExtranetSession {
  digiformaSessionId: string;
  programCode: string | null;
  programName: string | null;
  startDate: string | null;
  endDate: string | null;
  extranetUrl: string;
}

export function useExtranetSessions() {
  return useQuery<{ sessions: ExtranetSession[] }>({
    queryKey: ["extranet-sessions"],
    queryFn: () =>
      api.get<{ sessions: ExtranetSession[] }>("/enrollments/me/extranet-sessions"),
    staleTime: 10 * 60_000,
  });
}
