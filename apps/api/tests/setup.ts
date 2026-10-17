// Load test defaults before route imports validate the API environment.
// These values are public test fixtures, not deployment credentials.
process.env.NODE_ENV = "test";
process.env.CORS_ORIGIN ??= "http://localhost:3000";
process.env.BETTER_AUTH_SECRET ??= "metastorage-test-only-secret-at-least-32-characters";
process.env.BETTER_AUTH_URL ??= "http://localhost:4000";
process.env.AUTH_TRUSTED_ORIGINS ??= "http://localhost:3000";

// Database suites still require explicit DATABASE_URL and BOOKING_TEST_DATABASE_URL.
