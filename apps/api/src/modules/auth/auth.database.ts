import { accounts, db, eq, sessions, users, verifications } from "@metastorage/database";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import type { AuthDatabaseConnection } from "./auth.database.types";
import { AUTH_MESSAGES } from "./auth.messages";

const adapterConfig = {
  provider: "pg",
  transaction: true,
  schema: { user: users, session: sessions, account: accounts, verification: verifications },
} as const;
const adapter = drizzleAdapter(db, adapterConfig);

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
  const scoped = (connection: AuthDatabaseConnection): ReturnType<typeof adapter> => {
    const database = withAccountConflictHandling(
      drizzleAdapter(connection, adapterConfig)(options),
    );
    return {
      ...database,
      create: async (input) => {
        if (input.model !== "session") return database.create(input);
        const userId = input.data.userId;
        if (typeof userId !== "string")
          throw new APIError("UNAUTHORIZED", { message: AUTH_MESSAGES.loginRequired });
        return connection.transaction(async (tx) => {
          // Hold the user lock through session insertion, serializing with lock/role change and revocation.
          const [user] = await tx
            .select({ status: users.status })
            .from(users)
            .where(eq(users.id, userId))
            .for("share");
          if (user?.status !== "ACTIVE")
            throw new APIError("FORBIDDEN", {
              code: "ACCOUNT_DISABLED",
              message: AUTH_MESSAGES.accountDisabled,
            });
          return withAccountConflictHandling(drizzleAdapter(tx, adapterConfig)(options)).create(
            input,
          );
        });
      },
      transaction: async (callback) => connection.transaction((tx) => callback(scoped(tx))),
    };
  };
  return scoped(db);
};
