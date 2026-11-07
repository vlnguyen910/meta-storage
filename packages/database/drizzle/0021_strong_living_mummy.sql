ALTER TYPE "public"."pricing_change_operation" ADD VALUE 'UNIT_TYPE_PRICE_RANGE';--> statement-breakpoint
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
	CONSTRAINT "rental_price_ranges_bounds_valid" CHECK (("rental_price_ranges"."min_monthly_price" IS NULL AND "rental_price_ranges"."max_monthly_price" IS NULL) OR ("rental_price_ranges"."min_monthly_price" IS NOT NULL AND "rental_price_ranges"."max_monthly_price" IS NOT NULL AND "rental_price_ranges"."min_monthly_price" > 0 AND "rental_price_ranges"."max_monthly_price" >= "rental_price_ranges"."min_monthly_price")),
	CONSTRAINT "rental_price_ranges_version_valid" CHECK ("rental_price_ranges"."version" >= 0)
);
--> statement-breakpoint
ALTER TABLE "unit_types" ADD COLUMN "price_range_id" uuid;--> statement-breakpoint
ALTER TABLE "rental_price_ranges" ADD CONSTRAINT "rental_price_ranges_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_types" ADD CONSTRAINT "unit_types_price_range_id_rental_price_ranges_id_fk" FOREIGN KEY ("price_range_id") REFERENCES "public"."rental_price_ranges"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "unit_types_price_range_idx" ON "unit_types" USING btree ("price_range_id");