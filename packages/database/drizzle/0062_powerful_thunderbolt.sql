ALTER TABLE "reservation_drafts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "reservation_drafts" CASCADE;--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_source_reference";--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_draft_id_reservation_drafts_id_fk";
--> statement-breakpoint
ALTER TABLE "inspection_photos" ALTER COLUMN "cloudinary_public_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "inspection_photos" ALTER COLUMN "cloudinary_format" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "inspection_photos" DROP COLUMN "data_base64";--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "draft_id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "password_hash";--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_source_reference" CHECK ((
        ("payments"."booking_id" IS NOT NULL AND "payments"."rental_charge_id" IS NULL AND "payments"."hold_token_hash" IS NOT NULL) OR
        ("payments"."booking_id" IS NULL AND "payments"."rental_charge_id" IS NOT NULL AND "payments"."hold_token_hash" IS NULL)
      ));--> statement-breakpoint
DROP TYPE "public"."reservation_draft_status";--> statement-breakpoint
DROP TYPE "public"."reservation_pricing_status";