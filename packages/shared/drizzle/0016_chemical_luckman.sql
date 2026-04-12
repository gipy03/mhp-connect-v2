CREATE TABLE IF NOT EXISTS "sync_push_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_service" varchar(20) NOT NULL,
	"entity_type" varchar(20) NOT NULL,
	"entity_id" varchar(255) NOT NULL,
	"status" varchar(20) NOT NULL,
	"fields_pushed" jsonb,
	"error_detail" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sync_push_log_created_at" ON "sync_push_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sync_push_log_entity" ON "sync_push_log" USING btree ("entity_type","entity_id");