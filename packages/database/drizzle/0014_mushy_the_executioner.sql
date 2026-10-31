ALTER TABLE "unit_assignments" ALTER COLUMN "booking_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "unit_assignments" ADD COLUMN "reservation_id" uuid;--> statement-breakpoint
ALTER TABLE "unit_assignments" ADD CONSTRAINT "unit_assignments_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "unit_assignments_reservation_idx" ON "unit_assignments" USING btree ("reservation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unit_assignments_active_reservation_idx" ON "unit_assignments" USING btree ("reservation_id") WHERE "unit_assignments"."status" = 'ACTIVE';--> statement-breakpoint
ALTER TABLE "unit_assignments" ADD CONSTRAINT "unit_assignments_reference_valid" CHECK (num_nonnulls("unit_assignments"."booking_id", "unit_assignments"."reservation_id") = 1);