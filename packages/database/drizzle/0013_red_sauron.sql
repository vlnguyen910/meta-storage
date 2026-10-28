ALTER TABLE "appointments" DROP CONSTRAINT "appointments_context_valid";--> statement-breakpoint
ALTER TABLE "reservations" DROP CONSTRAINT "reservations_phone_after_draft";--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "contact_phone" varchar(32);--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_customer_idx" ON "appointments" USING btree ("customer_id");--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_context_valid" CHECK ((
        ("appointments"."appointment_type" = 'CHECK_IN' AND "appointments"."reservation_id" IS NOT NULL AND "appointments"."rental_id" IS NULL AND "appointments"."support_ticket_id" IS NULL) OR
        ("appointments"."appointment_type" = 'CHECK_OUT' AND "appointments"."reservation_id" IS NULL AND "appointments"."rental_id" IS NOT NULL AND "appointments"."support_ticket_id" IS NULL) OR
        ("appointments"."appointment_type" = 'SUPPORT' AND "appointments"."reservation_id" IS NULL AND "appointments"."rental_id" IS NULL)
      ));