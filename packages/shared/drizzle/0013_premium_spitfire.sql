CREATE TABLE IF NOT EXISTS "bexio_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bexio_id" integer NOT NULL,
	"document_nr" varchar(100) NOT NULL,
	"title" text,
	"invoice_date" date,
	"contact_id" integer NOT NULL,
	"contact_name" text,
	"total_incl_vat" numeric(12, 2),
	"total_remaining_payments" numeric(12, 2),
	"status" varchar(30) NOT NULL,
	"network_link" text,
	"api_reference" varchar(255),
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "bexio_invoices_bexio_id_unique" UNIQUE("bexio_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bexio_invoices" ADD CONSTRAINT "bexio_invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bexio_invoices_user_id" ON "bexio_invoices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bexio_invoices_contact_id" ON "bexio_invoices" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bexio_invoices_document_nr" ON "bexio_invoices" USING btree ("document_nr");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bexio_invoices_status" ON "bexio_invoices" USING btree ("status");