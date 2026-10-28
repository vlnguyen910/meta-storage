ALTER TABLE "media_assets" ALTER COLUMN "cloudinary_resource_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."cloudinary_resource_type";--> statement-breakpoint
CREATE TYPE "public"."cloudinary_resource_type" AS ENUM('IMAGE', 'VIDEO', 'RAW');--> statement-breakpoint
ALTER TABLE "media_assets" ALTER COLUMN "cloudinary_resource_type" SET DATA TYPE "public"."cloudinary_resource_type" USING "cloudinary_resource_type"::"public"."cloudinary_resource_type";