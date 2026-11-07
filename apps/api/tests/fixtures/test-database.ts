export function assertTestDatabase(
  target: string | undefined,
  environment: Record<string, string | undefined> = process.env,
  allowExistingLocal = false,
) {
  let url: URL;
  try {
    if (!target) throw new Error("Missing test database URL");
    url = new URL(target);
  } catch {
    throw new Error("An explicit PostgreSQL test database URL is required");
  }
  const isolated = /^\/metastorage_inspection_test_[a-z0-9_]+$/.test(url.pathname);
  const existingLocal =
    allowExistingLocal && url.port === "5433" && url.pathname === "/metastorage";
  if (
    environment.NODE_ENV !== "test" ||
    environment.DATABASE_URL !== target ||
    url.search ||
    url.hash ||
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    (!isolated && !existingLocal)
  )
    throw new Error(
      "Use NODE_ENV=test and a matching, loopback metastorage_inspection_test_* database URL",
    );
}
