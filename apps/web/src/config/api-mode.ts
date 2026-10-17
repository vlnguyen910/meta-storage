// Offline prototype by default. Explicit api mode is retained for integration tests.
export const isMockMode = process.env.NEXT_PUBLIC_API_MODE !== "api";
