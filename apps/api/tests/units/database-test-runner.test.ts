import { expect, test } from "bun:test";
import {
  assertDatabaseTestEnvironment,
  assertExecutedSuite,
  isDatabaseRegressionSuite,
} from "../run-database-tests";

const target = "postgres://postgres:postgres@127.0.0.1:15433/metastorage_inspection_test_ci";
const valid = {
  NODE_ENV: "test",
  DATABASE_URL: target,
  BOOKING_TEST_DATABASE_URL: target,
  MY_STORAGE_LOCAL_DATABASE_URL: target,
  PRICING_TEST_DATABASE_URL: target,
  REPORTS_TEST_DATABASE_URL: target,
  RUN_INSPECTION_DB_TESTS: "1",
  REDIS_URL: "redis://127.0.0.1:16379/14",
  REDIS_TEST_URL: "redis://127.0.0.1:16379/14",
};

test("database runner refuses missing or unsafe opt-ins before starting a suite", () => {
  expect(() => assertDatabaseTestEnvironment(valid)).not.toThrow();
  for (const key of Object.keys(valid))
    expect(() => assertDatabaseTestEnvironment({ ...valid, [key]: undefined })).toThrow();
  for (const redis of ["redis://production.example/14", "redis://localhost/0", "redis://localhost"])
    expect(() =>
      assertDatabaseTestEnvironment({ ...valid, REDIS_URL: redis, REDIS_TEST_URL: redis }),
    ).toThrow();
});

test("a green exit with zero tests or skipped tests is not a completed regression", () => {
  expect(() =>
    assertExecutedSuite('<testsuite><testcase name="paid" /></testsuite>', "suite"),
  ).not.toThrow();
  for (const report of ["", '<testsuite tests="0" />', "<testcase><skipped /></testcase>"])
    expect(() => assertExecutedSuite(report, "suite")).toThrow();
});

test("database suites remain selected if their opt-in tests are changed to skips", () => {
  expect(
    isDatabaseRegressionSuite('test.skipIf(process.env.RUN_INSPECTION_DB_TESTS !== "1")('),
  ).toBe(true);
  expect(isDatabaseRegressionSuite("test.skip(")).toBe(true);
  expect(isDatabaseRegressionSuite('test("ordinary test", () => {})')).toBe(false);
});
