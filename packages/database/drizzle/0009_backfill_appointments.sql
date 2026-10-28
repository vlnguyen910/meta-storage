-- Custom SQL migration file, put your code below! --
INSERT INTO appointments (
  facility_id,
  type,
  scheduled_date,
  slot_id,
  status,
  reservation_id,
  assigned_staff_id,
  created_by,
  created_at,
  updated_at
)
SELECT
  r.facility_id,
  'CHECK_IN',
  r.check_in_date,
  r.check_in_slot_id,
  CASE r.status
    WHEN 'DRAFT' THEN 'SCHEDULED'
    WHEN 'CONFIRMED' THEN 'CONFIRMED'
    WHEN 'CHECKED_IN' THEN 'COMPLETED'
    WHEN 'CANCELLED' THEN 'CANCELLED'
    WHEN 'NO_SHOW' THEN 'NO_SHOW'
  END::appointment_status,
  r.id,
  r.assigned_staff_id,
  r.customer_id,
  r.created_at,
  r.updated_at
FROM reservations r;

INSERT INTO appointments (
  facility_id,
  type,
  scheduled_date,
  slot_id,
  status,
  rental_id,
  created_by,
  created_at,
  updated_at
)
SELECT
  r.facility_id,
  'CHECK_OUT',
  r.return_date,
  r.return_slot_id,
  CASE r.return_status
    WHEN 'PENDING' THEN 'SCHEDULED'
    WHEN 'CONFIRMED' THEN 'CONFIRMED'
    WHEN 'INSPECTING' THEN 'COMPLETED'
    WHEN 'FAILED' THEN 'COMPLETED'
    WHEN 'COMPLETED' THEN 'COMPLETED'
    WHEN 'CANCELLED' THEN 'CANCELLED'
  END::appointment_status,
  r.id,
  reservation.customer_id,
  r.updated_at,
  r.updated_at
FROM rentals r
JOIN reservations reservation ON reservation.id = r.reservation_id
WHERE r.return_date IS NOT NULL
  AND r.return_slot_id IS NOT NULL;
