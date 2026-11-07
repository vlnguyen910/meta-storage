ALTER TABLE "unit_types" DROP CONSTRAINT "unit_types_facility_id_idx";--> statement-breakpoint
ALTER TABLE "unit_types" DROP CONSTRAINT "unit_types_price_positive";--> statement-breakpoint
ALTER TABLE "unit_types" DROP CONSTRAINT "unit_types_facility_id_facilities_id_fk";
--> statement-breakpoint
ALTER TABLE "unit_types" DROP CONSTRAINT "unit_types_price_range_id_rental_price_ranges_id_fk";
--> statement-breakpoint
DROP INDEX "unit_types_facility_code_idx";--> statement-breakpoint
DROP INDEX "unit_types_price_range_idx";--> statement-breakpoint
ALTER TABLE "unit_types" ALTER COLUMN "min_monthly_price" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "unit_types" ALTER COLUMN "max_monthly_price" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "unit_types_code_idx" ON "unit_types" USING btree ("code");--> statement-breakpoint
ALTER TABLE "unit_types" DROP COLUMN "facility_id";--> statement-breakpoint
ALTER TABLE "unit_types" DROP COLUMN "price_range_id";--> statement-breakpoint
ALTER TABLE "unit_types" DROP COLUMN "monthly_price";--> statement-breakpoint
ALTER TABLE "unit_types" ADD CONSTRAINT "unit_types_price_bounds" CHECK ("unit_types"."min_monthly_price" > 0 AND "unit_types"."max_monthly_price" >= "unit_types"."min_monthly_price");