CREATE TABLE IF NOT EXISTS "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text,
	"display_name" varchar(255),
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trainers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"digiforma_id" varchar(100),
	"first_name" varchar(255) NOT NULL,
	"last_name" varchar(255) NOT NULL,
	"email" varchar(255),
	"phone" varchar(50),
	"bio" text,
	"photo_url" text,
	"specialties" jsonb DEFAULT '[]'::jsonb,
	"role" varchar(255) DEFAULT 'Formateur',
	"active" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "trainers_digiforma_id_unique" UNIQUE("digiforma_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_admin_users_email" ON "admin_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trainers_digiforma_id" ON "trainers" USING btree ("digiforma_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trainers_email" ON "trainers" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trainers_active" ON "trainers" USING btree ("active");