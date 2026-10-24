ALTER TYPE "public"."pricing_change_operation" ADD VALUE 'RENTAL_PRICE_RANGE';--> statement-breakpoint
CREATE TABLE "rental_price_ranges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(80) NOT NULL,
	"name" varchar(100) NOT NULL,
	"min_monthly_price" integer,
	"max_monthly_price" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rental_price_ranges_code_unique" UNIQUE("code"),
	CONSTRAINT "rental_price_ranges_bounds_valid" CHECK (("rental_price_ranges"."min_monthly_price" is null and "rental_price_ranges"."max_monthly_price" is null) or ("rental_price_ranges"."min_monthly_price" is not null and "rental_price_ranges"."max_monthly_price" is not null and "rental_price_ranges"."min_monthly_price" > 0 and "rental_price_ranges"."max_monthly_price" >= "rental_price_ranges"."min_monthly_price")),
	CONSTRAINT "rental_price_ranges_version_valid" CHECK ("rental_price_ranges"."version" >= 0)
);
--> statement-breakpoint
DROP INDEX "unit_types_code_idx";--> statement-breakpoint
ALTER TABLE "unit_types" ADD COLUMN "facility_id" uuid;--> statement-breakpoint
ALTER TABLE "unit_types" ADD COLUMN "price_range_id" uuid;--> statement-breakpoint
ALTER TABLE "unit_types" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "unit_types" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "rental_price_ranges" ADD CONSTRAINT "rental_price_ranges_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_types" ADD CONSTRAINT "unit_types_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_types" ADD CONSTRAINT "unit_types_price_range_id_rental_price_ranges_id_fk" FOREIGN KEY ("price_range_id") REFERENCES "public"."rental_price_ranges"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_types" ADD CONSTRAINT "unit_types_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unit_types_facility_code_idx" ON "unit_types" USING btree ("facility_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "unit_types_facility_id_idx" ON "unit_types" USING btree ("facility_id","id");--> statement-breakpoint
CREATE INDEX "unit_types_price_range_idx" ON "unit_types" USING btree ("price_range_id");--> statement-breakpoint
ALTER TABLE "unit_types" ADD CONSTRAINT "unit_types_version_valid" CHECK ("unit_types"."version" >= 0);