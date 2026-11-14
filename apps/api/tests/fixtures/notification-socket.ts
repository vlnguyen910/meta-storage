import { expect } from "bun:test";
import type { FastifyInstance } from "fastify";

export function notificationSocketHarness(app: FastifyInstance, origin: string, password: string) {
  const address = app.server.address();
  if (!address || typeof address === "string") throw new Error("No server port");
  const url = `ws://127.0.0.1:${address.port}/api/notifications/ws`;
  const sockets: WebSocket[] = [];

  async function login(email: string) {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email",
      headers: { origin },
      payload: { email, password },
    });
    expect(response.statusCode).toBe(200);
    const cookies = response.headers["set-cookie"];
    return (Array.isArray(cookies) ? cookies : [cookies ?? ""])
      .map((cookie) => cookie.split(";")[0])
      .join("; ");
  }

  // Bun accepts headers on a real TCP WebSocket upgrade, including native app Origins.
  async function connect(cookie: string, messages: unknown[] = [], source = origin) {
    const socket = new WebSocket(url, { headers: { cookie, origin: source } });
    sockets.push(socket);
    socket.onmessage = (event) => messages.push(JSON.parse(String(event.data)));
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("WebSocket upgrade timed out")), 3000);
      socket.onopen = () => {
        clearTimeout(timer);
        resolve();
      };
      socket.onerror = () => {
        clearTimeout(timer);
        reject(new Error("WebSocket upgrade rejected"));
      };
    });
    return socket;
  }

  async function waitFor(predicate: () => boolean) {
    const end = Date.now() + 3000;
    while (!predicate() && Date.now() < end) await Bun.sleep(10);
    expect(predicate()).toBe(true);
  }

  return { login, connect, waitFor, sockets };
}
