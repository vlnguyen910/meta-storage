import { afterAll, describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const target = process.env.SEED_TEST_DATABASE_URL;
if (target) {
  const url = new URL(target);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    !/^\/metastorage_[a-z0-9_]*_seed_test$/.test(url.pathname) ||
    url.search ||
    url.hash ||
    process.env.NODE_ENV === "production"
  )
    throw new Error("Seed tests require a loopback metastorage_*_seed_test database");
}

// The explicit test URL is checked before creating a connection or running destructive commands.
const sql = target ? postgres(target, { max: 1 }) : undefined;
afterAll(async () => {
  await sql?.end();
});

describe.skipIf(!target)("demo seed on an isolated, migrated database", () => {
  test("clear → seed creates a paid appointment and reseeding preserves workflow history", async () => {
    if (!sql || !target) throw new Error("Missing seed test database");
    async function run(script: string) {
      const child = Bun.spawn([process.execPath, `src/${script}.ts`], {
        cwd: fileURLToPath(new URL("..", import.meta.url)),
        env: {
          ...process.env,
          NODE_ENV: "test",
          DATABASE_URL: target,
          DOCKER_DATABASE_URL: "",
          SEED_NOW: "2026-10-29T03:00:00Z",
          QR_TOKEN_SECRET: "seed-test-only-qr-secret",
        },
        stdout: "ignore",
        stderr: "pipe",
      });
      const error = await new Response(child.stderr).text();
      if ((await child.exited) !== 0) throw new Error(`${script} failed: ${error}`);
    }
    await run("clear");
    await run("seed");
    const id = "83000000-0000-4000-8000-000000000002";
    const [appointment] = await sql`
      select a.id, a.status, a.scheduled_date::text, r.status as reservation_status,
             p.status as payment_status, s.start_time::text
      from appointments a
      join reservations r on r.id = a.reservation_id
      join payments p on p.reservation_id = r.id
      join check_in_slots s on s.id = a.slot_id
      where a.id = ${id}
    `;
    expect(appointment).toMatchObject({
      id,
      status: "CONFIRMED",
      scheduled_date: "2026-10-29",
      reservation_status: "CONFIRMED",
      payment_status: "SUCCEEDED",
      start_time: "10:00:00",
    });
    const counts = () => sql`
      select (select count(*)::int from reservations) as reservations,
             (select count(*)::int from appointments) as appointments,
             (select count(*)::int from payments) as payments
    `;
    const before = await counts();
    await sql`update appointments set notes = 'Preserve staff workflow' where id = ${id}`;
    await run("seed");
    expect(await counts()).toEqual(before);
    const [preserved] = await sql`select notes from appointments where id = ${id}`;
    expect(preserved?.notes).toBe("Preserve staff workflow");
  }, 60000);
});
