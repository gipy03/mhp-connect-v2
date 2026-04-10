ALTER TABLE "program_overrides" ADD COLUMN "hybrid_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "session_assignments" ADD COLUMN "participation_mode" varchar(20);