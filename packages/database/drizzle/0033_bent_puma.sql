ALTER TYPE "public"."payment_status" ADD VALUE 'REFUND_PENDING' BEFORE 'REFUNDED';--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "refund_reason" varchar(64);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "refund_reference" varchar(128);--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "refunded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "refunded_by" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_refunded_by_users_id_fk" FOREIGN KEY ("refunded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;