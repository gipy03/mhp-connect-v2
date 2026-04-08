import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionAssignment {
  id: string;
  enrollmentId: string;
  /** DigiForma session ID — use to reference the external session */
  sessionId: string;
  /** assigned | cancelled | attended | noshow */
  status: string;
  assignedAt: string;
  cancelledAt: string | null;
  /** Previous sessionId when rescheduled — audit trail */
  rescheduledFrom: string | null;
  createdAt: string | null;
}

export interface EnrollmentWithAssignments {
  id: string;
  userId: string;
  /** DigiForma programme code — used as display identifier */
  programCode: string;
  /** active | completed | refunded */
  status: string;
  pricingTierUsed: string | null;
  bexioInvoiceId: string | null;
  /** Set once the invoice is issued in Bexio */
  bexioDocumentNr: string | null;
  bexioTotal: string | null;
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
