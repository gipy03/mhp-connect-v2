CREATE TABLE IF NOT EXISTS "digiforma_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"digiforma_id" varchar(100) NOT NULL,
	"name" varchar(500),
	"code" varchar(100),
	"program_code" varchar(100),
	"program_name" varchar(500),
	"start_date" date,
	"end_date" date,
	"place" varchar(500),
	"place_name" varchar(500),
	"remote" boolean DEFAULT false,
	"inter" boolean DEFAULT false,
	"image_url" text,
	"dates" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "digiforma_sessions_digiforma_id_unique" UNIQUE("digiforma_id")
);
