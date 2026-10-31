ALTER TABLE "notification_outbox" ALTER COLUMN "booking_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "support_tickets" ALTER COLUMN "booking_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD COLUMN "reservation_id" uuid;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD COLUMN "reservation_id" uuid;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_reference_valid" CHECK (num_nonnulls("notification_outbox"."booking_id", "notification_outbox"."reservation_id") = 1);--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_ticket_reference_valid" CHECK (num_nonnulls("support_tickets"."booking_id", "support_tickets"."reservation_id") = 1);