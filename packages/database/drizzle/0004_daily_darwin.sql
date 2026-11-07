ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
UPDATE "users" SET "role" = 'CUSTOMER' WHERE "role" = 'CUSTOMERl';--> statement-breakpoint
UPDATE "users" SET "role" = 'BUSINESS_OPERATION_MANAGER' WHERE "role" = 'BUSINEES_OPERATION_MANAGER';--> statement-breakpoint
DROP TYPE "public"."role";--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('CUSTOMER', 'FACILITY_STAFF', 'FACILITY_MANAGER', 'BUSINESS_OPERATION_MANAGER', 'SYSTEM_ADMIN');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."role" USING "role"::"public"."role";
