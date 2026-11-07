CREATE TABLE "facility_unit_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"unit_type_id" uuid NOT NULL,
	"monthly_price" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "facility_unit_types_facility_type_idx" UNIQUE("facility_id","unit_type_id"),
	CONSTRAINT "facility_unit_types_facility_id_idx" UNIQUE("facility_id","id"),
	CONSTRAINT "facility_unit_types_price_positive" CHECK ("facility_unit_types"."monthly_price" > 0),
	CONSTRAINT "facility_unit_types_version_valid" CHECK ("facility_unit_types"."version" >= 0)
);
--> statement-breakpoint
ALTER TABLE "unit_types" ADD COLUMN "min_monthly_price" integer;--> statement-breakpoint
ALTER TABLE "unit_types" ADD COLUMN "max_monthly_price" integer;--> statement-breakpoint
ALTER TABLE "facility_unit_types" ADD CONSTRAINT "facility_unit_types_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_unit_types" ADD CONSTRAINT "facility_unit_types_unit_type_id_unit_types_id_fk" FOREIGN KEY ("unit_type_id") REFERENCES "public"."unit_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_unit_types" ADD CONSTRAINT "facility_unit_types_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;