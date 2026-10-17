CREATE TYPE "public"."storage_unit_status" AS ENUM('AVAILABLE', 'RESERVED', 'OCCUPIED', 'MAINTENANCE', 'INSPECTION', 'RETURN_PENDING', 'LOCKED', 'INACTIVE');--> statement-breakpoint
CREATE TABLE "storage_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"unit_type_id" uuid NOT NULL,
	"code" varchar(80) NOT NULL,
	"status" "storage_unit_status" DEFAULT 'AVAILABLE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "storage_units_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "unit_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(100) NOT NULL,
	"size_label" varchar(50) NOT NULL,
	"size_sqm" real NOT NULL,
	"monthly_price" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "storage_units" ADD CONSTRAINT "storage_units_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_types" ADD CONSTRAINT "unit_types_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "storage_units_facility_idx" ON "storage_units" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "storage_units_facility_status_idx" ON "storage_units" USING btree ("facility_id","status");--> statement-breakpoint
CREATE INDEX "storage_units_unit_type_idx" ON "storage_units" USING btree ("unit_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unit_types_facility_code_idx" ON "unit_types" USING btree ("facility_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "unit_types_id_facility_idx" ON "unit_types" USING btree ("id","facility_id");--> statement-breakpoint
CREATE INDEX "unit_types_facility_idx" ON "unit_types" USING btree ("facility_id");--> statement-breakpoint
ALTER TABLE "storage_units" ADD CONSTRAINT "storage_units_unit_type_id_facility_id_unit_types_id_facility_id_fk" FOREIGN KEY ("unit_type_id","facility_id") REFERENCES "public"."unit_types"("id","facility_id") ON DELETE restrict ON UPDATE no action;
