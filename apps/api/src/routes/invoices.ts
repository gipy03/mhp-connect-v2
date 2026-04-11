import { Router } from "express";
import { and, asc, desc, eq, ilike, inArray, or, sql, isNull, isNotNull } from "drizzle-orm";
import { bexioInvoices, userProfiles, users } from "@mhp/shared";
import { fetchInvoicePdf } from "@mhp/integrations/bexio";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { importAllBexioInvoices } from "../services/bexio-sync.js";
import { db } from "../db.js";
import { logger } from "../lib/logger.js";

const router = Router();

const VALID_SORT_FIELDS = ["invoiceDate", "documentNr", "totalInclVat", "status", "contactName"] as const;
type SortField = (typeof VALID_SORT_FIELDS)[number];
const SORT_COLUMN_MAP: Record<SortField, any> = {
  invoiceDate: bexioInvoices.invoiceDate,
  documentNr: bexioInvoices.documentNr,
  totalInclVat: bexioInvoices.totalInclVat,
  status: bexioInvoices.status,
  contactName: bexioInvoices.contactName,
};

router.get(
  "/admin",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const search = (req.query.search as string || "").trim();
      const status = req.query.status as string || "";
      const assigned = req.query.assigned as string || "";
      const sortBy = (req.query.sortBy as SortField) || "invoiceDate";
      const sortDir = req.query.sortDir === "asc" ? "asc" : "desc";
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(10, parseInt(req.query.limit as string) || 50));
      const offset = (page - 1) * limit;

      const conditions: any[] = [];

      if (search) {
        conditions.push(
          or(
            ilike(bexioInvoices.documentNr, `%${search}%`),
            ilike(bexioInvoices.title, `%${search}%`),
            ilike(bexioInvoices.contactName, `%${search}%`)
          )
        );
      }

      if (status) {
        conditions.push(eq(bexioInvoices.status, status));
      }

      if (assigned === "assigned") {
        conditions.push(isNotNull(bexioInvoices.userId));
      } else if (assigned === "unassigned") {
        conditions.push(isNull(bexioInvoices.userId));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const sortColumn = SORT_COLUMN_MAP[sortBy] ?? bexioInvoices.invoiceDate;
      const orderFn = sortDir === "asc" ? asc : desc;

      const [rows, [countRow]] = await Promise.all([
        db
          .select({
            id: bexioInvoices.id,
            bexioId: bexioInvoices.bexioId,
            documentNr: bexioInvoices.documentNr,
            title: bexioInvoices.title,
            invoiceDate: bexioInvoices.invoiceDate,
            contactId: bexioInvoices.contactId,
            contactName: bexioInvoices.contactName,
            totalInclVat: bexioInvoices.totalInclVat,
            totalRemainingPayments: bexioInvoices.totalRemainingPayments,
            status: bexioInvoices.status,
            networkLink: bexioInvoices.networkLink,
            userId: bexioInvoices.userId,
            userName: sql<string>`COALESCE(${userProfiles.firstName} || ' ' || ${userProfiles.lastName}, '')`.as("user_name"),
            userEmail: users.email,
          })
          .from(bexioInvoices)
          .leftJoin(userProfiles, eq(bexioInvoices.userId, userProfiles.userId))
          .leftJoin(users, eq(bexioInvoices.userId, users.id))
          .where(where)
          .orderBy(orderFn(sortColumn))
          .limit(limit)
          .offset(offset),
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(bexioInvoices)
          .where(where),
      ]);

      res.json({
        invoices: rows,
        total: countRow?.total ?? 0,
        page,
        limit,
        totalPages: Math.ceil((countRow?.total ?? 0) / limit),
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/admin/sync",
  requireAuth,
  requireAdmin,
  async (_req, res, next) => {
    try {
      const result = await importAllBexioInvoices();
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/admin/assign",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { invoiceIds, userId } = req.body as { invoiceIds: string[]; userId: string | null };

      if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
        res.status(400).json({ error: "invoiceIds requis." });
        return;
      }

      if (userId) {
        const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
        if (!user) {
          res.status(404).json({ error: "Utilisateur introuvable." });
          return;
        }
      }

      await db
        .update(bexioInvoices)
        .set({ userId: userId ?? null, updatedAt: new Date() })
        .where(inArray(bexioInvoices.id, invoiceIds));

      res.json({ updated: invoiceIds.length });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/admin/:invoiceId/pdf",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const invoiceId = req.params.invoiceId as string;
      const [invoice] = await db
        .select({ bexioId: bexioInvoices.bexioId })
        .from(bexioInvoices)
        .where(eq(bexioInvoices.id, invoiceId))
        .limit(1);

      if (!invoice) {
        res.status(404).json({ error: "Facture introuvable." });
        return;
      }

      const pdf = await fetchInvoicePdf(invoice.bexioId);
      const buffer = Buffer.from(pdf.content, "base64");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${pdf.name}"`);
      res.setHeader("Content-Length", buffer.length);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/admin/users/search",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const q = (req.query.q as string || "").trim();
      if (q.length < 2) {
        res.json([]);
        return;
      }

      const rows = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: userProfiles.firstName,
          lastName: userProfiles.lastName,
        })
        .from(users)
        .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
        .where(
          or(
            ilike(users.email, `%${q}%`),
            ilike(userProfiles.firstName, `%${q}%`),
            ilike(userProfiles.lastName, `%${q}%`)
          )
        )
        .limit(20);

      res.json(rows);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/me",
  requireAuth,
  async (req, res, next) => {
    try {
      const userId = req.session.userId!;
      const status = (req.query.status as string) || "";
      const sortBy = (req.query.sortBy as SortField) || "invoiceDate";
      const sortDir = req.query.sortDir === "asc" ? "asc" : "desc";

      const conditions: any[] = [eq(bexioInvoices.userId, userId)];

      if (status) {
        conditions.push(eq(bexioInvoices.status, status));
      }

      const sortColumn = SORT_COLUMN_MAP[sortBy] ?? bexioInvoices.invoiceDate;
      const orderFn = sortDir === "asc" ? asc : desc;

      const rows = await db
        .select({
          id: bexioInvoices.id,
          bexioId: bexioInvoices.bexioId,
          documentNr: bexioInvoices.documentNr,
          title: bexioInvoices.title,
          invoiceDate: bexioInvoices.invoiceDate,
          totalInclVat: bexioInvoices.totalInclVat,
          totalRemainingPayments: bexioInvoices.totalRemainingPayments,
          status: bexioInvoices.status,
          networkLink: bexioInvoices.networkLink,
        })
        .from(bexioInvoices)
        .where(and(...conditions))
        .orderBy(orderFn(sortColumn));

      res.json(rows);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/me/:invoiceId/pdf",
  requireAuth,
  async (req, res, next) => {
    try {
      const userId = req.session.userId!;
      const invoiceId = req.params.invoiceId as string;

      const [invoice] = await db
        .select({ bexioId: bexioInvoices.bexioId })
        .from(bexioInvoices)
        .where(and(eq(bexioInvoices.id, invoiceId), eq(bexioInvoices.userId, userId)))
        .limit(1);

      if (!invoice) {
        res.status(404).json({ error: "Facture introuvable." });
        return;
      }

      const pdf = await fetchInvoicePdf(invoice.bexioId);
      const buffer = Buffer.from(pdf.content, "base64");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${pdf.name}"`);
      res.setHeader("Content-Length", buffer.length);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
