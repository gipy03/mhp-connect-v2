CREATE TABLE IF NOT EXISTS "community_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"event_type" varchar(50) NOT NULL,
	"location" varchar(500),
	"location_address" text,
	"is_remote" boolean DEFAULT false NOT NULL,
	"meeting_url" text,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"max_attendees" integer,
	"created_by" uuid,
	"program_code" varchar(100),
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "chk_community_event_type" CHECK ("community_events"."event_type" IN ('meetup', 'webinar', 'networking', 'workshop', 'other'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_rsvps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "chk_rsvp_status" CHECK ("event_rsvps"."status" IN ('attending', 'maybe', 'not_attending'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_events" ADD CONSTRAINT "community_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_event_id_community_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."community_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_community_events_start_at" ON "community_events" USING btree ("start_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_community_events_program_code" ON "community_events" USING btree ("program_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_community_events_created_by" ON "community_events" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_event_rsvps_event_user" ON "event_rsvps" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_event_rsvps_event_id" ON "event_rsvps" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_event_rsvps_user_id" ON "event_rsvps" USING btree ("user_id");