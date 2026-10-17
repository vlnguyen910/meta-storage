ALTER TABLE "capacity_allocations" ADD COLUMN "access_token_hash" varchar(128);--> statement-breakpoint
ALTER TABLE "capacity_allocations" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reservation_drafts" ADD COLUMN "access_token_hash" varchar(128);