-- Preserve every existing facility offering ID used by reservations, bookings and units.
INSERT INTO facility_unit_types (id, facility_id, unit_type_id, monthly_price, is_active, version, updated_by, created_at, updated_at)
SELECT id, facility_id, id, monthly_price, is_active, version, updated_by, created_at, updated_at
FROM unit_types;
--> statement-breakpoint
-- Preserve configured bounds; an unbounded/unassigned legacy type starts with its current price.
UPDATE unit_types u
SET min_monthly_price = coalesce((SELECT r.min_monthly_price FROM rental_price_ranges r WHERE r.id = u.price_range_id), u.monthly_price),
    max_monthly_price = coalesce((SELECT r.max_monthly_price FROM rental_price_ranges r WHERE r.id = u.price_range_id), u.monthly_price);
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM unit_types WHERE monthly_price < min_monthly_price OR monthly_price > max_monthly_price) THEN
    RAISE EXCEPTION 'Legacy unit prices are outside their configured bounds; reconcile before migration';
  END IF;
END $$;
--> statement-breakpoint
-- Do not infer that two legacy facility types are the same standard type.
-- Disambiguate only duplicate catalog codes; all existing IDs remain unchanged.
WITH duplicates AS (SELECT code FROM unit_types GROUP BY code HAVING count(*) > 1)
UPDATE unit_types u SET code = left(u.code, 43) || '-' || replace(u.id::text, '-', '')
FROM duplicates d WHERE u.code = d.code;
