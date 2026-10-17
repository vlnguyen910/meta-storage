ALTER TABLE "unit_types" ALTER COLUMN "size_sqm" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "unit_types" ADD COLUMN "length_m" numeric NOT NULL;--> statement-breakpoint
ALTER TABLE "unit_types" ADD COLUMN "width_m" numeric NOT NULL;--> statement-breakpoint
ALTER TABLE "unit_types" ADD COLUMN "height_m" numeric NOT NULL;--> statement-breakpoint
ALTER TABLE "unit_types" ADD CONSTRAINT "unit_types_positive_dimensions" CHECK ("unit_types"."length_m" > 0 AND "unit_types"."width_m" > 0 AND "unit_types"."height_m" > 0);