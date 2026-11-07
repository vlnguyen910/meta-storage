import { sql } from "drizzle-orm";
import type { Database } from "./client";

type MigrationTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

// Data transfer for the generated 0008 migration. Keep the generated SQL immutable.
export const RENTAL_RESET_TIMESTAMP = 1793177329722;

export async function prepareRentalReset(tx: MigrationTransaction) {
  // Do not discard financial facts or audit history to make new constraints pass.
  await tx.execute(sql`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM payments WHERE booking_id IS NULL OR hold_token_hash IS NULL
      OR provider IS NULL OR payment_code IS NULL OR provider_payment_id IS NULL
      OR rental_charge_id IS NOT NULL OR rental_id IS NOT NULL OR type::text <> 'COLLECTION') THEN
      RAISE EXCEPTION 'Rental reset blocked: archive or reconcile legacy rental payments before migrating';
    END IF;
    IF EXISTS (SELECT 1 FROM pricing_changes WHERE operation::text NOT IN ('DEPOSIT_POLICY', 'UNIT_TYPE_PRICE')) THEN
      RAISE EXCEPTION 'Rental reset blocked: archive legacy rental price-range audit history before migrating';
    END IF;
  END $$`);
  await tx.execute(sql`ALTER TABLE rentals ADD COLUMN user_id uuid`);
  await tx.execute(
    sql`UPDATE rentals r SET user_id = b.user_id FROM bookings b WHERE b.id = r.booking_id`,
  );
  await tx.execute(sql`ALTER TABLE rentals ALTER COLUMN user_id SET NOT NULL`);
  // Open rentals remain open when their retired lifecycle statuses disappear.
  await tx.execute(
    sql`UPDATE rentals SET status = 'ACTIVE' WHERE status::text IN ('RETURN_PENDING', 'OVERDUE')`,
  );
  await tx.execute(
    sql`ALTER TABLE pricing_changes ALTER COLUMN operation TYPE text USING operation::text`,
  );
}

export function rentalResetStatements(statements: string[]) {
  // Drizzle emits CASCADE table drops before the explicit FK drops. Execute FK
  // removals first, rather than ignoring arbitrary missing-constraint errors.
  return [
    ...statements.filter((statement) => /ALTER TABLE[\s\S]*DROP CONSTRAINT/.test(statement)),
    ...statements.filter((statement) => !/ALTER TABLE[\s\S]*DROP CONSTRAINT/.test(statement)),
  ].filter((statement) => !/ALTER TABLE "rentals" ADD COLUMN "user_id"/.test(statement));
}

export async function finishRentalReset(tx: MigrationTransaction) {
  await tx.execute(
    sql`ALTER TABLE pricing_changes ALTER COLUMN operation TYPE public.pricing_change_operation USING operation::public.pricing_change_operation`,
  );
}
