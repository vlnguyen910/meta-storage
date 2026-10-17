CREATE TABLE "facility_unit_types" (
	"facility_id" uuid NOT NULL,
	"unit_type_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "facility_unit_types_facility_id_unit_type_id_pk" PRIMARY KEY("facility_id","unit_type_id")
);
--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_unit_type_id_facility_id_unit_types_id_facility_id_fk";
--> statement-breakpoint
ALTER TABLE "capacity_allocations" DROP CONSTRAINT "capacity_allocations_unit_type_id_facility_id_unit_types_id_facility_id_fk";
--> statement-breakpoint
ALTER TABLE "reservation_drafts" DROP CONSTRAINT "reservation_drafts_unit_type_id_facility_id_unit_types_id_facility_id_fk";
--> statement-breakpoint
ALTER TABLE "storage_units" DROP CONSTRAINT "storage_units_unit_type_id_facility_id_unit_types_id_facility_id_fk";
--> statement-breakpoint
ALTER TABLE "unit_types" DROP CONSTRAINT "unit_types_facility_id_facilities_id_fk";
--> statement-breakpoint
DROP INDEX "unit_types_facility_code_idx";--> statement-breakpoint
DROP INDEX "unit_types_id_facility_idx";--> statement-breakpoint
DROP INDEX "unit_types_facility_idx";--> statement-breakpoint
DROP INDEX "capacity_allocations_unit_type_period_idx";--> statement-breakpoint
ALTER TABLE "facility_unit_types" ADD CONSTRAINT "facility_unit_types_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_unit_types" ADD CONSTRAINT "facility_unit_types_unit_type_id_unit_types_id_fk" FOREIGN KEY ("unit_type_id") REFERENCES "public"."unit_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "facility_unit_types_unit_type_idx" ON "facility_unit_types" USING btree ("unit_type_id");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_facility_id_unit_type_id_facility_unit_types_facility_id_unit_type_id_fk" FOREIGN KEY ("facility_id","unit_type_id") REFERENCES "public"."facility_unit_types"("facility_id","unit_type_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_allocations" ADD CONSTRAINT "capacity_allocations_facility_id_unit_type_id_facility_unit_types_facility_id_unit_type_id_fk" FOREIGN KEY ("facility_id","unit_type_id") REFERENCES "public"."facility_unit_types"("facility_id","unit_type_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_drafts" ADD CONSTRAINT "reservation_drafts_facility_id_unit_type_id_facility_unit_types_facility_id_unit_type_id_fk" FOREIGN KEY ("facility_id","unit_type_id") REFERENCES "public"."facility_unit_types"("facility_id","unit_type_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_units" ADD CONSTRAINT "storage_units_facility_id_unit_type_id_facility_unit_types_facility_id_unit_type_id_fk" FOREIGN KEY ("facility_id","unit_type_id") REFERENCES "public"."facility_unit_types"("facility_id","unit_type_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unit_types_code_idx" ON "unit_types" USING btree ("code");--> statement-breakpoint
CREATE INDEX "capacity_allocations_unit_type_period_idx" ON "capacity_allocations" USING btree ("facility_id","unit_type_id","starts_at","ends_at");--> statement-breakpoint
ALTER TABLE "unit_types" DROP COLUMN "facility_id";