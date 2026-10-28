CREATE TYPE "public"."inspection_condition" AS ENUM('GOOD', 'MINOR_DAMAGE', 'MAJOR_DAMAGE');--> statement-breakpoint
CREATE TYPE "public"."inspection_status" AS ENUM('PENDING', 'IN_PROGRESS', 'PASSED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."inspection_type" AS ENUM('CHECK_IN', 'CHECK_OUT', 'MAINTENANCE');--> statement-breakpoint
CREATE TYPE "public"."cloudinary_resource_type" AS ENUM('image', 'video', 'raw');--> statement-breakpoint
CREATE TYPE "public"."payment_refund_reason_code" AS ENUM('NO_CAPACITY', 'CHECK_IN_CLOSED', 'OFFERING_UNAVAILABLE', 'CUSTOMER_CANCELLATION', 'NO_SHOW');--> statement-breakpoint
CREATE TYPE "public"."rental_status" AS ENUM('ACTIVE', 'RETURN_PENDING', 'OVERDUE', 'CLOSED');--> statement-breakpoint
ALTER TABLE "inspections" DROP CONSTRAINT "inspections_type_valid";--> statement-breakpoint
ALTER TABLE "inspections" DROP CONSTRAINT "inspections_status_valid";--> statement-breakpoint
ALTER TABLE "inspections" DROP CONSTRAINT "inspections_condition_valid";--> statement-breakpoint
ALTER TABLE "media_assets" DROP CONSTRAINT "media_assets_cloudinary_type_valid";--> statement-breakpoint
ALTER TABLE "inspections" ALTER COLUMN "inspection_type" SET DATA TYPE "public"."inspection_type" USING "inspection_type"::"public"."inspection_type";--> statement-breakpoint
ALTER TABLE "inspections" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"public"."inspection_status";--> statement-breakpoint
ALTER TABLE "inspections" ALTER COLUMN "status" SET DATA TYPE "public"."inspection_status" USING "status"::"public"."inspection_status";--> statement-breakpoint
ALTER TABLE "inspections" ALTER COLUMN "condition" SET DATA TYPE "public"."inspection_condition" USING "condition"::"public"."inspection_condition";--> statement-breakpoint
ALTER TABLE "media_assets" ALTER COLUMN "cloudinary_resource_type" SET DATA TYPE "public"."cloudinary_resource_type" USING "cloudinary_resource_type"::"public"."cloudinary_resource_type";--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "refund_reason" SET DATA TYPE "public"."payment_refund_reason_code" USING "refund_reason"::"public"."payment_refund_reason_code";--> statement-breakpoint
ALTER TABLE "rentals" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"public"."rental_status";--> statement-breakpoint
ALTER TABLE "rentals" ALTER COLUMN "status" SET DATA TYPE "public"."rental_status" USING "status"::"public"."rental_status";