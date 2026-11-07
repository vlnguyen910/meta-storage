import { expect, test } from "bun:test";
import Fastify from "fastify";
import { buildApp } from "../../src/app";
import { env } from "../../src/config/env";
import { trustedProxyCidrsSchema } from "../../src/config/env.schema";

test("buildApp applies the configured trusted proxy list", async () => {
  const app = buildApp();
  const optionsSymbol = Object.getOwnPropertySymbols(app).find(
    (symbol) => symbol.description === "fastify.options",
  );
  if (!optionsSymbol) throw new Error("Fastify options are unavailable");
  expect(Reflect.get(app, optionsSymbol).trustProxy).toEqual(env.TRUSTED_PROXY_CIDRS);
});

test("trusted proxy forwards distinct client IPs and an untrusted peer cannot spoof them", async () => {
  const app = Fastify({ trustProxy: trustedProxyCidrsSchema.parse("127.0.0.1,10.5.0.0/24,::1") });
  app.get("/", async (request) => ({ ip: request.ip }));
  try {
    for (const address of ["198.51.100.1", "198.51.100.2"]) {
      const response = await app.inject({
        url: "/",
        remoteAddress: "127.0.0.1",
        headers: { "x-forwarded-for": address },
      });
      expect(response.json().ip).toBe(address);
    }
    const direct = await app.inject({
      url: "/",
      remoteAddress: "192.0.2.8",
      headers: { "x-forwarded-for": "198.51.100.1" },
    });
    expect(direct.json().ip).toBe("192.0.2.8");
    const chain = await app.inject({
      url: "/",
      remoteAddress: "127.0.0.1",
      headers: { "x-forwarded-for": "198.51.100.1, 192.0.2.8" },
    });
    expect(chain.json().ip).toBe("192.0.2.8");
  } finally {
    await app.close();
  }
});

test("missing proxy configuration ignores forwarded headers", async () => {
  const app = Fastify({ trustProxy: trustedProxyCidrsSchema.parse(undefined) });
  app.get("/", async (request) => ({ ip: request.ip }));
  try {
    const response = await app.inject({
      url: "/",
      remoteAddress: "127.0.0.1",
      headers: { "x-forwarded-for": "198.51.100.1" },
    });
    expect(response.json().ip).toBe("127.0.0.1");
  } finally {
    await app.close();
  }
});
