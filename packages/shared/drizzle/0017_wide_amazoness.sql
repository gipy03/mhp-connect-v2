CREATE TABLE IF NOT EXISTS "user_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "chk_user_contacts_status" CHECK ("user_contacts"."status" IN ('pending', 'accepted', 'rejected')),
	CONSTRAINT "chk_user_contacts_no_self" CHECK ("user_contacts"."requester_id" != "user_contacts"."recipient_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_contacts" ADD CONSTRAINT "user_contacts_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_contacts" ADD CONSTRAINT "user_contacts_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_contacts_requester" ON "user_contacts" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_contacts_recipient" ON "user_contacts" USING btree ("recipient_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_user_contacts_pair" ON "user_contacts" USING btree ("requester_id","recipient_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_user_contacts_canonical_pair" ON "user_contacts" USING btree (LEAST(requester_id, recipient_id), GREATEST(requester_id, recipient_id));