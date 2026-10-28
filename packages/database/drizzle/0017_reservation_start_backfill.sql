UPDATE "reservations" AS reservation
SET "rental_start_at" = (appointment."scheduled_date" + slot."start_time") AT TIME ZONE 'Asia/Ho_Chi_Minh'
FROM "appointments" AS appointment
JOIN "check_in_slots" AS slot ON slot."id" = appointment."slot_id"
WHERE appointment."appointment_type" = 'CHECK_IN'
  AND appointment."reservation_id" = reservation."id"
  AND reservation."rental_start_at" IS NULL;
