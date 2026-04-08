import { eq } from "drizzle-orm";
import { userProfiles, users, programEnrollments } from "@mhp/shared";
import {
  fetchAllContacts,
  fetchAllInvoices,
  type BexioContact,
  type BexioInvoice,
} from "@mhp/integrations/bexio";
import { db } from "../db.js";
import { logger } from "../lib/logger.js";

export interface BexioContactSyncResult {
  totalContacts: number;
  matched: number;
  skipped: number;
  errors: string[];
}

export interface BexioInvoiceSyncResult {
  totalInvoices: number;
  linked: number;
  skippedNoUser: number;
  skippedNoEnrollment: number;
  skippedAlreadyLinked: number;
  errors: string[];
}

export interface BexioSyncResult {
  contacts: BexioContactSyncResult;
  invoices: BexioInvoiceSyncResult;
}

export async function syncBexioContacts(): Promise<BexioContactSyncResult> {
  const result: BexioContactSyncResult = {
    totalContacts: 0,
    matched: 0,
    skipped: 0,
    errors: [],
  };

  logger.info("Bexio sync: fetching all contacts");
  const contacts = await fetchAllContacts();
  result.totalContacts = contacts.length;
  logger.info({ count: contacts.length }, "Bexio sync: contacts fetched");

  const allUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users);
  const emailToUserId = new Map(
    allUsers.map((u) => [u.email.toLowerCase(), u.id])
  );

  const emailContactCount = new Map<string, number>();
  for (const contact of contacts) {
    const email = (contact.mail || "").toLowerCase().trim();
    if (email) {
      emailContactCount.set(email, (emailContactCount.get(email) || 0) + 1);
    }
  }

  for (const contact of contacts) {
    const email = (contact.mail || "").toLowerCase().trim();
    if (!email) {
      result.skipped++;
      continue;
    }

    if ((emailContactCount.get(email) || 0) > 1) {
      result.skipped++;
      continue;
    }

    const userId = emailToUserId.get(email);
    if (!userId) {
      result.skipped++;
      continue;
    }

    try {
      const [existing] = await db
        .select({ bexioContactId: userProfiles.bexioContactId })
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId));

      if (existing && existing.bexioContactId === String(contact.id)) {
        result.skipped++;
        continue;
      }

      if (existing) {
        await db
          .update(userProfiles)
          .set({
            bexioContactId: String(contact.id),
            updatedAt: new Date(),
          })
          .where(eq(userProfiles.userId, userId));
      } else {
        result.skipped++;
        continue;
      }

      result.matched++;
    } catch (err) {
      result.errors.push(
        `Contact ${contact.id} (${email}): ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  logger.info(
    { matched: result.matched, skipped: result.skipped, errors: result.errors.length },
    "Bexio contact sync complete"
  );
  return result;
}

export async function syncBexioInvoices(): Promise<BexioInvoiceSyncResult> {
  const result: BexioInvoiceSyncResult = {
    totalInvoices: 0,
    linked: 0,
    skippedNoUser: 0,
    skippedNoEnrollment: 0,
    skippedAlreadyLinked: 0,
    errors: [],
  };

  logger.info("Bexio sync: fetching all invoices");
  const invoices = await fetchAllInvoices();
  result.totalInvoices = invoices.length;
  logger.info({ count: invoices.length }, "Bexio sync: invoices fetched");

  const profiles = await db
    .select({
      userId: userProfiles.userId,
      bexioContactId: userProfiles.bexioContactId,
    })
    .from(userProfiles);

  const contactIdToUserId = new Map<string, string>();
  for (const p of profiles) {
    if (p.bexioContactId) {
      contactIdToUserId.set(p.bexioContactId, p.userId);
    }
  }

  const enrollments = await db.select().from(programEnrollments);
  const enrollmentsByUser = new Map<string, typeof enrollments>();
  for (const e of enrollments) {
    const list = enrollmentsByUser.get(e.userId) || [];
    list.push(e);
    enrollmentsByUser.set(e.userId, list);
  }

  const alreadyLinkedInvoiceIds = new Set(
    enrollments
      .filter((e) => e.bexioInvoiceId)
      .map((e) => e.bexioInvoiceId!)
  );

  for (const invoice of invoices) {
    const invoiceIdStr = String(invoice.id);

    if (alreadyLinkedInvoiceIds.has(invoiceIdStr)) {
      result.skippedAlreadyLinked++;
      continue;
    }

    const userId = contactIdToUserId.get(String(invoice.contact_id));
    if (!userId) {
      result.skippedNoUser++;
      continue;
    }

    const userEnrollments = enrollmentsByUser.get(userId);
    if (!userEnrollments || userEnrollments.length === 0) {
      result.skippedNoEnrollment++;
      continue;
    }

    const unlinkedEnrollments = userEnrollments.filter((e) => !e.bexioInvoiceId);
    if (unlinkedEnrollments.length === 0) {
      result.skippedAlreadyLinked++;
      continue;
    }

    const matched = matchInvoiceToEnrollment(invoice, unlinkedEnrollments);
    if (!matched) {
      if (unlinkedEnrollments.length === 1) {
        try {
          await db
            .update(programEnrollments)
            .set({
              bexioInvoiceId: invoiceIdStr,
              bexioDocumentNr: invoice.document_nr,
              bexioTotal: invoice.total,
              updatedAt: new Date(),
            })
            .where(eq(programEnrollments.id, unlinkedEnrollments[0]!.id));
          result.linked++;
          unlinkedEnrollments[0]!.bexioInvoiceId = invoiceIdStr;
        } catch (err) {
          result.errors.push(
            `Invoice ${invoice.id}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      } else {
        result.skippedNoEnrollment++;
      }
      continue;
    }

    try {
      await db
        .update(programEnrollments)
        .set({
          bexioInvoiceId: invoiceIdStr,
          bexioDocumentNr: invoice.document_nr,
          bexioTotal: invoice.total,
          updatedAt: new Date(),
        })
        .where(eq(programEnrollments.id, matched.id));
      matched.bexioInvoiceId = invoiceIdStr;
      result.linked++;
    } catch (err) {
      result.errors.push(
        `Invoice ${invoice.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  logger.info(
    {
      linked: result.linked,
      skippedNoUser: result.skippedNoUser,
      skippedNoEnrollment: result.skippedNoEnrollment,
      skippedAlreadyLinked: result.skippedAlreadyLinked,
      errors: result.errors.length,
    },
    "Bexio invoice sync complete"
  );
  return result;
}

const PROGRAM_KEYWORDS: Record<string, string[]> = {
  OMNI: ["omni", "praticien en hypnose omni", "praticien·ne hypnose omni"],
  FAAH: ["addiction", "addictions"],
  FAEH: ["enfant"],
  FAES: ["entretien", "orienté solution"],
  FAEF: ["examen final", "maître praticien"],
  FATA: ["techniques avancées", "techniques avancees"],
  FAHTG: ["transgénérationnelle", "transgenerationnelle", "m.i.a"],
  FAMH: ["maladie"],
  FACH: ["coaching"],
  FASH: ["sport"],
  FATAH: ["troubles anxieux", "anxieux"],
  SUPG: ["supervision"],
  CTS: ["colloque"],
  "01PHMB": ["hypnose médicale", "hypnose medicale", "techniques de base"],
  HMED2C: ["spécialisation", "module 2"],
  HMED0000: ["praticien en hypnose médicale elmanienne"],
};

function matchInvoiceToEnrollment(
  invoice: BexioInvoice,
  enrollments: Array<{ id: string; programCode: string; bexioInvoiceId: string | null }>
): { id: string; programCode: string; bexioInvoiceId: string | null } | null {
  const titleLower = (invoice.title || "").toLowerCase();

  for (const enrollment of enrollments) {
    const keywords = PROGRAM_KEYWORDS[enrollment.programCode];
    if (!keywords) continue;

    for (const kw of keywords) {
      if (titleLower.includes(kw)) {
        return enrollment;
      }
    }
  }

  return null;
}

export async function runFullBexioSync(): Promise<BexioSyncResult> {
  logger.info("Starting full Bexio sync");
  const contacts = await syncBexioContacts();
  const invoices = await syncBexioInvoices();
  logger.info("Full Bexio sync complete");
  return { contacts, invoices };
}
