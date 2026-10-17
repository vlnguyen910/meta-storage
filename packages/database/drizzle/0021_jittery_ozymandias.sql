ALTER TABLE "unit_types" drop column "size_sqm";--> statement-breakpoint
ALTER TABLE "unit_types" ADD COLUMN "size_sqm" numeric GENERATED ALWAYS AS ("length_m" * "width_m") STORED NOT NULL;