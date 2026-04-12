ALTER TABLE IF EXISTS "trainers" RENAME TO "instructors";

DROP INDEX IF EXISTS "idx_trainers_digiforma_id";
DROP INDEX IF EXISTS "idx_trainers_email";
DROP INDEX IF EXISTS "idx_trainers_active";

CREATE INDEX IF NOT EXISTS "idx_instructors_digiforma_id" ON "instructors" ("digiforma_id");
CREATE INDEX IF NOT EXISTS "idx_instructors_email" ON "instructors" ("email");
CREATE INDEX IF NOT EXISTS "idx_instructors_active" ON "instructors" ("active");

ALTER TABLE IF EXISTS "program_overrides" RENAME COLUMN "trainers" TO "instructors";
