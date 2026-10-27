ALTER TABLE "bookings" DROP CONSTRAINT "bookings_contact_after_draft";--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_contact_complete";--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "access_token_hash";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "contact_name";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "contact_email";--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_phone_after_draft" CHECK ("bookings"."status" = 'DRAFT' OR "bookings"."contact_phone" IS NOT NULL);