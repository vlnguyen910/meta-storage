ALTER TYPE "public"."reservation_pricing_status" ADD VALUE 'PRICED';--> statement-breakpoint
ALTER TABLE "reservation_drafts" ADD COLUMN "pricing" jsonb;