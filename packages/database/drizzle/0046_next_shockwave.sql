ALTER TABLE "return_audit" ALTER COLUMN "actor_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "return_requests" ALTER COLUMN "created_by" DROP NOT NULL;