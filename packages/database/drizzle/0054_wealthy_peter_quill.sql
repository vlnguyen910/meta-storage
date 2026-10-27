ALTER TABLE "facility_unit_types" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "facility_unit_types" CASCADE;--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_facility_id_unit_type_id_facility_unit_types_facility_id_unit_type_id_fk";
--> statement-breakpoint
ALTER TABLE "capacity_allocations" DROP CONSTRAINT "capacity_allocations_facility_id_unit_type_id_facility_unit_types_facility_id_unit_type_id_fk";
--> statement-breakpoint
ALTER TABLE "reservation_drafts" DROP CONSTRAINT "reservation_drafts_facility_id_unit_type_id_facility_unit_types_facility_id_unit_type_id_fk";
--> statement-breakpoint
ALTER TABLE "storage_units" DROP CONSTRAINT "storage_units_facility_id_unit_type_id_facility_unit_types_facility_id_unit_type_id_fk";
--> statement-breakpoint
ALTER TABLE "unit_types" ALTER COLUMN "facility_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "unit_types" ALTER COLUMN "price_range_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_facility_id_unit_type_id_unit_types_facility_id_id_fk" FOREIGN KEY ("facility_id","unit_type_id") REFERENCES "public"."unit_types"("facility_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_allocations" ADD CONSTRAINT "capacity_allocations_facility_id_unit_type_id_unit_types_facility_id_id_fk" FOREIGN KEY ("facility_id","unit_type_id") REFERENCES "public"."unit_types"("facility_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_drafts" ADD CONSTRAINT "reservation_drafts_facility_id_unit_type_id_unit_types_facility_id_id_fk" FOREIGN KEY ("facility_id","unit_type_id") REFERENCES "public"."unit_types"("facility_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_units" ADD CONSTRAINT "storage_units_facility_id_unit_type_id_unit_types_facility_id_id_fk" FOREIGN KEY ("facility_id","unit_type_id") REFERENCES "public"."unit_types"("facility_id","id") ON DELETE restrict ON UPDATE no action;