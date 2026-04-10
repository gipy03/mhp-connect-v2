import { describe, it, expect } from "vitest";
import {
  activeAssignment,
  invoiceLabel,
  type EnrollmentWithAssignments,
  type SessionAssignment,
} from "../hooks/useEnrollments";

const makeAssignment = (overrides: Partial<SessionAssignment>): SessionAssignment => ({
  id: "a1",
  enrollmentId: "e1",
  sessionId: "s1",
  status: "assigned",
  participationMode: null,
  assignedAt: "2025-01-01",
  cancelledAt: null,
  rescheduledFrom: null,
  createdAt: null,
  ...overrides,
});

const makeEnrollment = (overrides: Partial<EnrollmentWithAssignments>): EnrollmentWithAssignments => ({
  id: "e1",
  userId: "u1",
  programCode: "HB1",
  status: "active",
  pricingTierUsed: null,
  bexioInvoiceId: null,
  bexioDocumentNr: null,
  bexioTotal: null,
  bexioNetworkLink: null,
  enrolledAt: "2025-01-01",
  cancelledAt: null,
  createdAt: null,
  updatedAt: null,
  sessionAssignments: [],
  ...overrides,
});

describe("activeAssignment", () => {
  it("returns the assigned session", () => {
    const enrollment = makeEnrollment({
      sessionAssignments: [
        makeAssignment({ id: "a1", status: "cancelled" }),
        makeAssignment({ id: "a2", status: "assigned" }),
      ],
    });
    expect(activeAssignment(enrollment)?.id).toBe("a2");
  });

  it("returns undefined when no assigned session", () => {
    const enrollment = makeEnrollment({
      sessionAssignments: [makeAssignment({ status: "cancelled" })],
    });
    expect(activeAssignment(enrollment)).toBeUndefined();
  });

  it("returns undefined for empty assignments", () => {
    const enrollment = makeEnrollment({ sessionAssignments: [] });
    expect(activeAssignment(enrollment)).toBeUndefined();
  });
});

describe("invoiceLabel", () => {
  it('returns "Remboursé" for refunded enrollments', () => {
    const result = invoiceLabel(makeEnrollment({ status: "refunded" }));
    expect(result.label).toBe("Remboursé");
    expect(result.variant).toBe("destructive");
  });

  it('returns "Facturé" when bexioDocumentNr exists', () => {
    const result = invoiceLabel(
      makeEnrollment({ status: "active", bexioDocumentNr: "INV-001" })
    );
    expect(result.label).toBe("Facturé");
    expect(result.variant).toBe("secondary");
  });

  it('returns "En attente" for active enrollment without invoice', () => {
    const result = invoiceLabel(makeEnrollment({ status: "active" }));
    expect(result.label).toBe("En attente");
    expect(result.variant).toBe("warning");
  });

  it('refunded takes priority over bexioDocumentNr', () => {
    const result = invoiceLabel(
      makeEnrollment({ status: "refunded", bexioDocumentNr: "INV-001" })
    );
    expect(result.label).toBe("Remboursé");
  });
});
