import { eq, sql } from "drizzle-orm";
import { userProfiles, users, programEnrollments, bexioInvoices } from "@mhp/shared";
import {
  fetchAllContacts,
  fetchAllInvoices,
  fetchArticles,
  type BexioContact,
  type BexioInvoice,
  type BexioArticle,
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

  logger.info("Bexio sync: fetching all invoices and articles");
  const [invoices, articles] = await Promise.all([
    fetchAllInvoices(),
    articleCache ? Promise.resolve(articleCache) : fetchArticles(),
  ]);
  articleCache = articles;
  articleCodeToProgramCode = buildArticleMap(articles);
  result.totalInvoices = invoices.length;
  logger.info(
    { invoiceCount: invoices.length, articleCount: articles.length },
    "Bexio sync: invoices and articles fetched"
  );

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

    const matched = matchInvoiceToEnrollment(invoice, unlinkedEnrollments, articleCodeToProgramCode);
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
  OMNI: ["omni", "praticien en hypnose omni", "praticien·ne hypnose omni", "praticien hypnose", "phno", "formation praticien"],
  FAAH: ["addiction", "addictions", "faah", "alcoologie", "tabac"],
  FAEH: ["enfant", "faeh", "pédiatrique", "pediatrique", "enfance", "adolescent"],
  FAES: ["entretien", "orienté solution", "oriente solution", "faes", "solution-focused", "eos"],
  FAEF: ["examen final", "maître praticien", "maitre praticien", "faef", "mpho", "certification finale"],
  FATA: ["techniques avancées", "techniques avancees", "fata", "avancée", "avancee"],
  FAHTG: ["transgénérationnelle", "transgenerationnelle", "m.i.a", "fahtg", "transgénérationnel", "transgenerationnel", "mia"],
  FAMH: ["maladie", "famh", "médical", "medical", "pathologie"],
  FACH: ["coaching", "fach", "coach"],
  FASH: ["sport", "fash", "sportif", "sportive", "performance"],
  FATAH: ["troubles anxieux", "anxieux", "fatah", "anxiété", "anxiete", "phobie", "stress post"],
  SUPG: ["supervision", "supg", "supervisé", "supervise"],
  CTS: ["colloque", "cts", "conférence", "conference"],
  "01PHMB": ["hypnose médicale", "hypnose medicale", "techniques de base", "01phmb", "phmb", "module de base"],
  HMED2C: ["spécialisation", "specialisation", "module 2", "hmed2c", "hmed 2"],
  HMED0000: ["praticien en hypnose médicale elmanienne", "hmed0000", "hmed 0000", "elmanienne", "elman"],
};

let articleCache: BexioArticle[] | null = null;
let articleCodeToProgramCode: Map<string, string> | null = null;

function buildArticleMap(articles: BexioArticle[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const article of articles) {
    const code = article.intern_code?.toUpperCase().trim();
    if (!code) continue;
    for (const progCode of Object.keys(PROGRAM_KEYWORDS)) {
      if (code === progCode || code.startsWith(`${progCode}_`) || code.startsWith(`${progCode}-`)) {
        map.set(String(article.id), progCode);
        break;
      }
    }
  }
  return map;
}

function matchInvoiceToEnrollment(
  invoice: BexioInvoice,
  enrollments: Array<{ id: string; programCode: string; bexioInvoiceId: string | null }>,
  articleMap?: Map<string, string> | null
): { id: string; programCode: string; bexioInvoiceId: string | null } | null {
  const titleLower = (invoice.title || "").toLowerCase();
  const enrollmentsByCode = new Map(enrollments.map((e) => [e.programCode, e]));

  if (invoice.api_reference) {
    const ref = invoice.api_reference.toUpperCase().trim();
    for (const enrollment of enrollments) {
      if (ref === enrollment.programCode || ref.startsWith(`${enrollment.programCode}_`) || ref.includes(enrollment.programCode)) {
        return enrollment;
      }
    }
  }

  for (const enrollment of enrollments) {
    const keywords = PROGRAM_KEYWORDS[enrollment.programCode];
    if (!keywords) continue;

    for (const kw of keywords) {
      if (titleLower.includes(kw)) {
        return enrollment;
      }
    }
  }

  if (articleMap && articleMap.size > 0) {
    const titleWords = titleLower.split(/[\s,;:()\-–—/]+/).filter(Boolean);
    for (const [articleId, progCode] of articleMap) {
      if (titleLower.includes(articleId)) {
        const match = enrollmentsByCode.get(progCode);
        if (match) return match;
      }
      for (const word of titleWords) {
        if (word === progCode.toLowerCase()) {
          const match = enrollmentsByCode.get(progCode);
          if (match) return match;
        }
      }
    }
  }

  const codeUpper = (invoice.document_nr || "").toUpperCase();
  for (const enrollment of enrollments) {
    if (codeUpper.includes(enrollment.programCode)) {
      return enrollment;
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

// ---------------------------------------------------------------------------
// Bexio invoice status mapping
// ---------------------------------------------------------------------------

const BEXIO_STATUS_MAP: Record<number, string> = {
  7: "draft",
  8: "pending",
  9: "paid",
  16: "partial",
  19: "cancelled",
  31: "overdue",
};

function mapBexioStatus(statusId: number): string {
  return BEXIO_STATUS_MAP[statusId] ?? `unknown_${statusId}`;
}

function extractContactName(address: string | null): string | null {
  if (!address) return null;
  const lines = address.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 2) return lines.slice(0, 2).join(" ");
  return lines[0] ?? null;
}

// ---------------------------------------------------------------------------
// importAllBexioInvoices — full import into bexio_invoices table
// ---------------------------------------------------------------------------

export interface BexioInvoiceImportResult {
  totalFetched: number;
  created: number;
  updated: number;
  matched: number;
  errors: string[];
}

export async function importAllBexioInvoices(): Promise<BexioInvoiceImportResult> {
  const result: BexioInvoiceImportResult = {
    totalFetched: 0,
    created: 0,
    updated: 0,
    matched: 0,
    errors: [],
  };

  logger.info("Bexio invoice import: fetching all invoices and contacts");
  const [invoices, contacts] = await Promise.all([
    fetchAllInvoices(),
    fetchAllContacts(),
  ]);
  result.totalFetched = invoices.length;
  logger.info(
    { invoiceCount: invoices.length, contactCount: contacts.length },
    "Bexio invoice import: data fetched"
  );

  const allProfiles = await db
    .select({ userId: userProfiles.userId, bexioContactId: userProfiles.bexioContactId })
    .from(userProfiles);

  const contactIdToUserId = new Map<string, string>();
  for (const p of allProfiles) {
    if (p.bexioContactId) {
      contactIdToUserId.set(p.bexioContactId, p.userId);
    }
  }

  const allUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users);
  const emailToUserId = new Map(allUsers.map((u) => [u.email.toLowerCase(), u.id]));

  const contactEmailMap = new Map<number, string>();
  const contactIdsByEmail = new Map<string, number[]>();
  for (const c of contacts) {
    const email = (c.mail || "").toLowerCase().trim();
    if (email) {
      contactEmailMap.set(c.id, email);
      const ids = contactIdsByEmail.get(email) || [];
      ids.push(c.id);
      contactIdsByEmail.set(email, ids);
    }
  }

  for (const invoice of invoices) {
    try {
      let userId: string | null = contactIdToUserId.get(String(invoice.contact_id)) ?? null;

      if (!userId) {
        const contactEmail = contactEmailMap.get(invoice.contact_id);
        if (contactEmail) {
          userId = emailToUserId.get(contactEmail) ?? null;
        }
      }

      if (!userId) {
        const contactEmail = contactEmailMap.get(invoice.contact_id);
        if (contactEmail) {
          const allContactIds = contactIdsByEmail.get(contactEmail) || [];
          for (const cid of allContactIds) {
            const uid = contactIdToUserId.get(String(cid));
            if (uid) {
              userId = uid;
              break;
            }
          }
        }
      }

      const status = mapBexioStatus(invoice.kb_item_status_id);
      const contactName = extractContactName(invoice.contact_address);

      const [existing] = await db
        .select({ id: bexioInvoices.id })
        .from(bexioInvoices)
        .where(eq(bexioInvoices.bexioId, invoice.id))
        .limit(1);

      if (existing) {
        await db
          .update(bexioInvoices)
          .set({
            documentNr: invoice.document_nr,
            title: invoice.title || null,
            invoiceDate: invoice.is_valid_from || null,
            contactId: invoice.contact_id,
            contactName,
            totalInclVat: invoice.total,
            totalRemainingPayments: invoice.total_remaining_payments ?? null,
            status,
            networkLink: invoice.network_link || null,
            apiReference: invoice.api_reference || null,
            userId,
            updatedAt: new Date(),
          })
          .where(eq(bexioInvoices.id, existing.id));
        result.updated++;
      } else {
        await db
          .insert(bexioInvoices)
          .values({
            bexioId: invoice.id,
            documentNr: invoice.document_nr,
            title: invoice.title || null,
            invoiceDate: invoice.is_valid_from || null,
            contactId: invoice.contact_id,
            contactName,
            totalInclVat: invoice.total,
            totalRemainingPayments: invoice.total_remaining_payments ?? null,
            status,
            networkLink: invoice.network_link || null,
            apiReference: invoice.api_reference || null,
            userId,
          });
        result.created++;
      }

      if (userId) result.matched++;
    } catch (err) {
      result.errors.push(
        `Invoice ${invoice.id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  logger.info(
    {
      created: result.created,
      updated: result.updated,
      matched: result.matched,
      errors: result.errors.length,
    },
    "Bexio invoice import complete"
  );
  return result;
}
