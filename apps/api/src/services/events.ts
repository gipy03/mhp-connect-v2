import { and, count, desc, eq, gte, lte, sql, inArray } from "drizzle-orm";
import {
  communityEvents,
  eventRsvps,
  users,
  userProfiles,
  digiformaSessions,
  type CommunityEvent,
  type EventRsvp,
} from "@mhp/shared";
import { db } from "../db.js";
import { AppError } from "../lib/errors.js";

export async function createEvent(
  data: {
    title: string;
    description?: string | null;
    eventType: string;
    location?: string | null;
    locationAddress?: string | null;
    isRemote?: boolean;
    meetingUrl?: string | null;
    startAt: string;
    endAt: string;
    maxAttendees?: number | null;
    programCode?: string | null;
    published?: boolean;
  },
  createdBy: string
): Promise<CommunityEvent> {
  const [event] = await db
    .insert(communityEvents)
    .values({
      title: data.title,
      description: data.description ?? null,
      eventType: data.eventType,
      location: data.location ?? null,
      locationAddress: data.locationAddress ?? null,
      isRemote: data.isRemote ?? false,
      meetingUrl: data.meetingUrl ?? null,
      startAt: new Date(data.startAt),
      endAt: new Date(data.endAt),
      maxAttendees: data.maxAttendees ?? null,
      programCode: data.programCode ?? null,
      published: data.published ?? false,
      createdBy,
    })
    .returning();

  return event;
}

export async function updateEvent(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    eventType?: string;
    location?: string | null;
    locationAddress?: string | null;
    isRemote?: boolean;
    meetingUrl?: string | null;
    startAt?: string;
    endAt?: string;
    maxAttendees?: number | null;
    programCode?: string | null;
    published?: boolean;
  }
): Promise<CommunityEvent> {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (data.title !== undefined) set.title = data.title;
  if (data.description !== undefined) set.description = data.description;
  if (data.eventType !== undefined) set.eventType = data.eventType;
  if (data.location !== undefined) set.location = data.location;
  if (data.locationAddress !== undefined) set.locationAddress = data.locationAddress;
  if (data.isRemote !== undefined) set.isRemote = data.isRemote;
  if (data.meetingUrl !== undefined) set.meetingUrl = data.meetingUrl;
  if (data.startAt !== undefined) set.startAt = new Date(data.startAt);
  if (data.endAt !== undefined) set.endAt = new Date(data.endAt);
  if (data.maxAttendees !== undefined) set.maxAttendees = data.maxAttendees;
  if (data.programCode !== undefined) set.programCode = data.programCode;
  if (data.published !== undefined) set.published = data.published;

  const [event] = await db
    .update(communityEvents)
    .set(set)
    .where(eq(communityEvents.id, id))
    .returning();

  if (!event) throw new AppError("Événement introuvable.", 404);
  return event;
}

export async function deleteEvent(id: string): Promise<void> {
  const [deleted] = await db
    .delete(communityEvents)
    .where(eq(communityEvents.id, id))
    .returning({ id: communityEvents.id });

  if (!deleted) throw new AppError("Événement introuvable.", 404);
}

export async function getEventById(id: string): Promise<CommunityEvent> {
  const [event] = await db
    .select()
    .from(communityEvents)
    .where(eq(communityEvents.id, id))
    .limit(1);

  if (!event) throw new AppError("Événement introuvable.", 404);
  return event;
}

export async function listEvents(filters?: {
  from?: string;
  to?: string;
  eventType?: string;
  programCode?: string;
  publishedOnly?: boolean;
}): Promise<CommunityEvent[]> {
  const conditions = [];

  if (filters?.publishedOnly) {
    conditions.push(eq(communityEvents.published, true));
  }
  if (filters?.from) {
    conditions.push(gte(communityEvents.startAt, new Date(filters.from)));
  }
  if (filters?.to) {
    conditions.push(lte(communityEvents.startAt, new Date(filters.to)));
  }
  if (filters?.eventType) {
    conditions.push(eq(communityEvents.eventType, filters.eventType));
  }
  if (filters?.programCode) {
    conditions.push(eq(communityEvents.programCode, filters.programCode));
  }

  return db
    .select()
    .from(communityEvents)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(communityEvents.startAt);
}

export async function listAllEventsAdmin(): Promise<CommunityEvent[]> {
  return db
    .select()
    .from(communityEvents)
    .orderBy(desc(communityEvents.startAt));
}

export async function upsertRsvp(
  eventId: string,
  userId: string,
  status: string
): Promise<EventRsvp> {
  const event = await getEventById(eventId);

  if (!event.published) {
    throw new AppError("Cet événement n'est pas encore publié.", 400);
  }

  if (status === "attending" && event.maxAttendees) {
    const [{ cnt }] = await db
      .select({ cnt: count() })
      .from(eventRsvps)
      .where(
        and(
          eq(eventRsvps.eventId, eventId),
          eq(eventRsvps.status, "attending")
        )
      );
    if (cnt >= event.maxAttendees) {
      throw new AppError("L'événement est complet.", 400);
    }
  }

  const [rsvp] = await db
    .insert(eventRsvps)
    .values({ eventId, userId, status })
    .onConflictDoUpdate({
      target: [eventRsvps.eventId, eventRsvps.userId],
      set: { status, updatedAt: new Date() },
    })
    .returning();

  return rsvp;
}

export async function cancelRsvp(eventId: string, userId: string): Promise<void> {
  await db
    .delete(eventRsvps)
    .where(
      and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.userId, userId))
    );
}

export async function getEventRsvps(eventId: string) {
  return db
    .select({
      id: eventRsvps.id,
      userId: eventRsvps.userId,
      status: eventRsvps.status,
      createdAt: eventRsvps.createdAt,
      email: users.email,
      firstName: userProfiles.firstName,
      lastName: userProfiles.lastName,
    })
    .from(eventRsvps)
    .innerJoin(users, eq(users.id, eventRsvps.userId))
    .leftJoin(userProfiles, eq(userProfiles.userId, eventRsvps.userId))
    .where(eq(eventRsvps.eventId, eventId))
    .orderBy(eventRsvps.createdAt);
}

export async function getUserRsvp(
  eventId: string,
  userId: string
): Promise<EventRsvp | null> {
  const [rsvp] = await db
    .select()
    .from(eventRsvps)
    .where(
      and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.userId, userId))
    )
    .limit(1);

  return rsvp ?? null;
}

export async function getRsvpCounts(eventId: string) {
  const rows = await db
    .select({
      status: eventRsvps.status,
      cnt: count(),
    })
    .from(eventRsvps)
    .where(eq(eventRsvps.eventId, eventId))
    .groupBy(eventRsvps.status);

  const counts: Record<string, number> = { attending: 0, maybe: 0, not_attending: 0 };
  for (const r of rows) counts[r.status] = r.cnt;
  return counts;
}

function escapeIcal(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function formatIcalDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function generateIcalEvent(event: CommunityEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//mhp connect//Events//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@mhp-connect`,
    `DTSTART:${formatIcalDate(event.startAt)}`,
    `DTEND:${formatIcalDate(event.endAt)}`,
    `SUMMARY:${escapeIcal(event.title)}`,
  ];

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcal(event.description)}`);
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeIcal(event.location)}`);
  }
  if (event.meetingUrl) {
    lines.push(`URL:${event.meetingUrl}`);
  }

  lines.push(`DTSTAMP:${formatIcalDate(new Date())}`);
  lines.push("END:VEVENT");
  lines.push("END:VCALENDAR");

  return lines.join("\r\n");
}

export function generateIcalTrainingSession(session: {
  digiformaId: string;
  name: string | null;
  programName: string | null;
  startDate: string | null;
  endDate: string | null;
  place: string | null;
  placeName: string | null;
  remote: boolean | null;
}): string | null {
  if (!session.startDate) return null;

  const start = new Date(session.startDate);
  const end = session.endDate ? new Date(session.endDate) : new Date(start.getTime() + 8 * 60 * 60 * 1000);

  const title = session.programName || session.name || "Formation";
  const location = session.placeName || session.place || "";

  const lines = [
    "BEGIN:VEVENT",
    `UID:training-${session.digiformaId}@mhp-connect`,
    `DTSTART;VALUE=DATE:${start.toISOString().slice(0, 10).replace(/-/g, "")}`,
    `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replace(/-/g, "")}`,
    `SUMMARY:${escapeIcal(title)}`,
  ];

  if (location) lines.push(`LOCATION:${escapeIcal(location)}`);
  lines.push(`DTSTAMP:${formatIcalDate(new Date())}`);
  lines.push("END:VEVENT");

  return lines.join("\r\n");
}

export async function generateFullCalendarFeed(): Promise<string> {
  const events = await listEvents({ publishedOnly: true });
  const trainingSessions = await db.select().from(digiformaSessions);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//mhp connect//Events//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:mhp | connect - Agenda",
  ];

  for (const event of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.id}@mhp-connect`);
    lines.push(`DTSTART:${formatIcalDate(event.startAt)}`);
    lines.push(`DTEND:${formatIcalDate(event.endAt)}`);
    lines.push(`SUMMARY:${escapeIcal(event.title)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeIcal(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeIcal(event.location)}`);
    if (event.meetingUrl) lines.push(`URL:${event.meetingUrl}`);
    lines.push(`DTSTAMP:${formatIcalDate(new Date())}`);
    lines.push("END:VEVENT");
  }

  for (const session of trainingSessions) {
    const vevent = generateIcalTrainingSession(session);
    if (vevent) lines.push(vevent);
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export async function getEngagementStats() {
  const totalEvents = await db
    .select({ cnt: count() })
    .from(communityEvents);

  const publishedEvents = await db
    .select({ cnt: count() })
    .from(communityEvents)
    .where(eq(communityEvents.published, true));

  const totalRsvps = await db
    .select({ cnt: count() })
    .from(eventRsvps);

  const attendingRsvps = await db
    .select({ cnt: count() })
    .from(eventRsvps)
    .where(eq(eventRsvps.status, "attending"));

  const now = new Date();
  const upcomingEvents = await db
    .select({ cnt: count() })
    .from(communityEvents)
    .where(
      and(
        eq(communityEvents.published, true),
        gte(communityEvents.startAt, now)
      )
    );

  const uniqueAttendees = await db
    .select({ cnt: sql<number>`COUNT(DISTINCT ${eventRsvps.userId})` })
    .from(eventRsvps)
    .where(eq(eventRsvps.status, "attending"));

  return {
    totalEvents: totalEvents[0]?.cnt ?? 0,
    publishedEvents: publishedEvents[0]?.cnt ?? 0,
    upcomingEvents: upcomingEvents[0]?.cnt ?? 0,
    totalRsvps: totalRsvps[0]?.cnt ?? 0,
    attendingRsvps: attendingRsvps[0]?.cnt ?? 0,
    uniqueAttendees: uniqueAttendees[0]?.cnt ?? 0,
  };
}

export async function enrichWithCounts(events: CommunityEvent[]) {
  if (events.length === 0) return [];

  const eventIds = events.map((e) => e.id);
  const rsvpRows = await db
    .select({
      eventId: eventRsvps.eventId,
      status: eventRsvps.status,
      cnt: count(),
    })
    .from(eventRsvps)
    .where(inArray(eventRsvps.eventId, eventIds))
    .groupBy(eventRsvps.eventId, eventRsvps.status);

  const rsvpMap = new Map<string, Record<string, number>>();
  for (const r of rsvpRows) {
    if (!rsvpMap.has(r.eventId)) {
      rsvpMap.set(r.eventId, { attending: 0, maybe: 0, not_attending: 0 });
    }
    rsvpMap.get(r.eventId)![r.status] = r.cnt;
  }

  return events.map((e) => ({
    ...e,
    rsvpCounts: rsvpMap.get(e.id) ?? { attending: 0, maybe: 0, not_attending: 0 },
  }));
}

export async function getAttendanceReport() {
  const events = await db
    .select()
    .from(communityEvents)
    .orderBy(desc(communityEvents.startAt));

  const eventIds = events.map((e) => e.id);
  if (eventIds.length === 0) return [];

  const rsvpRows = await db
    .select({
      eventId: eventRsvps.eventId,
      status: eventRsvps.status,
      cnt: count(),
    })
    .from(eventRsvps)
    .where(inArray(eventRsvps.eventId, eventIds))
    .groupBy(eventRsvps.eventId, eventRsvps.status);

  const rsvpMap = new Map<string, Record<string, number>>();
  for (const r of rsvpRows) {
    if (!rsvpMap.has(r.eventId)) {
      rsvpMap.set(r.eventId, { attending: 0, maybe: 0, not_attending: 0 });
    }
    rsvpMap.get(r.eventId)![r.status] = r.cnt;
  }

  return events.map((e) => ({
    ...e,
    rsvpCounts: rsvpMap.get(e.id) ?? { attending: 0, maybe: 0, not_attending: 0 },
  }));
}
