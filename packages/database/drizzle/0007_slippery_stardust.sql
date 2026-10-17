CREATE TYPE "public"."capacity_allocation_kind" AS ENUM('HOLD', 'BOOKING');--> statement-breakpoint
CREATE TYPE "public"."capacity_allocation_status" AS ENUM('ACTIVE', 'RELEASED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."reservation_draft_status" AS ENUM('DRAFT');--> statement-breakpoint
CREATE TYPE "public"."reservation_pricing_status" AS ENUM('PRICING_NOT_CONFIGURED');--> statement-breakpoint
CREATE TABLE "capacity_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"unit_type_id" uuid NOT NULL,
	"reference_id" uuid NOT NULL,
	"kind" "capacity_allocation_kind" NOT NULL,
	"status" "capacity_allocation_status" DEFAULT 'ACTIVE' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facility_operating_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"open_time" time NOT NULL,
	"close_time" time NOT NULL,
	"timezone" varchar(64) DEFAULT 'Asia/Ho_Chi_Minh' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservation_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"unit_type_id" uuid NOT NULL,
	"check_in_at" timestamp with time zone NOT NULL,
	"rental_end_at" timestamp with time zone NOT NULL,
	"duration_months" integer NOT NULL,
	"contact_name" varchar(150) NOT NULL,
	"contact_email" varchar(320) NOT NULL,
	"contact_phone" varchar(32) NOT NULL,
	"status" "reservation_draft_status" DEFAULT 'DRAFT' NOT NULL,
	"pricing_status" "reservation_pricing_status" DEFAULT 'PRICING_NOT_CONFIGURED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "capacity_allocations" ADD CONSTRAINT "capacity_allocations_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_allocations" ADD CONSTRAINT "capacity_allocations_unit_type_id_facility_id_unit_types_id_facility_id_fk" FOREIGN KEY ("unit_type_id","facility_id") REFERENCES "public"."unit_types"("id","facility_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_operating_hours" ADD CONSTRAINT "facility_operating_hours_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_drafts" ADD CONSTRAINT "reservation_drafts_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservation_drafts" ADD CONSTRAINT "reservation_drafts_unit_type_id_facility_id_unit_types_id_facility_id_fk" FOREIGN KEY ("unit_type_id","facility_id") REFERENCES "public"."unit_types"("id","facility_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "capacity_allocations_unit_type_period_idx" ON "capacity_allocations" USING btree ("unit_type_id","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "capacity_allocations_reference_idx" ON "capacity_allocations" USING btree ("reference_id");--> statement-breakpoint
CREATE UNIQUE INDEX "facility_operating_hours_facility_day_idx" ON "facility_operating_hours" USING btree ("facility_id","day_of_week");--> statement-breakpoint
CREATE INDEX "facility_operating_hours_facility_idx" ON "facility_operating_hours" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "reservation_drafts_facility_idx" ON "reservation_drafts" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "reservation_drafts_unit_type_idx" ON "reservation_drafts" USING btree ("unit_type_id");