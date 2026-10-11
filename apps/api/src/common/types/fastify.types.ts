import type { Database } from "@metastorage/database";
import type { MailJobData } from "@metastorage/shared/mail";
import type { Queue } from "bullmq";
import type Redis from "ioredis";
import type { AuthSession, AuthUser } from "../../modules/auth/auth";
import type { FacilityContext } from "../../modules/facilities/facilities.guard.types";
import type { RedisService } from "../redis/redis.service";

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser | null;
    session: AuthSession["session"] | null;
    facilityContext: FacilityContext | null;
  }

  interface FastifyInstance {
    mailQueue: Queue<MailJobData>;
    db: Database;
    redis: Redis;
    redisService: RedisService;
  }
}
