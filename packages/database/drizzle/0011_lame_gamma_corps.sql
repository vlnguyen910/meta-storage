CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_code" varchar(50),
	"customer_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"unit_type_id" uuid NOT NULL,
	"requested_months" integer NOT NULL,
	"contact_name" varchar(150) NOT NULL,
	"contact_email" varchar(255) NOT NULL,
	"contact_phone" varchar(30) NOT NULL,
	"check_in_slot_start" timestamp with time zone NOT NULL,
	"check_in_slot_end" timestamp with time zone,
	"rental_end_at" timestamp with time zone NOT NULL,
	"monthly_rate_snapshot" numeric(14, 2) NOT NULL,
	"rental_fee_amount" numeric(14, 2) NOT NULL,
	"deposit_amount" numeric(14, 2) NOT NULL,
	"total_amount" numeric(14, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'VND' NOT NULL,
	"status" varchar(50) DEFAULT 'CONFIRMED' NOT NULL,
	"qr_token" varchar(255),
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_bookingCode_unique" UNIQUE("booking_code"),
	CONSTRAINT "bookings_qrToken_unique" UNIQUE("qr_token")
);
--> statement-breakpoint
CREATE TABLE "rentals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"physical_unit_id" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'ACTIVE' NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"expected_end_at" timestamp with time zone NOT NULL,
	"actual_return_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"deposit_amount" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rentals_bookingId_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
CREATE TABLE "unit_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"physical_unit_id" uuid NOT NULL,
	"assigned_by" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'ACTIVE' NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid,
	"customer_id" uuid NOT NULL,
	"provider" varchar(32) NOT NULL,
	"provider_payment_id" varchar(128) NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"rental_fee_amount" numeric(14, 2) NOT NULL,
	"deposit_amount" numeric(14, 2) NOT NULL,
	"total_amount" numeric(14, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" "payment_status" NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_unit_type_id_facility_id_unit_types_id_facility_id_fk" FOREIGN KEY ("unit_type_id","facility_id") REFERENCES "public"."unit_types"("id","facility_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_physical_unit_id_storage_units_id_fk" FOREIGN KEY ("physical_unit_id") REFERENCES "public"."storage_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_assignments" ADD CONSTRAINT "unit_assignments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_assignments" ADD CONSTRAINT "unit_assignments_physical_unit_id_storage_units_id_fk" FOREIGN KEY ("physical_unit_id") REFERENCES "public"."storage_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_assignments" ADD CONSTRAINT "unit_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_facility_status_idx" ON "bookings" USING btree ("facility_id","status");--> statement-breakpoint
CREATE INDEX "bookings_customer_idx" ON "bookings" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "bookings_dates_idx" ON "bookings" USING btree ("check_in_slot_start","rental_end_at");--> statement-breakpoint
CREATE INDEX "rentals_facility_idx" ON "rentals" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "rentals_customer_idx" ON "rentals" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "rentals_active_unit_idx" ON "rentals" USING btree ("physical_unit_id","status","expected_end_at");--> statement-breakpoint
CREATE INDEX "unit_assignments_booking_idx" ON "unit_assignments" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "unit_assignments_physical_unit_idx" ON "unit_assignments" USING btree ("physical_unit_id");--> statement-breakpoint
CREATE INDEX "unit_assignments_booking_status_idx" ON "unit_assignments" USING btree ("booking_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_payment_idx" ON "payments" USING btree ("provider","provider_payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_idempotency_idx" ON "payments" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "payments_booking_idx" ON "payments" USING btree ("booking_id");