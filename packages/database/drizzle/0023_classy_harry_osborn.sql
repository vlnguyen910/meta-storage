CREATE TABLE "check_in_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL
);
--> statement-breakpoint
DROP INDEX "bookings_dates_idx";--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "check_in_date" date NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "check_in_slot_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_check_in_slot_id_check_in_slots_id_fk" FOREIGN KEY ("check_in_slot_id") REFERENCES "public"."check_in_slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_check_in_slot_idx" ON "bookings" USING btree ("check_in_slot_id");--> statement-breakpoint
CREATE INDEX "bookings_dates_idx" ON "bookings" USING btree ("check_in_date","rental_end_at");--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "check_in_slot_start";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "check_in_slot_end";