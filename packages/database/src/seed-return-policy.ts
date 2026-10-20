import { db, queryClient } from "./client";
import { returnOverdueSettings } from "./schema/returns";

try {
  // Explicit seed only. A configured BOM rate is never overwritten by a rerun.
  await db
    .insert(returnOverdueSettings)
    .values({ id: "default", rate: 25, version: 0 })
    .onConflictDoNothing();
  console.log("Return overdue policy initialized if missing.");
} finally {
  await queryClient.end();
}
