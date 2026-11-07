# Authentication and role setup

The web app uses Better Auth's database-backed cookie session in remote mode. The API reads the
session cookie on protected requests and loads the user's current role and status from PostgreSQL.
The browser's stored user object only supports navigation; it does not grant API access.

## Local setup

1. Copy `apps/api/.env.example` to `apps/api/.env`. For local development, set
   `NODE_ENV=development`, a private `BETTER_AUTH_SECRET` of at least 32 characters, and
   `DATABASE_URL` for the database you intend to use. Set `DOCKER_DATABASE_URL` only when
   you want to override that URL with a local Docker database.
2. Copy `apps/web/.env.example` to `apps/web/.env.local`. The default mode is `remote`, with the
   API at `http://localhost:4000/api`. Set `NEXT_PUBLIC_API_MODE=mock` only to use demo accounts.
3. From the repository root, run `bun run db:migrate` to apply existing migrations to the
   configured database, then start the API and web workspaces.
4. Create the first account with Better Auth's email sign-up endpoint:

   ```sh
   curl -i -X POST http://localhost:4000/api/auth/sign-up/email \
     -H 'Content-Type: application/json' \
     -d '{"name":"StoreX Administrator","email":"admin@storex.vn","password":"replace-with-a-long-password"}'
   ```

5. Promote that account once using a trusted database connection:

   ```sql
   UPDATE users
   SET role = 'SYSTEM_ADMIN'
   WHERE email = 'admin@storex.vn';
   ```

   Sign in again after promotion. System Administrators can then assign any supported role from
   **Người dùng & vai trò**. Public sign-up cannot set or change a role.

## Session and authorization behavior

- Login and logout use Better Auth's `/sign-in/email` and `/sign-out` endpoints. The API client sends
  cookies with credentialed requests. Session lookup uses `GET /api/users/me`, whose API guard
  validates the Better Auth cookie before returning the current database user.
- Fastify route guards verify the Better Auth session, reject inactive accounts, and enforce role
  access. Facility routes also check the user's active facility assignment.
- Assigning `FACILITY_STAFF` or `FACILITY_MANAGER` sets the global role only. Access to a specific
  facility still requires a separate facility assignment.
- The mock API remains available for UI demos and is not connected to PostgreSQL.
