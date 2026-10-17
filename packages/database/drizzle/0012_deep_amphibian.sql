ALTER TABLE "bookings" ALTER COLUMN "contact_email" SET DATA TYPE varchar(320);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "draft_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "hold_token_hash" varchar(128) NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_draft_id_reservation_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."reservation_drafts"("id") ON DELETE restrict ON UPDATE no action;