import { accounts, db, sessions, users, verifications } from "@metastorage/database";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { AUTH_MESSAGES } from "./auth.messages";

const adapter = drizzleAdapter(db, {
  provider: "pg",
  transaction: true,
  schema: { user: users, session: sessions, account: accounts, verification: verifications },
});

// Let PostgreSQL arbitrate competing account claims. Translate only this known
// constraint so Better Auth never logs a raw insert error containing OAuth tokens.
function withAccountConflictHandling(
  database: Omit<ReturnType<typeof adapter>, "transaction">,
): Omit<ReturnType<typeof adapter>, "transaction"> {
  return {
    ...database,
    create: async (input) => {
      try {
        return await database.create(input);
      } catch (error) {
        const cause = error instanceof Error ? error.cause : undefined;
        if (
          input.model === "account" &&
          cause &&
          typeof cause === "object" &&
          "code" in cause &&
          cause.code === "23505" &&
          "constraint_name" in cause &&
          cause.constraint_name === "accounts_provider_account_idx"
        ) {
          throw new APIError("CONFLICT", {
            code: "ACCOUNT_ALREADY_LINKED",
            message: AUTH_MESSAGES.googleAccountAlreadyLinked,
          });
        }
        throw error;
      }
    },
  };
}

export const authDatabase: typeof adapter = (options) => {
  const database = adapter(options);
  return {
    ...withAccountConflictHandling(database),
    // Better Auth supplies a new adapter inside a transaction; retain the same
    // constraint handling there as for standalone explicit account linking.
    transaction: async (callback) =>
      database.transaction((transaction) => callback(withAccountConflictHandling(transaction))),
  };
};
