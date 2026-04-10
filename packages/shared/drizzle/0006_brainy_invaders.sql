ALTER TABLE "channels" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "program_overrides" ADD COLUMN "trainers" jsonb;