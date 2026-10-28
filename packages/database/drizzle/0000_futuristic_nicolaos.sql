CREATE TYPE "public"."capacity_allocation_kind" AS ENUM('HOLD', 'BOOKING');--> statement-breakpoint
CREATE TYPE "public"."capacity_allocation_status" AS ENUM('ACTIVE', 'RELEASED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."checkin_verification_status" AS ENUM('VERIFIED', 'CONSUMED', 'INVALIDATED');--> statement-breakpoint
CREATE TYPE "public"."facility_task_reference_type" AS ENUM('BOOKING', 'STORAGE_UNIT', 'SUPPORT_TICKET');--> statement-breakpoint
CREATE TYPE "public"."facility_task_status" AS ENUM('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."facility_task_type" AS ENUM('CHECK_IN_HANDOVER', 'UNIT_INSPECTION', 'HANDLE_SUPPORT');--> statement-breakpoint
CREATE TYPE "public"."inspection_status" AS ENUM('DRAFT', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."lifecycle_notification_event" AS ENUM('SUPPORT_CREATED', 'SUPPORT_UPDATED', 'PAYMENT_CONFIRMED', 'BOOKING_CONFIRMED', 'UPCOMING_EXPIRY', 'RENTAL_OVERDUE', 'ABANDONED_REVIEW', 'RETURN_SCHEDULED', 'RETURN_CHANGED', 'RETURN_INSPECTION', 'RETURN_SETTLED', 'RETURN_REFUND', 'RETURN_TIME_CHANGED');--> statement-breakpoint
CREATE TYPE "public"."notification_delivery_status" AS ENUM('PENDING', 'PROCESSING', 'ENQUEUED', 'SENT', 'REVIEW_REQUIRED', 'SUPPRESSED');--> statement-breakpoint
CREATE TYPE "public"."payment_provider_event_status" AS ENUM('PROCESSED', 'IGNORED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'SUCCEEDED', 'FAILED', 'REFUND_PENDING', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."pricing_change_operation" AS ENUM('DEPOSIT_POLICY', 'UNIT_TYPE_PRICE', 'RENTAL_PRICE_RANGE');--> statement-breakpoint
CREATE TYPE "public"."rental_charge_adjustment_direction" AS ENUM('INCREASE', 'REDUCTION');--> statement-breakpoint
CREATE TYPE "public"."rental_charge_event_type" AS ENUM('SUBMITTED', 'APPROVED', 'REJECTED', 'DISPUTED', 'DISPUTE_UPHELD', 'DISPUTE_REDUCED', 'DISPUTE_WAIVED', 'ADJUSTED', 'PAID', 'REFUND_CREATED', 'REFUND_CONFIRMED', 'REFUND_CANCELLED', 'VOIDED');--> statement-breakpoint
CREATE TYPE "public"."rental_charge_refund_status" AS ENUM('PENDING', 'CONFIRMED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."rental_charge_category" AS ENUM('LOCK_REPLACEMENT', 'KEY_REPLACEMENT', 'ACCESS_DEVICE_REPLACEMENT', 'FACILITY_SERVICE', 'CLEANING', 'RETURN_DEBT', 'RENEWAL_RENT');--> statement-breakpoint
CREATE TYPE "public"."rental_charge_source" AS ENUM('EXTRA', 'RETURN_DEBT', 'RENEWAL');--> statement-breakpoint
CREATE TYPE "public"."rental_charge_status" AS ENUM('PENDING_APPROVAL', 'OPEN', 'DISPUTED', 'PAID', 'VOID', 'REFUND_DUE', 'PARTIALLY_REFUNDED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."renewal_status" AS ENUM('QUOTED', 'AWAITING_PAYMENT', 'APPLIED', 'EXPIRED', 'REFUND_REQUIRED');--> statement-breakpoint
CREATE TYPE "public"."return_inspection_status" AS ENUM('DRAFT', 'PASS', 'FAIL');--> statement-breakpoint
CREATE TYPE "public"."return_request_status" AS ENUM('PENDING', 'CONFIRMED', 'INSPECTING', 'FAILED', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."return_time_change_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."storage_unit_status" AS ENUM('AVAILABLE', 'RESERVED', 'OCCUPIED', 'MAINTENANCE', 'INSPECTION', 'RETURN_PENDING', 'LOCKED', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."support_category" AS ENUM('UNIT', 'LOCK', 'ACCESS_CODE', 'STORED_ITEMS', 'PAYMENT');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('CUSTOMER', 'FACILITY_STAFF', 'FACILITY_MANAGER', 'BUSINESS_OPERATION_MANAGER', 'SYSTEM_ADMIN');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_code" varchar(50),
	"user_id" uuid NOT NULL,
	"contact_phone" varchar(32),
	"facility_id" uuid NOT NULL,
	"unit_type_id" uuid NOT NULL,
	"requested_months" integer NOT NULL,
	"check_in_date" date NOT NULL,
	"check_in_slot_id" uuid NOT NULL,
	"rental_end_at" timestamp with time zone NOT NULL,
	"monthly_rate_snapshot" numeric(14, 2) NOT NULL,
	"rental_fee_amount" numeric(14, 2) NOT NULL,
	"deposit_amount" numeric(14, 2) NOT NULL,
	"total_amount" numeric(14, 2) NOT NULL,
	"status" varchar(50) DEFAULT 'DRAFT' NOT NULL,
	"assigned_staff_id" uuid,
	"qr_token_hash" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_bookingCode_unique" UNIQUE("booking_code"),
	CONSTRAINT "bookings_qrTokenHash_unique" UNIQUE("qr_token_hash"),
	CONSTRAINT "bookings_valid_status" CHECK ("bookings"."status" IN ('DRAFT', 'CONFIRMED', 'CANCELLED', 'NO_SHOW', 'CHECKED_IN')),
	CONSTRAINT "bookings_phone_after_draft" CHECK ("bookings"."status" = 'DRAFT' OR "bookings"."contact_phone" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "capacity_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"unit_type_id" uuid NOT NULL,
	"reference_id" uuid NOT NULL,
	"access_token_hash" varchar(128),
	"kind" "capacity_allocation_kind" NOT NULL,
	"status" "capacity_allocation_status" DEFAULT 'ACTIVE' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "check_in_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkin_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"unit_assignment_id" uuid NOT NULL,
	"status" "checkin_verification_status" DEFAULT 'VERIFIED' NOT NULL,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consumed_at" timestamp with time zone,
	"invalidated_at" timestamp with time zone,
	"invalidated_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(150) NOT NULL,
	"address" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "facilities_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "facility_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"role" "role" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facility_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"type" "facility_task_type" NOT NULL,
	"status" "facility_task_status" DEFAULT 'ASSIGNED' NOT NULL,
	"reference_type" "facility_task_reference_type" NOT NULL,
	"reference_id" uuid NOT NULL,
	"assigned_staff_id" uuid NOT NULL,
	"assigned_by" uuid NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "facility_tasks_version_valid" CHECK ("facility_tasks"."version" >= 0),
	CONSTRAINT "facility_tasks_lifecycle_valid" CHECK (("facility_tasks"."status" = 'ASSIGNED' AND "facility_tasks"."started_at" IS NULL AND "facility_tasks"."completed_at" IS NULL)
        OR ("facility_tasks"."status" = 'IN_PROGRESS' AND "facility_tasks"."started_at" IS NOT NULL AND "facility_tasks"."completed_at" IS NULL)
        OR ("facility_tasks"."status" = 'COMPLETED' AND "facility_tasks"."started_at" IS NOT NULL AND "facility_tasks"."completed_at" IS NOT NULL)
        OR "facility_tasks"."status" = 'CANCELLED'),
	CONSTRAINT "facility_tasks_reference_valid" CHECK (("facility_tasks"."type" = 'CHECK_IN_HANDOVER' AND "facility_tasks"."reference_type" = 'BOOKING') OR ("facility_tasks"."type" = 'UNIT_INSPECTION' AND "facility_tasks"."reference_type" IN ('BOOKING', 'STORAGE_UNIT')) OR ("facility_tasks"."type" = 'HANDLE_SUPPORT' AND "facility_tasks"."reference_type" = 'SUPPORT_TICKET'))
);
--> statement-breakpoint
CREATE TABLE "handover_inspections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"physical_unit_id" uuid NOT NULL,
	"unit_assignment_id" uuid NOT NULL,
	"verification_id" uuid NOT NULL,
	"unit_code" varchar(100) NOT NULL,
	"policy_version" varchar(20) DEFAULT 'H6_V1' NOT NULL,
	"checklist_version" varchar(30),
	"checklist_results" jsonb,
	"checklist_definition" jsonb,
	"status" "inspection_status" DEFAULT 'DRAFT' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"correct_unit" boolean,
	"condition_notes" text DEFAULT '' NOT NULL,
	"created_by" uuid NOT NULL,
	"completed_by" uuid,
	"completed_at" timestamp with time zone,
	"handed_over_by" uuid,
	"handed_over_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "handover_inspections_verificationId_unique" UNIQUE("verification_id")
);
--> statement-breakpoint
CREATE TABLE "inspection_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inspection_id" uuid NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"filename" varchar(120) NOT NULL,
	"mime_type" varchar(40) NOT NULL,
	"byte_size" integer NOT NULL,
	"cloudinary_public_id" text NOT NULL,
	"cloudinary_format" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"session_id" varchar(255) NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"device" varchar(120),
	"operating_system" varchar(120),
	"browser" varchar(120),
	"model" varchar(120),
	CONSTRAINT "login_history_sessionId_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "notification_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_key" text NOT NULL,
	"recipient_key" text NOT NULL,
	"event_type" "lifecycle_notification_event" NOT NULL,
	"support_ticket_id" uuid,
	"booking_id" uuid NOT NULL,
	"rental_term_version" integer,
	"facility_id" uuid NOT NULL,
	"recipient_user_id" uuid,
	"recipient_role" text NOT NULL,
	"recipient_email" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"booking_email" jsonb,
	"mail_payload" text,
	"mail_expires_at" timestamp with time zone,
	"queued_at" timestamp with time zone,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "notification_delivery_status" DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"first_attempt_at" timestamp with time zone,
	"lease_token" uuid,
	"lease_until" timestamp with time zone,
	"provider_message_id" text,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payment_provider_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(32) NOT NULL,
	"provider_event_id" varchar(128) NOT NULL,
	"payment_id" uuid,
	"payment_code" varchar(32) NOT NULL,
	"amount" integer NOT NULL,
	"transfer_type" varchar(16) NOT NULL,
	"reference_code" varchar(128),
	"status" "payment_provider_event_status" NOT NULL,
	"payload_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid,
	"rental_charge_id" uuid,
	"hold_token_hash" varchar(128),
	"provider" varchar(32) NOT NULL,
	"payment_code" varchar(32) NOT NULL,
	"provider_payment_id" varchar(128) NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"total_amount" numeric(14, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" "payment_status" NOT NULL,
	"paid_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"refund_reason" varchar(64),
	"refund_amount" numeric(14, 2),
	"deposit_forfeited_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"refund_reference" varchar(128),
	"refunded_at" timestamp with time zone,
	"refunded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_paymentCode_unique" UNIQUE("payment_code"),
	CONSTRAINT "payments_refund_amount_valid" CHECK ("payments"."refund_amount" IS NULL OR ("payments"."refund_amount" >= 0 AND "payments"."refund_amount" <= "payments"."total_amount")),
	CONSTRAINT "payments_deposit_forfeited_valid" CHECK ("payments"."deposit_forfeited_amount" >= 0 AND "payments"."deposit_forfeited_amount" <= "payments"."total_amount"
        AND ("payments"."refund_amount" IS NULL OR "payments"."refund_amount" + "payments"."deposit_forfeited_amount" <= "payments"."total_amount")),
	CONSTRAINT "payments_source_reference" CHECK ((
        ("payments"."booking_id" IS NOT NULL AND "payments"."rental_charge_id" IS NULL AND "payments"."hold_token_hash" IS NOT NULL) OR
        ("payments"."booking_id" IS NULL AND "payments"."rental_charge_id" IS NOT NULL AND "payments"."hold_token_hash" IS NULL)
      ))
);
--> statement-breakpoint
CREATE TABLE "pricing_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer NOT NULL,
	"operation" "pricing_change_operation" NOT NULL,
	"before" jsonb NOT NULL,
	"after" jsonb NOT NULL,
	"changed_by" uuid NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pricing_changes_version_unique" UNIQUE("version"),
	CONSTRAINT "pricing_changes_positive_version" CHECK ("pricing_changes"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "rental_charge_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"charge_id" uuid NOT NULL,
	"settlement_id" uuid,
	"direction" "rental_charge_adjustment_direction" NOT NULL,
	"amount" numeric(14, 0) NOT NULL,
	"reason" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rental_charge_adjustments_amount_positive" CHECK ("rental_charge_adjustments"."amount" > 0),
	CONSTRAINT "rental_charge_adjustments_reason_nonempty" CHECK (length(trim("rental_charge_adjustments"."reason")) > 0)
);
--> statement-breakpoint
CREATE TABLE "rental_charge_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"charge_id" uuid NOT NULL,
	"type" "rental_charge_event_type" NOT NULL,
	"actor_id" uuid,
	"reason" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rental_charge_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"charge_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"settlement_id" uuid,
	"amount" numeric(14, 0) NOT NULL,
	"reason" text NOT NULL,
	"status" "rental_charge_refund_status" DEFAULT 'PENDING' NOT NULL,
	"reference" text,
	"confirmed_by" uuid,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rental_charge_refunds_amount_positive" CHECK ("rental_charge_refunds"."amount" > 0),
	CONSTRAINT "rental_charge_refunds_reason_nonempty" CHECK (length(trim("rental_charge_refunds"."reason")) > 0),
	CONSTRAINT "rental_charge_refunds_confirmation_valid" CHECK (("rental_charge_refunds"."status" = 'PENDING' AND "rental_charge_refunds"."reference" IS NULL AND "rental_charge_refunds"."confirmed_at" IS NULL AND "rental_charge_refunds"."confirmed_by" IS NULL) OR ("rental_charge_refunds"."status" = 'CONFIRMED' AND "rental_charge_refunds"."reference" IS NOT NULL AND "rental_charge_refunds"."confirmed_at" IS NOT NULL AND "rental_charge_refunds"."confirmed_by" IS NOT NULL) OR ("rental_charge_refunds"."status" = 'CANCELLED' AND "rental_charge_refunds"."reference" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "rental_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rental_id" uuid NOT NULL,
	"source" "rental_charge_source" NOT NULL,
	"category" "rental_charge_category" NOT NULL,
	"amount" numeric(14, 0) NOT NULL,
	"currency" varchar(3) DEFAULT 'VND' NOT NULL,
	"evidence" text NOT NULL,
	"due_date" date,
	"status" "rental_charge_status" DEFAULT 'PENDING_APPROVAL' NOT NULL,
	"created_by" uuid NOT NULL,
	"approved_by" uuid,
	"decision_reason" text,
	"disputed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rental_charges_amount_positive" CHECK ("rental_charges"."amount" > 0),
	CONSTRAINT "rental_charges_currency_vnd" CHECK ("rental_charges"."currency" = 'VND'),
	CONSTRAINT "rental_charges_evidence_nonempty" CHECK (length(trim("rental_charges"."evidence")) > 0),
	CONSTRAINT "rental_charges_source_category_valid" CHECK (("rental_charges"."source" = 'EXTRA' AND "rental_charges"."category" IN ('LOCK_REPLACEMENT','KEY_REPLACEMENT','ACCESS_DEVICE_REPLACEMENT','FACILITY_SERVICE','CLEANING')) OR ("rental_charges"."source" = 'RETURN_DEBT' AND "rental_charges"."category" = 'RETURN_DEBT') OR ("rental_charges"."source" = 'RENEWAL' AND "rental_charges"."category" = 'RENEWAL_RENT'))
);
--> statement-breakpoint
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
CREATE TABLE "rental_renewals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rental_id" uuid NOT NULL,
	"customer_id" uuid,
	"rental_version" integer NOT NULL,
	"charge_id" uuid,
	"payment_id" uuid,
	"idempotency_key" varchar(128) NOT NULL,
	"status" "renewal_status" DEFAULT 'QUOTED' NOT NULL,
	"months" integer NOT NULL,
	"old_end_at" timestamp with time zone NOT NULL,
	"new_end_at" timestamp with time zone NOT NULL,
	"monthly_rate" numeric(14, 0) NOT NULL,
	"amount" numeric(14, 0) NOT NULL,
	"currency" varchar(3) DEFAULT 'VND' NOT NULL,
	"timezone" text NOT NULL,
	"cutoff_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"terms_version" varchar(128) NOT NULL,
	"terms" text NOT NULL,
	"accepted_at" timestamp with time zone,
	"applied_at" timestamp with time zone,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rental_renewals_chargeId_unique" UNIQUE("charge_id"),
	CONSTRAINT "rental_renewals_paymentId_unique" UNIQUE("payment_id"),
	CONSTRAINT "rental_renewals_period_valid" CHECK ("rental_renewals"."months" between 1 and 12 and "rental_renewals"."new_end_at" = "rental_renewals"."old_end_at" + "rental_renewals"."months" * interval '720 hours'),
	CONSTRAINT "rental_renewals_amount_valid" CHECK ("rental_renewals"."monthly_rate" > 0 and "rental_renewals"."amount" = "rental_renewals"."monthly_rate" * "rental_renewals"."months" and "rental_renewals"."currency" = 'VND'),
	CONSTRAINT "rental_renewals_deadline_valid" CHECK ("rental_renewals"."expires_at" > "rental_renewals"."created_at" and "rental_renewals"."expires_at" <= "rental_renewals"."created_at" + interval '15 minutes' and "rental_renewals"."expires_at" <= "rental_renewals"."cutoff_at"),
	CONSTRAINT "rental_renewals_version_valid" CHECK ("rental_renewals"."rental_version" >= 0),
	CONSTRAINT "rental_renewals_acceptance_valid" CHECK (("rental_renewals"."charge_id" is null and "rental_renewals"."accepted_at" is null and "rental_renewals"."status" in ('QUOTED', 'EXPIRED')) or ("rental_renewals"."charge_id" is not null and "rental_renewals"."accepted_at" is not null and "rental_renewals"."status" <> 'QUOTED')),
	CONSTRAINT "rental_renewals_application_valid" CHECK (("rental_renewals"."status" = 'APPLIED' and "rental_renewals"."payment_id" is not null and "rental_renewals"."applied_at" is not null and "rental_renewals"."failure_reason" is null) or ("rental_renewals"."status" <> 'APPLIED' and "rental_renewals"."applied_at" is null))
);
--> statement-breakpoint
CREATE TABLE "rentals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"physical_unit_id" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'ACTIVE' NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"expected_end_at" timestamp with time zone NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"actual_return_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"abandoned_review_at" timestamp with time zone,
	"deposit_amount" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rentals_bookingId_unique" UNIQUE("booking_id"),
	CONSTRAINT "rentals_version_nonnegative" CHECK ("rentals"."version" >= 0)
);
--> statement-breakpoint
CREATE TABLE "return_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid,
	"facility_id" uuid,
	"actor_id" uuid,
	"action" text NOT NULL,
	"details" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "return_checklist_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer NOT NULL,
	"items" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "return_checklist_versions_version_unique" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE "return_evidence_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"public_id" text NOT NULL,
	"format" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "return_inspection_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inspection_id" uuid NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"public_id" text NOT NULL,
	"format" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "return_inspections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"attempt" integer NOT NULL,
	"checklist_version_id" uuid NOT NULL,
	"definition" jsonb NOT NULL,
	"results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "return_inspection_status" DEFAULT 'DRAFT' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"property_disposition" text DEFAULT 'NONE' NOT NULL,
	"property_receiver" text,
	"property_handled_at" timestamp with time zone,
	"property_evidence_photo_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"completed_by" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "return_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"settlement_id" uuid NOT NULL,
	"amount" numeric(14, 0) NOT NULL,
	"deposit_refund_amount" numeric(14, 0),
	"rent_refund_amount" numeric(14, 0),
	"reference" text NOT NULL,
	"evidence_photo_ids" jsonb NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"confirmed_by" uuid NOT NULL,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "return_refund_amount_positive" CHECK ("return_refunds"."amount" > 0),
	CONSTRAINT "return_refund_allocation_valid" CHECK ((
      ("return_refunds"."deposit_refund_amount" IS NULL AND "return_refunds"."rent_refund_amount" IS NULL) OR
      ("return_refunds"."deposit_refund_amount" IS NOT NULL AND "return_refunds"."rent_refund_amount" IS NOT NULL AND
       "return_refunds"."deposit_refund_amount" >= 0 AND "return_refunds"."rent_refund_amount" >= 0 AND
       "return_refunds"."deposit_refund_amount" + "return_refunds"."rent_refund_amount" = "return_refunds"."amount")
    ))
);
--> statement-breakpoint
CREATE TABLE "return_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rental_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"slot_id" uuid NOT NULL,
	"date" date NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"timezone" text NOT NULL,
	"status" "return_request_status" DEFAULT 'PENDING' NOT NULL,
	"assigned_staff_id" uuid,
	"version" integer DEFAULT 0 NOT NULL,
	"reason" text NOT NULL,
	"manual_review_required" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "return_request_period_valid" CHECK ("return_requests"."ends_at" > "return_requests"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "return_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"rental_charge_id" uuid,
	"revision" integer NOT NULL,
	"deposit_snapshot" numeric(14, 0) NOT NULL,
	"rate_snapshot" integer NOT NULL,
	"overdue_fee_amount" numeric(14, 0) NOT NULL,
	"damage_amount" numeric(14, 0) NOT NULL,
	"unused_rent_refund_amount" numeric(14, 0) NOT NULL,
	"refund_entitlement" numeric(14, 0) NOT NULL,
	"debt_amount" numeric(14, 0) NOT NULL,
	"actual_return_at" timestamp with time zone NOT NULL,
	"refund_due_date" date NOT NULL,
	"calendar_snapshot" jsonb NOT NULL,
	"approved_by" uuid NOT NULL,
	"reason" text NOT NULL,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "return_settlement_amounts_valid" CHECK ("return_settlements"."deposit_snapshot" >= 0 AND "return_settlements"."rate_snapshot" BETWEEN 0 AND 100 AND "return_settlements"."overdue_fee_amount" >= 0 AND "return_settlements"."damage_amount" >= 0 AND "return_settlements"."unused_rent_refund_amount" >= 0 AND "return_settlements"."refund_entitlement" >= 0 AND "return_settlements"."debt_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "return_time_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"previous_at" timestamp with time zone,
	"proposed_at" timestamp with time zone NOT NULL,
	"reason" text NOT NULL,
	"evidence_photo_ids" jsonb NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"status" "return_time_change_status" DEFAULT 'PENDING' NOT NULL,
	"proposed_by" uuid NOT NULL,
	"decided_by" uuid,
	"decision_reason" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "storage_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"unit_type_id" uuid NOT NULL,
	"code" varchar(80) NOT NULL,
	"floor" varchar(50),
	"location_description" varchar(255),
	"status" "storage_unit_status" DEFAULT 'AVAILABLE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "storage_units_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"rental_id" uuid,
	"payment_id" uuid,
	"category" "support_category" NOT NULL,
	"subject" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"action_due_at" timestamp (3) with time zone NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_ticket_subject_valid" CHECK (length(btrim("support_tickets"."subject")) BETWEEN 1 AND 200),
	CONSTRAINT "support_ticket_description_valid" CHECK (length(btrim("support_tickets"."description")) BETWEEN 1 AND 5000),
	CONSTRAINT "support_ticket_context_valid" CHECK (("support_tickets"."category" = 'PAYMENT' AND "support_tickets"."rental_id" IS NULL) OR ("support_tickets"."category" != 'PAYMENT' AND "support_tickets"."rental_id" IS NOT NULL AND "support_tickets"."payment_id" IS NULL)),
	CONSTRAINT "support_ticket_due_valid" CHECK ("support_tickets"."action_due_at" > "support_tickets"."created_at")
);
--> statement-breakpoint
CREATE TABLE "system_setting_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"before" jsonb NOT NULL,
	"after" jsonb NOT NULL,
	"actor_id" uuid NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"description" text NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "system_settings_version_valid" CHECK ("system_settings"."version" >= 0),
	CONSTRAINT "system_settings_value_scalar" CHECK (jsonb_typeof("system_settings"."value") in ('number', 'string', 'boolean')),
	CONSTRAINT "system_settings_known_integer" CHECK ("system_settings"."key" not in ('EXPIRY_REMINDER_DAYS', 'ABANDONED_REVIEW_DAYS', 'OVERDUE_FEE_RATE', 'DEPOSIT_MONTHS', 'OPENING_HOUR', 'CLOSING_HOUR') or (jsonb_typeof("system_settings"."value") = 'number' and ("system_settings"."value" #>> '{}')::numeric between 0 and 2147483647 and trunc(("system_settings"."value" #>> '{}')::numeric) = ("system_settings"."value" #>> '{}')::numeric)),
	CONSTRAINT "system_settings_overdue_rate" CHECK ("system_settings"."key" <> 'OVERDUE_FEE_RATE' or ("system_settings"."value" #>> '{}')::numeric between 0 and 100),
	CONSTRAINT "system_settings_deposit_policy" CHECK ("system_settings"."key" <> 'DEPOSIT_MONTHS' or (("system_settings"."value" #>> '{}')::numeric > 0 and "system_settings"."version" > 0)),
	CONSTRAINT "system_settings_operating_hour" CHECK ("system_settings"."key" not in ('OPENING_HOUR', 'CLOSING_HOUR') or ("system_settings"."value" #>> '{}')::integer between 0 and 24)
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
CREATE TABLE "unit_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"price_range_id" uuid NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_by" uuid,
	"code" varchar(80) NOT NULL,
	"name" varchar(100) NOT NULL,
	"size_label" varchar(50) NOT NULL,
	"length_m" numeric NOT NULL,
	"width_m" numeric NOT NULL,
	"height_m" numeric NOT NULL,
	"size_cbm" numeric GENERATED ALWAYS AS ("length_m" * "width_m" * "height_m") STORED NOT NULL,
	"monthly_price" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_types_facility_id_idx" UNIQUE("facility_id","id"),
	CONSTRAINT "unit_types_price_positive" CHECK ("unit_types"."monthly_price" > 0),
	CONSTRAINT "unit_types_version_valid" CHECK ("unit_types"."version" >= 0),
	CONSTRAINT "unit_types_positive_dimensions" CHECK ("unit_types"."length_m" > 0 AND "unit_types"."width_m" > 0 AND "unit_types"."height_m" > 0)
);
--> statement-breakpoint
CREATE TABLE "user_activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" varchar(120) NOT NULL,
	"entity_type" varchar(80) NOT NULL,
	"entity_id" varchar(255),
	"facility_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"phone" varchar(20),
	"role" "role",
	"status" "status",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_check_in_slot_id_check_in_slots_id_fk" FOREIGN KEY ("check_in_slot_id") REFERENCES "public"."check_in_slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_assigned_staff_id_users_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_facility_id_unit_type_id_unit_types_facility_id_id_fk" FOREIGN KEY ("facility_id","unit_type_id") REFERENCES "public"."unit_types"("facility_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_allocations" ADD CONSTRAINT "capacity_allocations_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_allocations" ADD CONSTRAINT "capacity_allocations_facility_id_unit_type_id_unit_types_facility_id_id_fk" FOREIGN KEY ("facility_id","unit_type_id") REFERENCES "public"."unit_types"("facility_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_verifications" ADD CONSTRAINT "checkin_verifications_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_verifications" ADD CONSTRAINT "checkin_verifications_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_verifications" ADD CONSTRAINT "checkin_verifications_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkin_verifications" ADD CONSTRAINT "checkin_verifications_unit_assignment_id_unit_assignments_id_fk" FOREIGN KEY ("unit_assignment_id") REFERENCES "public"."unit_assignments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_assignments" ADD CONSTRAINT "facility_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_assignments" ADD CONSTRAINT "facility_assignments_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_tasks" ADD CONSTRAINT "facility_tasks_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_tasks" ADD CONSTRAINT "facility_tasks_assigned_staff_id_users_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_tasks" ADD CONSTRAINT "facility_tasks_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover_inspections" ADD CONSTRAINT "handover_inspections_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover_inspections" ADD CONSTRAINT "handover_inspections_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover_inspections" ADD CONSTRAINT "handover_inspections_physical_unit_id_storage_units_id_fk" FOREIGN KEY ("physical_unit_id") REFERENCES "public"."storage_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover_inspections" ADD CONSTRAINT "handover_inspections_unit_assignment_id_unit_assignments_id_fk" FOREIGN KEY ("unit_assignment_id") REFERENCES "public"."unit_assignments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover_inspections" ADD CONSTRAINT "handover_inspections_verification_id_checkin_verifications_id_fk" FOREIGN KEY ("verification_id") REFERENCES "public"."checkin_verifications"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover_inspections" ADD CONSTRAINT "handover_inspections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover_inspections" ADD CONSTRAINT "handover_inspections_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover_inspections" ADD CONSTRAINT "handover_inspections_handed_over_by_users_id_fk" FOREIGN KEY ("handed_over_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_photos" ADD CONSTRAINT "inspection_photos_inspection_id_handover_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."handover_inspections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_photos" ADD CONSTRAINT "inspection_photos_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "login_history" ADD CONSTRAINT "login_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_support_ticket_id_support_tickets_id_fk" FOREIGN KEY ("support_ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_provider_events" ADD CONSTRAINT "payment_provider_events_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_rental_charge_id_rental_charges_id_fk" FOREIGN KEY ("rental_charge_id") REFERENCES "public"."rental_charges"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_refunded_by_users_id_fk" FOREIGN KEY ("refunded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_changes" ADD CONSTRAINT "pricing_changes_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_charge_adjustments" ADD CONSTRAINT "rental_charge_adjustments_charge_id_rental_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."rental_charges"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_charge_adjustments" ADD CONSTRAINT "rental_charge_adjustments_settlement_id_return_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."return_settlements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_charge_adjustments" ADD CONSTRAINT "rental_charge_adjustments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_charge_events" ADD CONSTRAINT "rental_charge_events_charge_id_rental_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."rental_charges"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_charge_events" ADD CONSTRAINT "rental_charge_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_charge_refunds" ADD CONSTRAINT "rental_charge_refunds_charge_id_rental_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."rental_charges"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_charge_refunds" ADD CONSTRAINT "rental_charge_refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_charge_refunds" ADD CONSTRAINT "rental_charge_refunds_settlement_id_return_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."return_settlements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_charge_refunds" ADD CONSTRAINT "rental_charge_refunds_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_charges" ADD CONSTRAINT "rental_charges_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_charges" ADD CONSTRAINT "rental_charges_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_charges" ADD CONSTRAINT "rental_charges_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_price_ranges" ADD CONSTRAINT "rental_price_ranges_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_renewals" ADD CONSTRAINT "rental_renewals_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_renewals" ADD CONSTRAINT "rental_renewals_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_renewals" ADD CONSTRAINT "rental_renewals_charge_id_rental_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."rental_charges"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_renewals" ADD CONSTRAINT "rental_renewals_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_physical_unit_id_storage_units_id_fk" FOREIGN KEY ("physical_unit_id") REFERENCES "public"."storage_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_audit" ADD CONSTRAINT "return_audit_request_id_return_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."return_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_audit" ADD CONSTRAINT "return_audit_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_audit" ADD CONSTRAINT "return_audit_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_checklist_versions" ADD CONSTRAINT "return_checklist_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_evidence_photos" ADD CONSTRAINT "return_evidence_photos_request_id_return_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."return_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_evidence_photos" ADD CONSTRAINT "return_evidence_photos_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_inspection_photos" ADD CONSTRAINT "return_inspection_photos_inspection_id_return_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."return_inspections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_inspection_photos" ADD CONSTRAINT "return_inspection_photos_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_inspections" ADD CONSTRAINT "return_inspections_request_id_return_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."return_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_inspections" ADD CONSTRAINT "return_inspections_checklist_version_id_return_checklist_versions_id_fk" FOREIGN KEY ("checklist_version_id") REFERENCES "public"."return_checklist_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_inspections" ADD CONSTRAINT "return_inspections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_inspections" ADD CONSTRAINT "return_inspections_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_refunds" ADD CONSTRAINT "return_refunds_request_id_return_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."return_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_refunds" ADD CONSTRAINT "return_refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_refunds" ADD CONSTRAINT "return_refunds_settlement_id_return_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."return_settlements"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_refunds" ADD CONSTRAINT "return_refunds_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_slot_id_check_in_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."check_in_slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_assigned_staff_id_users_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_settlements" ADD CONSTRAINT "return_settlements_request_id_return_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."return_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_settlements" ADD CONSTRAINT "return_settlements_rental_charge_id_rental_charges_id_fk" FOREIGN KEY ("rental_charge_id") REFERENCES "public"."rental_charges"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_settlements" ADD CONSTRAINT "return_settlements_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_time_changes" ADD CONSTRAINT "return_time_changes_request_id_return_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."return_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_time_changes" ADD CONSTRAINT "return_time_changes_proposed_by_users_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_time_changes" ADD CONSTRAINT "return_time_changes_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_units" ADD CONSTRAINT "storage_units_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_units" ADD CONSTRAINT "storage_units_facility_id_unit_type_id_unit_types_facility_id_id_fk" FOREIGN KEY ("facility_id","unit_type_id") REFERENCES "public"."unit_types"("facility_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_setting_changes" ADD CONSTRAINT "system_setting_changes_key_system_settings_key_fk" FOREIGN KEY ("key") REFERENCES "public"."system_settings"("key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_setting_changes" ADD CONSTRAINT "system_setting_changes_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_assignments" ADD CONSTRAINT "unit_assignments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_assignments" ADD CONSTRAINT "unit_assignments_physical_unit_id_storage_units_id_fk" FOREIGN KEY ("physical_unit_id") REFERENCES "public"."storage_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_assignments" ADD CONSTRAINT "unit_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_types" ADD CONSTRAINT "unit_types_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_types" ADD CONSTRAINT "unit_types_price_range_id_rental_price_ranges_id_fk" FOREIGN KEY ("price_range_id") REFERENCES "public"."rental_price_ranges"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_types" ADD CONSTRAINT "unit_types_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activity_logs" ADD CONSTRAINT "user_activity_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activity_logs" ADD CONSTRAINT "user_activity_logs_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_account_idx" ON "accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "bookings_facility_status_idx" ON "bookings" USING btree ("facility_id","status");--> statement-breakpoint
CREATE INDEX "bookings_user_idx" ON "bookings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bookings_assigned_staff_idx" ON "bookings" USING btree ("assigned_staff_id");--> statement-breakpoint
CREATE INDEX "bookings_dates_idx" ON "bookings" USING btree ("check_in_date","rental_end_at");--> statement-breakpoint
CREATE INDEX "bookings_check_in_slot_idx" ON "bookings" USING btree ("check_in_slot_id");--> statement-breakpoint
CREATE INDEX "capacity_allocations_unit_type_period_idx" ON "capacity_allocations" USING btree ("facility_id","unit_type_id","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "capacity_allocations_reference_idx" ON "capacity_allocations" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "checkin_verifications_booking_status_idx" ON "checkin_verifications" USING btree ("booking_id","status");--> statement-breakpoint
CREATE INDEX "checkin_verifications_facility_verified_idx" ON "checkin_verifications" USING btree ("facility_id","verified_at");--> statement-breakpoint
CREATE UNIQUE INDEX "facility_assignments_user_facility_idx" ON "facility_assignments" USING btree ("user_id","facility_id");--> statement-breakpoint
CREATE UNIQUE INDEX "facility_assignments_active_user_idx" ON "facility_assignments" USING btree ("user_id") WHERE "facility_assignments"."is_active" = true;--> statement-breakpoint
CREATE INDEX "facility_assignments_facility_idx" ON "facility_assignments" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "facility_tasks_staff_idx" ON "facility_tasks" USING btree ("facility_id","assigned_staff_id");--> statement-breakpoint
CREATE INDEX "facility_tasks_type_idx" ON "facility_tasks" USING btree ("facility_id","type");--> statement-breakpoint
CREATE INDEX "facility_tasks_reference_idx" ON "facility_tasks" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "handover_inspections_booking_idx" ON "handover_inspections" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "inspection_photos_inspection_idx" ON "inspection_photos" USING btree ("inspection_id");--> statement-breakpoint
CREATE INDEX "login_history_time_idx" ON "login_history" USING btree ("occurred_at","id");--> statement-breakpoint
CREATE INDEX "login_history_user_time_idx" ON "login_history" USING btree ("user_id","occurred_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_outbox_event_recipient_idx" ON "notification_outbox" USING btree ("event_key","recipient_key");--> statement-breakpoint
CREATE INDEX "notification_outbox_dispatch_idx" ON "notification_outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "notification_outbox_inbox_idx" ON "notification_outbox" USING btree ("recipient_user_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_provider_events_provider_event_idx" ON "payment_provider_events" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE INDEX "payment_provider_events_payment_idx" ON "payment_provider_events" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_payment_idx" ON "payments" USING btree ("provider","provider_payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_idempotency_idx" ON "payments" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "payments_booking_idx" ON "payments" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "payments_rental_charge_idx" ON "payments" USING btree ("rental_charge_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_pending_rental_charge_idx" ON "payments" USING btree ("rental_charge_id") WHERE "payments"."rental_charge_id" IS NOT NULL AND "payments"."status" = 'PENDING';--> statement-breakpoint
CREATE UNIQUE INDEX "payments_collected_rental_charge_idx" ON "payments" USING btree ("rental_charge_id") WHERE "payments"."rental_charge_id" IS NOT NULL AND "payments"."status" = 'SUCCEEDED';--> statement-breakpoint
CREATE INDEX "rental_charge_adjustments_charge_idx" ON "rental_charge_adjustments" USING btree ("charge_id","created_at","id");--> statement-breakpoint
CREATE INDEX "rental_charge_events_charge_idx" ON "rental_charge_events" USING btree ("charge_id","created_at","id");--> statement-breakpoint
CREATE INDEX "rental_charge_refunds_charge_idx" ON "rental_charge_refunds" USING btree ("charge_id","created_at","id");--> statement-breakpoint
CREATE INDEX "rental_charge_refunds_status_idx" ON "rental_charge_refunds" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rental_charge_refunds_reference_idx" ON "rental_charge_refunds" USING btree ("payment_id","reference");--> statement-breakpoint
CREATE INDEX "rental_charges_rental_created_idx" ON "rental_charges" USING btree ("rental_id","created_at","id");--> statement-breakpoint
CREATE INDEX "rental_charges_status_due_idx" ON "rental_charges" USING btree ("status","due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "rental_renewals_request_idx" ON "rental_renewals" USING btree ("rental_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "rental_renewals_applied_term_idx" ON "rental_renewals" USING btree ("rental_id","rental_version") WHERE "rental_renewals"."status" = 'APPLIED';--> statement-breakpoint
CREATE INDEX "rental_renewals_history_idx" ON "rental_renewals" USING btree ("rental_id","created_at","id");--> statement-breakpoint
CREATE INDEX "rentals_facility_idx" ON "rentals" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "rentals_active_unit_idx" ON "rentals" USING btree ("physical_unit_id","status","expected_end_at");--> statement-breakpoint
CREATE INDEX "return_audit_request_idx" ON "return_audit" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE INDEX "return_evidence_request_idx" ON "return_evidence_photos" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "return_photo_inspection_idx" ON "return_inspection_photos" USING btree ("inspection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "return_inspection_attempt_idx" ON "return_inspections" USING btree ("request_id","attempt");--> statement-breakpoint
CREATE UNIQUE INDEX "return_refund_idempotency_idx" ON "return_refunds" USING btree ("request_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "return_refund_reference_idx" ON "return_refunds" USING btree ("payment_id","reference");--> statement-breakpoint
CREATE UNIQUE INDEX "return_requests_open_rental_idx" ON "return_requests" USING btree ("rental_id") WHERE "return_requests"."status" IN ('PENDING','CONFIRMED','INSPECTING','FAILED');--> statement-breakpoint
CREATE INDEX "return_requests_facility_slot_idx" ON "return_requests" USING btree ("facility_id","date","slot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "return_requests_reserved_slot_idx" ON "return_requests" USING btree ("facility_id","date","slot_id") WHERE "return_requests"."status" IN ('CONFIRMED','INSPECTING','FAILED');--> statement-breakpoint
CREATE UNIQUE INDEX "return_settlement_revision_idx" ON "return_settlements" USING btree ("request_id","revision");--> statement-breakpoint
CREATE INDEX "return_settlement_rental_charge_idx" ON "return_settlements" USING btree ("rental_charge_id");--> statement-breakpoint
CREATE UNIQUE INDEX "return_time_change_idempotency_idx" ON "return_time_changes" USING btree ("request_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "storage_units_facility_idx" ON "storage_units" USING btree ("facility_id");--> statement-breakpoint
CREATE INDEX "storage_units_facility_status_idx" ON "storage_units" USING btree ("facility_id","status");--> statement-breakpoint
CREATE INDEX "storage_units_unit_type_idx" ON "storage_units" USING btree ("unit_type_id");--> statement-breakpoint
CREATE INDEX "support_tickets_owner_idx" ON "support_tickets" USING btree ("owner_user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "support_tickets_facility_idx" ON "support_tickets" USING btree ("facility_id","category","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "support_tickets_owner_idempotency_idx" ON "support_tickets" USING btree ("owner_user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "system_setting_changes_key_idx" ON "system_setting_changes" USING btree ("key","created_at");--> statement-breakpoint
CREATE INDEX "unit_assignments_booking_idx" ON "unit_assignments" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "unit_assignments_physical_unit_idx" ON "unit_assignments" USING btree ("physical_unit_id");--> statement-breakpoint
CREATE INDEX "unit_assignments_booking_status_idx" ON "unit_assignments" USING btree ("booking_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "unit_types_facility_code_idx" ON "unit_types" USING btree ("facility_id","code");--> statement-breakpoint
CREATE INDEX "unit_types_price_range_idx" ON "unit_types" USING btree ("price_range_id");--> statement-breakpoint
CREATE INDEX "user_activity_logs_time_idx" ON "user_activity_logs" USING btree ("occurred_at","id");--> statement-breakpoint
CREATE INDEX "user_activity_logs_actor_time_idx" ON "user_activity_logs" USING btree ("actor_id","occurred_at","id");--> statement-breakpoint
CREATE INDEX "user_activity_logs_entity_idx" ON "user_activity_logs" USING btree ("entity_type","entity_id","occurred_at","id");--> statement-breakpoint
CREATE INDEX "user_activity_logs_facility_time_idx" ON "user_activity_logs" USING btree ("facility_id","occurred_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_single_system_admin_idx" ON "users" USING btree ("role") WHERE "users"."role" = 'SYSTEM_ADMIN';--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");