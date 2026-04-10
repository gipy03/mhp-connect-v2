CREATE TABLE IF NOT EXISTS "file_downloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"user_id" uuid,
	"downloaded_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "file_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_session_id" varchar(255),
	"amount_paid" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'CHF' NOT NULL,
	"purchased_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"category" varchar(255),
	"program_code" varchar(100),
	"visibility" varchar(20) DEFAULT 'members' NOT NULL,
	"price" numeric(10, 2),
	"currency" varchar(3) DEFAULT 'CHF' NOT NULL,
	"file_key" text NOT NULL,
	"file_name" varchar(500) NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" varchar(255) NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "chk_files_visibility" CHECK ("files"."visibility" IN ('public', 'members', 'program', 'paid'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "file_downloads" ADD CONSTRAINT "file_downloads_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "file_downloads" ADD CONSTRAINT "file_downloads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "file_purchases" ADD CONSTRAINT "file_purchases_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "file_purchases" ADD CONSTRAINT "file_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_downloads_file" ON "file_downloads" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_downloads_user" ON "file_downloads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_purchases_file" ON "file_purchases" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_file_purchases_user" ON "file_purchases" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_file_purchases_user_file" ON "file_purchases" USING btree ("user_id","file_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_files_category" ON "files" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_files_program_code" ON "files" USING btree ("program_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_files_visibility" ON "files" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_files_uploaded_by" ON "files" USING btree ("uploaded_by");