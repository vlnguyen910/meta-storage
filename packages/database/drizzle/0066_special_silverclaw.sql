ALTER TABLE "facility_operating_hours" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "facility_return_calendars" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "facility_operating_hours" CASCADE;--> statement-breakpoint
DROP TABLE "facility_return_calendars" CASCADE;--> statement-breakpoint
ALTER TABLE "system_settings" DROP CONSTRAINT "system_settings_known_integer";--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_operating_hour" CHECK ("system_settings"."key" not in ('OPENING_HOUR', 'CLOSING_HOUR') or ("system_settings"."value" #>> '{}')::integer between 0 and 24);--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_known_integer" CHECK ("system_settings"."key" not in ('EXPIRY_REMINDER_DAYS', 'ABANDONED_REVIEW_DAYS', 'OVERDUE_FEE_RATE', 'DEPOSIT_MONTHS', 'OPENING_HOUR', 'CLOSING_HOUR') or (jsonb_typeof("system_settings"."value") = 'number' and ("system_settings"."value" #>> '{}')::numeric between 0 and 2147483647 and trunc(("system_settings"."value" #>> '{}')::numeric) = ("system_settings"."value" #>> '{}')::numeric));