ALTER TYPE "public"."notification_delivery_status" ADD VALUE 'ENQUEUED' BEFORE 'SENT';--> statement-breakpoint
ALTER TABLE "return_refunds" ADD COLUMN "deposit_refund_amount" numeric(14, 0);--> statement-breakpoint
ALTER TABLE "return_refunds" ADD COLUMN "rent_refund_amount" numeric(14, 0);--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD COLUMN "booking_email" jsonb;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD COLUMN "mail_payload" text;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD COLUMN "mail_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD COLUMN "queued_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "return_refunds" ADD CONSTRAINT "return_refund_allocation_valid" CHECK ((
      ("return_refunds"."deposit_refund_amount" IS NULL AND "return_refunds"."rent_refund_amount" IS NULL) OR
      ("return_refunds"."deposit_refund_amount" IS NOT NULL AND "return_refunds"."rent_refund_amount" IS NOT NULL AND
       "return_refunds"."deposit_refund_amount" >= 0 AND "return_refunds"."rent_refund_amount" >= 0 AND
       "return_refunds"."deposit_refund_amount" + "return_refunds"."rent_refund_amount" = "return_refunds"."amount")
    ));