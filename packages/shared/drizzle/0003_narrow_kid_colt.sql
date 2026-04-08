ALTER TABLE "program_enrollments" ALTER COLUMN "bexio_total" SET DATA TYPE numeric(10, 2) USING NULLIF(regexp_replace(bexio_total, '[^0-9.\-]', '', 'g'), '')::numeric(10,2);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_accredible_credentials_user_id" ON "accredible_credentials" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_auth_tokens_user_id" ON "auth_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_certifications_user_id" ON "certifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_channels_program_code" ON "channels" USING btree ("program_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_comments_author_id" ON "comments" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_digiforma_sessions_program_code_start_date" ON "digiforma_sessions" USING btree ("program_code","start_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notification_templates_updated_by" ON "notification_templates" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_template_id" ON "notifications" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_posts_author_id" ON "posts" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_enrollments_pricing_tier" ON "program_enrollments" USING btree ("pricing_tier_used");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_program_feature_grants_program_code" ON "program_feature_grants" USING btree ("program_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_program_feature_grants_created_by" ON "program_feature_grants" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_program_pricing_active_program_code" ON "program_pricing" USING btree ("active","program_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reactions_user_id" ON "reactions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_reactions_user_post_type" ON "reactions" USING btree ("user_id","post_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_reactions_user_comment_type" ON "reactions" USING btree ("user_id","comment_id","type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_refund_requests_enrollment_id" ON "refund_requests" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_refund_requests_processed_by" ON "refund_requests" USING btree ("processed_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_session_assignments_enrollment_id" ON "session_assignments" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_profiles_user_id" ON "user_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_profiles_directory_visibility" ON "user_profiles" USING btree ("directory_visibility");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_profiles_country" ON "user_profiles" USING btree ("country");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_profiles_city" ON "user_profiles" USING btree ("city");--> statement-breakpoint
ALTER TABLE "program_enrollments" ADD CONSTRAINT "chk_enrollment_status" CHECK ("program_enrollments"."status" IN ('active', 'completed', 'refunded'));--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "chk_reactions_xor_target" CHECK (("reactions"."post_id" IS NOT NULL AND "reactions"."comment_id" IS NULL) OR ("reactions"."post_id" IS NULL AND "reactions"."comment_id" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "session_assignments" ADD CONSTRAINT "chk_assignment_status" CHECK ("session_assignments"."status" IN ('assigned', 'cancelled', 'attended', 'noshow'));--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "chk_directory_visibility" CHECK ("user_profiles"."directory_visibility" IN ('hidden', 'internal', 'public'));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "chk_users_role" CHECK ("users"."role" IN ('member', 'admin'));