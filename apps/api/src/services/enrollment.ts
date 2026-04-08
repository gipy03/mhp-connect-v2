import { and, eq, desc, inArray } from "drizzle-orm";
import {
  programEnrollments,
  programPricing,
  sessionAssignments,
  refundRequests,
  userProfiles,
  users,
  type ProgramEnrollment,
  type SessionAssignment,
  type RefundRequest,
} from "@mhp/shared";
import { queue } from "./notification.js";
import {
  findTraineeByEmail,
  createTrainee,
  addDraftTraineeToSession,
  removeTraineeFromSession,
} from "@mhp/integrations/digiforma";
import {
  findOrCreateContact,
  fetchArticleByInternCode,
  createArticle,
  createAndSendInvoice,
  createCreditNote,
  issueCreditNote,
} from "@mhp/integrations/bexio";
import { db } from "../db.js";
import { AppError } from "../lib/errors.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type EnrollmentWithAssignments = ProgramEnrollment & {
  sessionAssignments: SessionAssignment[];
};

// ---------------------------------------------------------------------------
// enroll — full pipeline
// ---------------------------------------------------------------------------

export async function enroll(
  userId: string,
  programCode: string,
  sessionId: string,
  pricingTierId: string,
  finalAmount?: number
): Promise<ProgramEnrollment> {
  // 1. Load user + profile
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw new AppError("Utilisateur introuvable.", 404);

  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  // 2. Load pricing tier
  const [pricingTier] = await db
    .select()
    .from(programPricing)
    .where(eq(programPricing.id, pricingTierId))
    .limit(1);

  if (!pricingTier) throw new AppError("Tarif introuvable.", 404);
  if (pricingTier.programCode !== programCode) {
    throw new AppError("Le tarif sélectionné ne correspond pas au programme.", 400);
  }

  const invoiceAmount =
    finalAmount ?? parseFloat(String(pricingTier.amount));

  // 3. DigiForma: find or create trainee — FATAL
  let digiformaTrainee = await findTraineeByEmail(user.email);
  if (!digiformaTrainee) {
    digiformaTrainee = await createTrainee({
      firstname: profile?.firstName ?? "",
      lastname: profile?.lastName ?? "",
      email: user.email,
      phone: profile?.phone ?? undefined,
      roadAddress: profile?.roadAddress ?? undefined,
      city: profile?.city ?? undefined,
      cityCode: profile?.cityCode ?? undefined,
      countryCode: profile?.countryCode ?? undefined,
      birthdate: profile?.birthdate ?? undefined,
      nationality: profile?.nationality ?? undefined,
      profession: profile?.profession ?? undefined,
    });
  }

  // 4. DigiForma: add to session — FATAL
  await addDraftTraineeToSession(digiformaTrainee.id, sessionId);

  // 5. Persist digiformaId to profile if not set (best-effort, non-blocking)
  if (profile && !profile.digiformaId) {
    await db
      .update(userProfiles)
      .set({ digiformaId: digiformaTrainee.id, updatedAt: new Date() })
      .where(eq(userProfiles.userId, userId))
      .catch((err) =>
        console.error("Failed to persist digiformaId to profile:", err)
      );
  }

  // 6. DB: create enrollment + session assignment in a transaction
  const [enrollment] = await db.transaction(async (tx) => {
    const [newEnrollment] = await tx
      .insert(programEnrollments)
      .values({
        userId,
        programCode,
        status: "active",
        pricingTierUsed: pricingTierId,
      })
      .returning();

    await tx.insert(sessionAssignments).values({
      enrollmentId: newEnrollment!.id,
      sessionId,
      status: "assigned",
    });

    return [newEnrollment!];
  });

  // 7. Bexio: non-fatal — invoice generation
  let bexioUpdates: Partial<ProgramEnrollment> = {};
  try {
    const contact = await findOrCreateContact({
      firstName: profile?.firstName ?? "",
      lastName: profile?.lastName ?? "",
      email: user.email,
      phone: profile?.phone ?? undefined,
      address: profile?.roadAddress ?? undefined,
      postcode: profile?.cityCode ?? undefined,
      city: profile?.city ?? undefined,
    });

    // Find or create article for this program code
    let article = await fetchArticleByInternCode(programCode);
    if (!article) {
      article = await createArticle({
        internCode: programCode,
        internName: pricingTier.label,
        salePrice: invoiceAmount,
      });
    }

    const invoiceTitle = `${pricingTier.label} — ${programCode}`;
    const invoice = await createAndSendInvoice({
      contactId: contact.id,
      title: invoiceTitle,
      articleId: article.id,
      articleName: pricingTier.label,
      price: invoiceAmount,
      email: user.email,
      apiReference: `enrollment:${enrollment.id}`,
    });

    bexioUpdates = {
      bexioInvoiceId: String(invoice.id),
      bexioDocumentNr: invoice.document_nr,
      bexioTotal: invoice.total,
    };
  } catch (err) {
    console.error(
      `Bexio invoicing failed for enrollment ${enrollment.id} (programCode=${programCode}):`,
      err
    );
    // Enrollment is still valid — invoicing failure is non-fatal
  }

  // 8. Patch enrollment with Bexio data (if any)
  let finalEnrollment = enrollment;
  if (Object.keys(bexioUpdates).length > 0) {
    const [updated] = await db
      .update(programEnrollments)
      .set({ ...bexioUpdates, updatedAt: new Date() })
      .where(eq(programEnrollments.id, enrollment.id))
      .returning();
    finalEnrollment = updated ?? enrollment;
  }

  // 9. Queue confirmation notification (best-effort)
  await queue("enrollment_confirmation", userId, {
    programCode,
    sessionId,
    invoiceAmount,
  }).catch((err) =>
    console.error("Failed to queue enrollment notification:", err)
  );

  return finalEnrollment;
}

// ---------------------------------------------------------------------------
// rescheduleSession
// ---------------------------------------------------------------------------

export async function rescheduleSession(
  enrollmentId: string,
  newSessionId: string,
  callerUserId: string,
  isAdmin: boolean
): Promise<SessionAssignment> {
  const enrollment = await loadEnrollmentForCaller(
    enrollmentId,
    callerUserId,
    isAdmin
  );

  // Find the active session assignment
  const [assignment] = await db
    .select()
    .from(sessionAssignments)
    .where(
      and(
        eq(sessionAssignments.enrollmentId, enrollmentId),
        eq(sessionAssignments.status, "assigned")
      )
    )
    .limit(1);

  if (!assignment) {
    throw new AppError("Aucune session active trouvée pour cet inscription.", 404);
  }

  const oldSessionId = assignment.sessionId;

  // Load digiformaId for the user
  const [profile] = await db
    .select({ digiformaId: userProfiles.digiformaId })
    .from(userProfiles)
    .where(eq(userProfiles.userId, enrollment.userId))
    .limit(1);

  const digiformaId = profile?.digiformaId;

  // DigiForma: remove from old session — FATAL
  if (digiformaId) {
    await removeTraineeFromSession(digiformaId, oldSessionId);
  } else {
    console.warn(
      `rescheduleSession: no digiformaId for user ${enrollment.userId}, skipping DigiForma removal`
    );
  }

  // DigiForma: add to new session — FATAL
  if (digiformaId) {
    await addDraftTraineeToSession(digiformaId, newSessionId);
  } else {
    console.warn(
      `rescheduleSession: no digiformaId for user ${enrollment.userId}, skipping DigiForma add`
    );
  }

  // DB: update assignment
  const [updated] = await db
    .update(sessionAssignments)
    .set({
      sessionId: newSessionId,
      rescheduledFrom: oldSessionId,
      assignedAt: new Date(),
    })
    .where(eq(sessionAssignments.id, assignment.id))
    .returning();

  if (!updated) throw new AppError("Échec de la mise à jour de la session.", 500);

  await queue("session_rescheduled", enrollment.userId, {
    oldSessionId,
    newSessionId,
    programCode: enrollment.programCode,
  }).catch((err) =>
    console.error("Failed to queue reschedule notification:", err)
  );

  return updated;
}

// ---------------------------------------------------------------------------
// cancelSession
// ---------------------------------------------------------------------------

export async function cancelSession(
  enrollmentId: string,
  callerUserId: string,
  isAdmin: boolean
): Promise<SessionAssignment> {
  const enrollment = await loadEnrollmentForCaller(
    enrollmentId,
    callerUserId,
    isAdmin
  );

  const [assignment] = await db
    .select()
    .from(sessionAssignments)
    .where(
      and(
        eq(sessionAssignments.enrollmentId, enrollmentId),
        eq(sessionAssignments.status, "assigned")
      )
    )
    .limit(1);

  if (!assignment) {
    throw new AppError("Aucune session active trouvée pour cette inscription.", 404);
  }

  // Load digiformaId — removal is best-effort (non-fatal)
  const [profile] = await db
    .select({ digiformaId: userProfiles.digiformaId })
    .from(userProfiles)
    .where(eq(userProfiles.userId, enrollment.userId))
    .limit(1);

  const digiformaId = profile?.digiformaId;
  if (digiformaId) {
    try {
      await removeTraineeFromSession(digiformaId, assignment.sessionId);
    } catch (err) {
      console.error(
        `cancelSession: DigiForma removal failed for trainee ${digiformaId} session ${assignment.sessionId}:`,
        err
      );
      // non-fatal — continue with local cancellation
    }
  }

  const now = new Date();
  const [updated] = await db
    .update(sessionAssignments)
    .set({ status: "cancelled", cancelledAt: now })
    .where(eq(sessionAssignments.id, assignment.id))
    .returning();

  if (!updated) throw new AppError("Échec de l'annulation de la session.", 500);

  return updated;
}

// ---------------------------------------------------------------------------
// getUserEnrollments
// ---------------------------------------------------------------------------

export async function getUserEnrollments(
  userId: string
): Promise<EnrollmentWithAssignments[]> {
  const enrollments = await db
    .select()
    .from(programEnrollments)
    .where(eq(programEnrollments.userId, userId))
    .orderBy(desc(programEnrollments.enrolledAt));

  if (enrollments.length === 0) return [];

  const enrollmentIds = enrollments.map((e) => e.id);

  // Load all assignments for these enrollments in one query
  const allAssignments = await db
    .select()
    .from(sessionAssignments)
    .where(inArray(sessionAssignments.enrollmentId, enrollmentIds));

  const assignmentsByEnrollment = new Map<string, SessionAssignment[]>();
  for (const a of allAssignments) {
    if (!assignmentsByEnrollment.has(a.enrollmentId)) {
      assignmentsByEnrollment.set(a.enrollmentId, []);
    }
    assignmentsByEnrollment.get(a.enrollmentId)!.push(a);
  }

  return enrollments.map((e) => ({
    ...e,
    sessionAssignments: assignmentsByEnrollment.get(e.id) ?? [],
  }));
}

// ---------------------------------------------------------------------------
// requestRefund
// ---------------------------------------------------------------------------

export async function requestRefund(
  enrollmentId: string,
  reason: string,
  callerUserId: string
): Promise<RefundRequest> {
  const enrollment = await loadEnrollmentForCaller(
    enrollmentId,
    callerUserId,
    false // members can only request for their own enrollments
  );

  if (enrollment.status === "refunded") {
    throw new AppError("Cette inscription a déjà été remboursée.", 409);
  }

  // Check for existing pending request
  const [existing] = await db
    .select({ id: refundRequests.id })
    .from(refundRequests)
    .where(
      and(
        eq(refundRequests.enrollmentId, enrollmentId),
        eq(refundRequests.status, "pending")
      )
    )
    .limit(1);

  if (existing) {
    throw new AppError(
      "Une demande de remboursement est déjà en attente pour cette inscription.",
      409
    );
  }

  const [request] = await db
    .insert(refundRequests)
    .values({ enrollmentId, reason, status: "pending" })
    .returning();

  return request!;
}

// ---------------------------------------------------------------------------
// processRefund
// ---------------------------------------------------------------------------

export async function processRefund(
  refundRequestId: string,
  approved: boolean,
  adminNote: string | null,
  adminId: string
): Promise<RefundRequest> {
  const [request] = await db
    .select()
    .from(refundRequests)
    .where(eq(refundRequests.id, refundRequestId))
    .limit(1);

  if (!request) throw new AppError("Demande de remboursement introuvable.", 404);
  if (request.status !== "pending") {
    throw new AppError("Cette demande a déjà été traitée.", 409);
  }

  const [enrollment] = await db
    .select()
    .from(programEnrollments)
    .where(eq(programEnrollments.id, request.enrollmentId))
    .limit(1);

  if (!enrollment) throw new AppError("Inscription introuvable.", 404);

  const status = approved ? "approved" : "denied";
  const now = new Date();

  if (approved) {
    // Bexio credit note — non-fatal
    let bexioCreditNoteId: string | null = null;
    try {
      const [user] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, enrollment.userId))
        .limit(1);

      if (user && enrollment.bexioTotal) {
        const refundAmount = parseFloat(enrollment.bexioTotal);
        const contact = await findOrCreateContact({
          firstName: "",
          lastName: "",
          email: user.email,
        });

        const creditNote = await createCreditNote({
          contactId: contact.id,
          title: `Remboursement — ${enrollment.programCode}`,
          amount: refundAmount,
          apiReference: `refund:${refundRequestId}`,
        });
        await issueCreditNote(creditNote.id);
        bexioCreditNoteId = String(creditNote.id);
      }
    } catch (err) {
      console.error(
        `processRefund: Bexio credit note failed for request ${refundRequestId}:`,
        err
      );
      // non-fatal
    }

    // Mark enrollment as refunded
    await db
      .update(programEnrollments)
      .set({ status: "refunded", updatedAt: now })
      .where(eq(programEnrollments.id, enrollment.id));

    const [updated] = await db
      .update(refundRequests)
      .set({
        status,
        adminNote,
        processedBy: adminId,
        updatedAt: now,
        ...(bexioCreditNoteId ? { bexioCreditNoteId } : {}),
      })
      .where(eq(refundRequests.id, refundRequestId))
      .returning();

    await queue("refund_update", enrollment.userId, {
      approved,
      programCode: enrollment.programCode,
    }).catch((err) =>
      console.error("Failed to queue refund notification:", err)
    );

    return updated!;
  }

  // Denied
  const [updated] = await db
    .update(refundRequests)
    .set({ status, adminNote, processedBy: adminId, updatedAt: now })
    .where(eq(refundRequests.id, refundRequestId))
    .returning();

  await queue("refund_update", enrollment.userId, {
    approved,
    programCode: enrollment.programCode,
  }).catch((err) =>
    console.error("Failed to queue refund notification:", err)
  );

  return updated!;
}

// ---------------------------------------------------------------------------
// getPendingRefunds
// ---------------------------------------------------------------------------

export async function getPendingRefunds(): Promise<RefundRequest[]> {
  return db
    .select()
    .from(refundRequests)
    .where(eq(refundRequests.status, "pending"))
    .orderBy(desc(refundRequests.createdAt));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadEnrollmentForCaller(
  enrollmentId: string,
  callerUserId: string,
  isAdmin: boolean
): Promise<ProgramEnrollment> {
  const [enrollment] = await db
    .select()
    .from(programEnrollments)
    .where(eq(programEnrollments.id, enrollmentId))
    .limit(1);

  if (!enrollment) throw new AppError("Inscription introuvable.", 404);

  if (!isAdmin && enrollment.userId !== callerUserId) {
    throw new AppError("Accès non autorisé.", 403);
  }

  return enrollment;
}

