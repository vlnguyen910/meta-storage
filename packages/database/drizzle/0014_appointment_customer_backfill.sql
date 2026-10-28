UPDATE "appointments" AS appointment
SET "customer_id" = reservation."customer_id",
    "contact_phone" = reservation."contact_phone"
FROM "reservations" AS reservation
WHERE appointment."appointment_type" = 'CHECK_IN'
  AND appointment."reservation_id" = reservation."id";
--> statement-breakpoint
UPDATE "appointments" AS appointment
SET "customer_id" = reservation."customer_id",
    "contact_phone" = reservation."contact_phone"
FROM "rentals" AS rental
JOIN "reservations" AS reservation ON reservation."id" = rental."reservation_id"
WHERE appointment."appointment_type" = 'CHECK_OUT'
  AND appointment."rental_id" = rental."id";
--> statement-breakpoint
UPDATE "appointments" AS appointment
SET "customer_id" = ticket."owner_user_id",
    "contact_phone" = customer."phone"
FROM "support_tickets" AS ticket
JOIN "users" AS customer ON customer."id" = ticket."owner_user_id"
WHERE appointment."appointment_type" = 'SUPPORT'
  AND appointment."support_ticket_id" = ticket."id";
