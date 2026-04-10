CREATE TABLE IF NOT EXISTS "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"partner_name" varchar(255) NOT NULL,
	"partner_logo_url" text,
	"discount_text" varchar(255),
	"category" varchar(100),
	"redemption_url" text,
	"redemption_code" varchar(255),
	"visibility" varchar(20) DEFAULT 'all' NOT NULL,
	"required_feature" varchar(100),
	"valid_from" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"published" boolean DEFAULT false NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "chk_offers_visibility" CHECK ("offers"."visibility" IN ('all', 'feature_gated'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_offers_published" ON "offers" USING btree ("published");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_offers_category" ON "offers" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_offers_valid_until" ON "offers" USING btree ("valid_until");