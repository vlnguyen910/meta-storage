import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import Redis from "ioredis";
import { env } from "../../config/env";
import { RedisService } from "./redis.service";
import type { RedisPluginOptions } from "./redis.types";

const redisPluginAsync: FastifyPluginAsync<RedisPluginOptions> = async (fastify, options) => {
  const redis = new Redis(options.url ?? env.REDIS_URL, {
    lazyConnect: true,
    connectTimeout: 5_000,
    commandTimeout: 2_000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: (attempt) => Math.min(attempt * 200, 2_000),
  });

  // Avoid logging connection URLs or command arguments that may contain secrets.
  redis.on("error", () => fastify.log.warn("Redis connection error"));
  fastify.decorate("redis", redis);
  fastify.decorate("redisService", new RedisService(redis));
  fastify.addHook("onClose", async () => {
    if (redis.status === "end") return;
    const closed = new Promise<void>((resolve) => redis.once("end", resolve));
    try {
      if (redis.status === "ready") await redis.quit();
    } finally {
      redis.disconnect();
      await closed;
    }
  });

  fastify.log.info("Connecting to Redis...");
  try {
    await redis.connect();
    await redis.ping();
    fastify.log.info("Redis connection established");
  } catch (error) {
    fastify.log.error("Redis connection failed");
    redis.disconnect();
    throw error;
  }
};

export const redisPlugin = fp(redisPluginAsync, {
  name: "redis-plugin",
});
