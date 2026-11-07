// Isolated HTTP upstream for browser cookie/proxy checks. Never connects to a database.
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

const sessions = new Map();
createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  response.setHeader("Cache-Control", "no-store");
  const send = (status, data) => {
    response.writeHead(status);
    response.end(JSON.stringify(data));
  };
  const success = (data) => send(200, { success: true, data, timestamp: new Date().toISOString() });
  const token = request.headers.cookie?.match(/flow2-session=([^;]+)/)?.[1];
  const user = sessions.get(token);
  if (request.url === "/api/health") return success({ status: "ok" });
  if (request.url === "/api/auth/sign-in/email" && request.method === "POST") {
    let body = "";
    for await (const chunk of request) body += chunk;
    const input = JSON.parse(body);
    if (input.email !== "manager@integration.test" || input.password !== "IntegrationOnly123!")
      return send(401, {
        success: false,
        error: { code: 401, message: "Thông tin đăng nhập không đúng." },
      });
    // Next must retain the browser Origin, rather than impersonating the upstream.
    if (request.headers.origin !== "http://127.0.0.1:3100")
      return send(403, { error: { code: 403, message: "Origin was not preserved" } });
    const id = randomUUID();
    const account = {
      id: "d0000000-0000-4000-8000-000000000001",
      name: "Manager Integration",
      email: input.email,
      phone: null,
      role: "FACILITY_MANAGER",
      status: "ACTIVE",
      assignedFacilityId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    sessions.set(id, account);
    response.setHeader("Set-Cookie", `flow2-session=${id}; HttpOnly; SameSite=Lax; Path=/`);
    return send(200, { user: account });
  }
  if (request.url === "/api/auth/sign-out" && request.method === "POST") {
    sessions.delete(token);
    response.setHeader("Set-Cookie", "flow2-session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
    return success(null);
  }
  if (!user) return send(401, { success: false, error: { code: 401, message: "Unauthenticated" } });
  if (request.url === "/api/auth/me") return success(user);
  if (request.url === "/api/facilities/my-assignments") return success([]);
  return send(404, { success: false, error: { code: 404, message: "Unknown integration route" } });
}).listen(4100, "127.0.0.1");
