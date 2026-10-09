import { queryClient } from "@metastorage/database";

// Rename demo identities in place, preserving user IDs, credentials and assignments.
// Do not run the full database seed: it would reset existing booking/unit fixtures.
async function renameDemoBranding() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo branding update must not run in production.");
  }
  const result = await queryClient.begin(async (tx) => {
    const facilities = await tx`
      UPDATE facilities SET name = regexp_replace(name, 'storex', 'metastorage', 'gi'),
        updated_at = now() WHERE name ~* 'storex'
      RETURNING code, name
    `;
    let renamedUsers = 0;
    for (const localPart of ["manager", "staff", "customer"]) {
      const oldEmail = `${localPart}@storex.vn`;
      const newEmail = `${localPart}@metastorage.test`;
      const users = await tx`
        UPDATE users SET email = ${newEmail}, updated_at = now()
        WHERE email = ${oldEmail} RETURNING id
      `;
      renamedUsers += users.length;
      await tx`
        UPDATE bookings SET contact_email = ${newEmail}, updated_at = now()
        WHERE contact_email = ${oldEmail}
      `;
      await tx`
        UPDATE reservation_drafts SET contact_email = ${newEmail}, updated_at = now()
        WHERE contact_email = ${oldEmail}
      `;
    }
    return { facilities: facilities.map(({ code, name }) => ({ code, name })), renamedUsers };
  });
  console.log(result);
}

renameDemoBranding()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => queryClient.end());
