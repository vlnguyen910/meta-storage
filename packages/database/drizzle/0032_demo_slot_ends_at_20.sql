-- The same-day demo slot closes at 20:00 instead of the end of the day.
UPDATE check_in_slots
SET end_time = '20:00:00'
WHERE id = '20000000-0000-4000-8000-000000000005'
  AND start_time < '20:00:00';
