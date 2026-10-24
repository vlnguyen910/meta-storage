import { expect, test } from "bun:test";
import { localTestUrls } from "../run-local-database-tests";

test("local database wrapper defaults to loopback administration and reserved Redis", () => {
  const urls = localTestUrls({});
  expect(urls.postgres.href).toBe("postgres://postgres:postgres@127.0.0.1:5433/postgres");
  expect(urls.redis.href).toBe("redis://127.0.0.1:6379/12");
  expect(
    localTestUrls({
      LOCAL_TEST_POSTGRES_URL: "postgresql://test:pass@localhost:15433/postgres",
      LOCAL_TEST_REDIS_URL: "redis://localhost:16379/12",
    }).redis.pathname,
  ).toBe("/12");
});

test("local database wrapper rejects business databases, remote hosts and Redis DB 0", () => {
  for (const url of [
    "postgres://localhost/metastorage",
    "postgres://production.example/postgres",
    "postgres://localhost/postgres?host=production.example",
    "postgres://localhost/postgres#unsafe",
    "https://localhost/postgres",
    "not a URL",
  ])
    expect(() => localTestUrls({ LOCAL_TEST_POSTGRES_URL: url })).toThrow();
  for (const url of [
    "redis://production.example/12",
    "redis://localhost/0",
    "redis://localhost",
    "redis://localhost/16",
    "redis://localhost/12?db=0",
    "redis://localhost/12#unsafe",
    "https://localhost/12",
    "not a URL",
  ])
    expect(() => localTestUrls({ LOCAL_TEST_REDIS_URL: url })).toThrow();
});
