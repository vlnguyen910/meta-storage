ALTER TABLE "inspections" DROP CONSTRAINT "inspections_context_valid";--> statement-breakpoint
ALTER TABLE "rentals" ALTER COLUMN "booking_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "reservation_id" uuid;--> statement-breakpoint
ALTER TABLE "rentals" ADD COLUMN "reservation_id" uuid;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_reservationId_unique" UNIQUE("reservation_id");--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_context_valid" CHECK ((
        ("inspections"."inspection_type" = 'CHECK_IN' AND num_nonnulls("inspections"."booking_id", "inspections"."reservation_id") = 1 AND "inspections"."rental_id" IS NULL) OR
        ("inspections"."inspection_type" = 'CHECK_OUT' AND "inspections"."rental_id" IS NOT NULL AND "inspections"."booking_id" IS NULL AND "inspections"."reservation_id" IS NULL) OR
        ("inspections"."inspection_type" = 'MAINTENANCE' AND "inspections"."booking_id" IS NULL AND "inspections"."reservation_id" IS NULL)
      ));--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_reference_valid" CHECK (num_nonnulls("rentals"."booking_id", "rentals"."reservation_id") = 1);