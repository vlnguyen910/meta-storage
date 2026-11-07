import { describe, expect, test } from "bun:test";
import { assertTestDatabase } from "../fixtures/test-database";

const target = "postgres://postgres:postgres@127.0.0.1:15433/metastorage_inspection_test_ci";
const config = { NODE_ENV: "test", DATABASE_URL: target };

describe("test database boundary", () => {
  test("accepts an explicitly selected loopback test database", () => {
    expect(() => assertTestDatabase(target, config)).not.toThrow();
  });

  test("rejects missing, mismatched, remote and shared databases", () => {
    for (const url of [
      undefined,
      "invalid",
      target.replace("postgres:", "https:"),
      target.replace("127.0.0.1", "production.example.test"),
      target.replace("metastorage_inspection_test_ci", "metastorage"),
      target.replace("metastorage_inspection_test_ci", "production_test"),
      `${target}?database=metastorage`,
      `${target}?user=production`,
    ]) {
      expect(() => assertTestDatabase(url, { ...config, DATABASE_URL: url })).toThrow();
    }
    expect(() =>
      assertTestDatabase(target, { ...config, DATABASE_URL: `${target}_other` }),
    ).toThrow();
    expect(() => assertTestDatabase(target, { ...config, NODE_ENV: "production" })).toThrow();
  });

  test("keeps the existing local database path behind explicit opt-in", () => {
    const local = "postgres://postgres:postgres@localhost:5433/metastorage";
    expect(() => assertTestDatabase(local, { ...config, DATABASE_URL: local }, true)).not.toThrow();
    expect(() => assertTestDatabase(local, { ...config, DATABASE_URL: local })).toThrow();
    const other = local.replace("5433", "5432");
    expect(() => assertTestDatabase(other, { ...config, DATABASE_URL: other }, true)).toThrow();
  });
});
