import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import Fastify from "fastify";
import { redisPlugin } from "../../src/common/redis/plugin";

const testUrl = process.env.REDIS_TEST_URL;

describe.skipIf(!testUrl)("Redis service with a real Redis server", () => {
  const app = Fastify();
  const keys: string[] = [];
  const newKey = () => {
    const key = `integration:redis-service:${randomUUID()}`;
    keys.push(key);
    return key;
  };

  beforeAll(async () => {
    app.register(redisPlugin, { url: testUrl });
    app.register(async (routes) => {
      routes.get("/redis-test", async () => ({
        exists: await routes.redisService.exists(newKey()),
      }));
    });
    await app.ready();
  });

  afterAll(async () => {
    try {
      if (app.hasDecorator("redis") && app.redis.status === "ready" && keys.length > 0) {
        await app.redis.del(...keys);
      }
    } finally {
      await app.close();
    }
    expect(app.redis.status).toBe("end");
  });

  test("is available to sibling modules and temporary values expire", async () => {
    const response = await app.inject("/redis-test");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ exists: false });
    const key = newKey();
    await app.redisService.set(key, "temporary", 1);
    expect(await app.redisService.get(key)).toBe("temporary");
    expect(await app.redisService.exists(key)).toBe(true);
    expect(await app.redisService.getTtl(key)).toBeGreaterThanOrEqual(0);
    expect(await app.redisService.getTtl(key)).toBeLessThanOrEqual(1);
    await setTimeout(1_100);
    expect(await app.redisService.get(key)).toBeNull();
    expect(await app.redisService.exists(key)).toBe(false);
    expect(await app.redisService.getTtl(key)).toBe(-2);
  });

  test("concurrent NX writes have exactly one winner with an expiry", async () => {
    const key = newKey();
    const results = await Promise.all(
      ["first", "second", "third"].map((value) => app.redisService.setIfAbsent(key, value, 30)),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await app.redisService.get(key)).toBe(
      ["first", "second", "third"][results.indexOf(true)],
    );
    expect(await app.redisService.getTtl(key)).toBeGreaterThan(0);
    expect(await app.redisService.delete(key)).toBe(true);
    expect(await app.redisService.delete(key)).toBe(false);
  });

  test("invalid expiry never creates a persistent key", async () => {
    const key = newKey();
    for (const ttl of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(app.redisService.set(key, "value", ttl)).rejects.toBeInstanceOf(RangeError);
      await expect(app.redisService.setIfAbsent(key, "value", ttl)).rejects.toBeInstanceOf(
        RangeError,
      );
    }
    expect(await app.redisService.exists(key)).toBe(false);
  });
});
