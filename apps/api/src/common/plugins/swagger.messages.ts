export const SWAGGER_MESSAGES = {
  description: `HTTP API for the metastorage platform.

### Test with a development account
1. Run \`bun run db:seed\` with a migrated local database to prepare the five development accounts. The seed resets their development passwords.
2. Choose a role in the quick-login bar above, or use an example under **Authentication → POST /api/auth/sign-in/email**.
3. The browser saves the session cookie automatically. Call **GET /api/auth/me** to check the current role. No bearer token is needed.
4. The quick-login bar signs out before switching roles. Manual login can use **POST /api/auth/sign-out** first.

Staff and facility manager accounts are assigned to HCM-01 by the database seed. For Flow 2, use booking \`DEMO-FLOW2-READY\` (\`83000000-0000-4000-8000-000000000001\`) on the seed date between 09:00 and 20:00 Vietnam time. These accounts are development fixtures, separate from the frontend mock accounts.`,
  signInSummary: "Sign in as a seeded development role",
  signInDescription:
    "Select a role example. Login creates the session cookie used by Swagger requests.",
  sessionCreated: "Session cookie created",
  invalidCredentials: "Invalid email or password",
  verificationRequired: "Email verification required",
  signOutSummary: "Sign out before switching roles",
  sessionCleared: "Session cookie cleared",
  localServer: "Current origin (keeps the login session cookie on the same host)",
  quickLogin: {
    title: "Quick login: seeded development roles",
    signingIn: "Signing in…",
    signedIn: "Signed in as ",
    signInFailed: "Sign-in failed: ",
    roleMismatch: "Session role does not match the selected role",
  },
} as const;
