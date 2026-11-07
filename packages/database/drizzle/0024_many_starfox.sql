ALTER TABLE "bookings" DROP CONSTRAINT "bookings_facility_id_unit_type_id_unit_types_facility_id_id_fk";
--> statement-breakpoint
ALTER TABLE "capacity_allocations" DROP CONSTRAINT "capacity_allocations_facility_id_unit_type_id_unit_types_facility_id_id_fk";
--> statement-breakpoint
ALTER TABLE "reservations" DROP CONSTRAINT "reservations_facility_id_unit_type_id_unit_types_facility_id_id_fk";
--> statement-breakpoint
ALTER TABLE "storage_units" DROP CONSTRAINT "storage_units_facility_id_unit_type_id_unit_types_facility_id_id_fk";
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_facility_id_unit_type_id_facility_unit_types_facility_id_id_fk" FOREIGN KEY ("facility_id","unit_type_id") REFERENCES "public"."facility_unit_types"("facility_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_allocations" ADD CONSTRAINT "capacity_allocations_facility_id_unit_type_id_facility_unit_types_facility_id_id_fk" FOREIGN KEY ("facility_id","unit_type_id") REFERENCES "public"."facility_unit_types"("facility_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_facility_id_unit_type_id_facility_unit_types_facility_id_id_fk" FOREIGN KEY ("facility_id","unit_type_id") REFERENCES "public"."facility_unit_types"("facility_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_units" ADD CONSTRAINT "storage_units_facility_id_unit_type_id_facility_unit_types_facility_id_id_fk" FOREIGN KEY ("facility_id","unit_type_id") REFERENCES "public"."facility_unit_types"("facility_id","id") ON DELETE restrict ON UPDATE no action;