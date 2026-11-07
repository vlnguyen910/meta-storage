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
    const [catalogCounts] = await sql`
      select (select count(*)::int from unit_types) as types,
             (select count(*)::int from facility_unit_types) as offerings,
             (select count(*)::int from unit_types t join users u on u.id=t.updated_by where u.role='BUSINESS_OPERATION_MANAGER' and t.cover_url like 'https://%' and t.min_monthly_price>0 and t.max_monthly_price>=t.min_monthly_price) as bom_types,
             (select count(*)::int from facility_unit_types f join unit_types t on t.id=f.unit_type_id join users u on u.id=f.updated_by join facility_assignments a on a.user_id=u.id and a.facility_id=f.facility_id where u.role='FACILITY_MANAGER' and a.role='FACILITY_MANAGER' and a.is_active and f.monthly_price between t.min_monthly_price and t.max_monthly_price) as fm_offerings,
             (select count(*)::int from unit_types t where t.code='UT-3M' and not exists(select 1 from facility_unit_types f where f.unit_type_id=t.id)) as available_to_select
    `;
    expect(catalogCounts).toEqual({
      types: 9,
      offerings: 80,
      bom_types: 9,
      fm_offerings: 80,
      available_to_select: 1,
    });
    const [prices] =
      await sql`select count(distinct monthly_price)::int as prices from facility_unit_types f join unit_types t on t.id=f.unit_type_id where t.code='UT-2M'`;
    expect(prices?.prices).toBeGreaterThan(1);
    const [links] = await sql`
      select count(*)::int as invalid from storage_units s left join facility_unit_types f on f.id=s.unit_type_id and f.facility_id=s.facility_id where f.id is null
    `;
    expect(links?.invalid).toBe(0);
    const [snapshot] =
      await sql`select monthly_rate_snapshot::text from reservations where id='80000000-0000-4000-8000-000000000001'`;
    expect(Number(snapshot?.monthly_rate_snapshot)).toBe(900000);
    const counts = () => sql`
      select (select count(*)::int from reservations) as reservations,
             (select count(*)::int from appointments) as appointments,
             (select count(*)::int from payments) as payments
    `;
    const before = await counts();
    await sql`update appointments set notes = 'Preserve staff workflow' where id = ${id}`;
    // Reseeding fills missing catalog fixtures, while preserving BOM/FM edits and rental facts.
    await sql`update unit_types set max_monthly_price=1300000 where code='UT-2M'`;
    await sql`update facility_unit_types set monthly_price=1000000, is_active=false where id='60000000-0000-4000-8000-000000000001'`;
    await sql`delete from unit_types where code='UT-3M'`;
    await run("seed");
    expect(await counts()).toEqual(before);
    const [preservedType] = await sql`select max_monthly_price from unit_types where code='UT-2M'`;
    expect(preservedType?.max_monthly_price).toBe(1300000);
    const [preservedOffer] =
      await sql`select monthly_price,is_active from facility_unit_types where id='60000000-0000-4000-8000-000000000001'`;
    expect(preservedOffer).toMatchObject({ monthly_price: 1000000, is_active: false });
    const [restored] = await sql`select count(*)::int as types from unit_types`;
    expect(restored?.types).toBe(9);
    const [preservedSnapshot] =
      await sql`select monthly_rate_snapshot::text from reservations where id='80000000-0000-4000-8000-000000000001'`;
    expect(preservedSnapshot).toEqual(snapshot);
    const [preserved] = await sql`select notes from appointments where id = ${id}`;
    expect(preserved?.notes).toBe("Preserve staff workflow");
  }, 60000);
});
