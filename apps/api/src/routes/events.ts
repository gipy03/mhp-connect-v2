import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { communityEventBodySchema, rsvpBodySchema, digiformaSessions } from "@mhp/shared";
import { and, gte, lte, sql } from "drizzle-orm";
import { db } from "../db.js";
import {
  createEvent,
  updateEvent,
  deleteEvent,
  getEventById,
  listEvents,
  listAllEventsAdmin,
  upsertRsvp,
  cancelRsvp,
  getEventRsvps,
  getUserRsvp,
  getRsvpCounts,
  generateIcalEvent,
  generateFullCalendarFeed,
  getAttendanceReport,
  enrichWithCounts,
  getEngagementStats,
} from "../services/events.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const { from, to, eventType, programCode } = req.query as {
      from?: string;
      to?: string;
      eventType?: string;
      programCode?: string;
    };
    const events = await listEvents({
      from,
      to,
      eventType,
      programCode,
      publishedOnly: true,
    });
    const enriched = await enrichWithCounts(events);
    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

router.get("/merged", async (req, res, next) => {
  try {
    const { from, to, eventType, programCode, location } = req.query as {
      from?: string;
      to?: string;
      eventType?: string;
      programCode?: string;
      location?: string;
    };

    const showCommunity = eventType !== "training";
    const showTraining = eventType !== "community";

    let enrichedCommunity: Awaited<ReturnType<typeof enrichWithCounts>> = [];
    if (showCommunity) {
      const communityEventsRaw = await listEvents({
        from,
        to,
        eventType: (eventType === "community" || eventType === "all") ? undefined : eventType,
        programCode,
        publishedOnly: true,
      });

      let filtered = communityEventsRaw;
      if (location === "remote") {
        filtered = filtered.filter((e) => e.isRemote === true);
      } else if (location === "in-person") {
        filtered = filtered.filter((e) => e.isRemote !== true);
      }
      enrichedCommunity = await enrichWithCounts(filtered);
    }

    type TrainingSessionRow = typeof digiformaSessions.$inferSelect;
    let trainingSessionRows: TrainingSessionRow[] = [];
    if (showTraining) {
      const conditions = [];
      if (from) conditions.push(gte(digiformaSessions.startDate, from));
      if (to) conditions.push(lte(digiformaSessions.startDate, to));

      let sessions = await db
        .select()
        .from(digiformaSessions)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      if (from || to) {
        const nullDateSessions = await db
          .select()
          .from(digiformaSessions)
          .where(sql`${digiformaSessions.startDate} IS NULL`);
        const existingIds = new Set(sessions.map((s) => s.id));
        for (const s of nullDateSessions) {
          if (!existingIds.has(s.id)) {
            sessions.push(s);
          }
        }
      }

      if (programCode) {
        sessions = sessions.filter((s) => s.programCode === programCode);
      }
      if (location === "remote") {
        sessions = sessions.filter((s) => s.remote === true);
      } else if (location === "in-person") {
        sessions = sessions.filter((s) => s.remote !== true);
      }
      trainingSessionRows = sessions;
    }

    const merged = {
      communityEvents: enrichedCommunity,
      trainingSessions: trainingSessionRows,
    };

    res.json(merged);
  } catch (err) {
    next(err);
  }
});

router.get("/ical", async (_req, res, next) => {
  try {
    const feed = await generateFullCalendarFeed();
    res.set("Content-Type", "text/calendar; charset=utf-8");
    res.set("Content-Disposition", "attachment; filename=mhp-connect.ics");
    res.send(feed);
  } catch (err) {
    next(err);
  }
});

router.get("/admin/engagement", requireAdmin, async (_req, res, next) => {
  try {
    const stats = await getEngagementStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

router.get("/admin/all", requireAdmin, async (_req, res, next) => {
  try {
    const events = await listAllEventsAdmin();
    res.json(events);
  } catch (err) {
    next(err);
  }
});

router.get("/admin/report", requireAdmin, async (_req, res, next) => {
  try {
    const report = await getAttendanceReport();
    res.json(report);
  } catch (err) {
    next(err);
  }
});

router.post("/admin", requireAdmin, async (req, res, next) => {
  try {
    const parsed = communityEventBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Données invalides.", issues: parsed.error.issues });
      return;
    }
    const event = await createEvent(parsed.data, req.session.userId!);
    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
});

router.post("/member/create", requireAuth, async (req, res, next) => {
  try {
    const parsed = communityEventBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Données invalides.", issues: parsed.error.issues });
      return;
    }
    const event = await createEvent(
      { ...parsed.data, published: false },
      req.session.userId!
    );
    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
});

router.put("/admin/:id", requireAdmin, async (req, res, next) => {
  try {
    const parsed = communityEventBodySchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Données invalides.", issues: parsed.error.issues });
      return;
    }
    const event = await updateEvent(req.params.id as string, parsed.data);
    res.json(event);
  } catch (err) {
    next(err);
  }
});

router.delete("/admin/:id", requireAdmin, async (req, res, next) => {
  try {
    await deleteEvent(req.params.id as string);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const event = await getEventById(req.params.id as string);
    if (!event.published && req.session.role !== "admin") {
      res.status(404).json({ error: "Événement introuvable." });
      return;
    }
    const counts = await getRsvpCounts(event.id);
    res.json({ ...event, rsvpCounts: counts });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/ical", async (req, res, next) => {
  try {
    const event = await getEventById(req.params.id as string);
    if (!event.published && req.session.role !== "admin") {
      res.status(404).json({ error: "Événement introuvable." });
      return;
    }
    const ical = generateIcalEvent(event);
    res.set("Content-Type", "text/calendar; charset=utf-8");
    res.set("Content-Disposition", `attachment; filename=event-${event.id}.ics`);
    res.send(ical);
  } catch (err) {
    next(err);
  }
});

router.get("/:id/rsvps", async (req, res, next) => {
  try {
    const event = await getEventById(req.params.id as string);
    const isAdmin = req.session?.role === "admin";
    const isAuthenticated = !!req.session?.userId;

    if (!event.published && !isAdmin) {
      res.status(404).json({ error: "Événement introuvable." });
      return;
    }

    const rsvps = await getEventRsvps(req.params.id as string);

    if (isAdmin) {
      res.json(rsvps);
    } else if (isAuthenticated) {
      res.json(
        rsvps.map((r) => ({
          id: r.id,
          userId: r.userId,
          status: r.status,
          createdAt: r.createdAt,
          firstName: r.firstName,
        }))
      );
    } else {
      res.json(
        rsvps.map((r) => ({
          id: r.id,
          status: r.status,
          firstName: r.firstName,
        }))
      );
    }
  } catch (err) {
    next(err);
  }
});

router.post("/:id/rsvp", requireAuth, async (req, res, next) => {
  try {
    const parsed = rsvpBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Données invalides.", issues: parsed.error.issues });
      return;
    }
    const rsvp = await upsertRsvp(
      req.params.id as string,
      req.session.userId!,
      parsed.data.status
    );
    res.json(rsvp);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/rsvp", requireAuth, async (req, res, next) => {
  try {
    await cancelRsvp(req.params.id as string, req.session.userId!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.get("/:id/my-rsvp", requireAuth, async (req, res, next) => {
  try {
    const rsvp = await getUserRsvp(req.params.id as string, req.session.userId!);
    res.json(rsvp);
  } catch (err) {
    next(err);
  }
});

export default router;
