import { DEV_AUTH_ACCOUNTS, DEV_AUTH_PASSWORD } from "../../dev/auth-fixtures";
import { SWAGGER_MESSAGES } from "./swagger.messages";

// Served only by the development Swagger UI. Use the existing session endpoints.
export const swaggerQuickLoginJs = `(() => {
  const accounts = ${JSON.stringify(DEV_AUTH_ACCOUNTS.map(({ role, email }) => ({ role, email })))};
  const password = ${JSON.stringify(DEV_AUTH_PASSWORD)};
  const messages = ${JSON.stringify(SWAGGER_MESSAGES.quickLogin)};

  function mount() {
    const swagger = document.getElementById("swagger-ui");
    if (!swagger) return;
    const panel = document.createElement("section");
    panel.className = "swagger-demo-login";
    const heading = document.createElement("strong");
    heading.textContent = messages.title;
    const actions = document.createElement("div");
    actions.className = "swagger-demo-login-actions";
    const status = document.createElement("span");
    status.setAttribute("role", "status");
    const buttons = accounts.map(({ role, email }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = role;
      button.title = email;
      button.addEventListener("click", async () => {
        buttons.forEach((item) => { item.disabled = true; });
        status.textContent = messages.signingIn;
        try {
          await fetch("/api/auth/sign-out", { method: "POST", credentials: "same-origin" });
          const response = await fetch("/api/auth/sign-in/email", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, rememberMe: true }),
          });
          if (!response.ok) throw new Error(String(response.status));
          const session = await fetch("/api/auth/me", { credentials: "same-origin" });
          if (!session.ok) throw new Error(String(session.status));
          const current = await session.json();
          if (current.data?.role !== role) throw new Error(messages.roleMismatch);
          status.textContent = messages.signedIn + role + " (" + email + ")";
        } catch (error) {
          status.textContent = messages.signInFailed + (error instanceof Error ? error.message : "");
        } finally {
          buttons.forEach((item) => { item.disabled = false; });
        }
      });
      actions.appendChild(button);
      return button;
    });
    panel.append(heading, actions, status);
    swagger.before(panel);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})();`;

export const swaggerQuickLoginCss = `
.swagger-demo-login { margin: 16px auto; max-width: 1460px; padding: 16px 20px;
  border: 1px solid #d9e2e7; border-radius: 8px; font-family: sans-serif; }
.swagger-demo-login-actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
.swagger-demo-login button { padding: 8px 12px; border: 1px solid #315b73;
  border-radius: 4px; background: #fff; color: #17384a; cursor: pointer; }
.swagger-demo-login button:hover { background: #edf5f8; }
.swagger-demo-login button:disabled { opacity: .55; cursor: wait; }
.swagger-demo-login [role=status] { display: block; min-height: 20px; }
`;
