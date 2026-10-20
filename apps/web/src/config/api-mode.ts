// The offline prototype requires an explicit opt-in; normal builds use the backend.
export const isMockMode = process.env.NEXT_PUBLIC_API_MODE === "mock";
