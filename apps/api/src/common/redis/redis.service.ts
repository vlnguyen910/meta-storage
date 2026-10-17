import type Redis from "ioredis";
import { REDIS_MESSAGES } from "./redis.messages";

function assertValidTtl(ttlSeconds: number): void {
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new RangeError(REDIS_MESSAGES.invalidTtl);
  }
}

export class RedisService {
  constructor(private readonly client: Redis) {}

  async incrementWithExpiry(key: string, ttlSeconds: number): Promise<number> {
    assertValidTtl(ttlSeconds);
    return Number(
      await this.client.eval(
        "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; return n",
        1,
        key,
        ttlSeconds,
      ),
    );
  }

  get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    assertValidTtl(ttlSeconds);
    await this.client.set(key, value, "EX", ttlSeconds);
  }

  // NX and expiry are applied by one Redis command, without a check-then-write race.
  async setIfAbsent(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    assertValidTtl(ttlSeconds);
    return (await this.client.set(key, value, "EX", ttlSeconds, "NX")) === "OK";
  }

  async delete(key: string): Promise<boolean> {
    return (await this.client.del(key)) === 1;
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  // Redis semantics: -2 means absent; -1 means a key written without an expiry.
  getTtl(key: string): Promise<number> {
    return this.client.ttl(key);
  }
}
