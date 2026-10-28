CREATE TYPE "public"."reservation_status" AS ENUM('DRAFT', 'CONFIRMED', 'CANCELLED', 'NO_SHOW', 'CHECKED_IN');--> statement-breakpoint
ALTER TABLE "reservations" DROP CONSTRAINT "reservations_valid_status";--> statement-breakpoint
ALTER TABLE "reservations" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"public"."reservation_status";--> statement-breakpoint
ALTER TABLE "reservations" ALTER COLUMN "status" SET DATA TYPE "public"."reservation_status" USING "status"::"public"."reservation_status";