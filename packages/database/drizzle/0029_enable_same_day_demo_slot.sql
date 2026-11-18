INSERT INTO check_in_slots (
  id,
  name,
  start_time,
  end_time,
  same_day_check_in_enabled
)
VALUES (
  '20000000-0000-4000-8000-000000000005',
  'Demo check-in ngay',
  '08:00:00',
  '23:59:59.999999',
  true
)
ON CONFLICT (id) DO UPDATE
SET same_day_check_in_enabled = true;
