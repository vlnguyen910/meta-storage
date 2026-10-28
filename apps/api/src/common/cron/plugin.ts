import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import type { CronOptions } from "./cron.types";
import { expireCapacityHolds } from "./expire-capacity-holds";

const HOLD_EXPIRY_INTERVAL_MS = 30_000;

const cronPluginAsync: FastifyPluginAsync<CronOptions> = async (fastify, options) => {
  let timer: ReturnType<typeof setInterval> | undefined;
  let running: Promise<void> | undefined;

  const sweep = () => {
    if (running) return running;
    running = expireCapacityHolds(fastify.db, new Date(), options.facilityId)
      .then(({ expired, skipped }) => {
        if (expired > 0) fastify.log.info({ expired }, "Expired capacity holds");
        if (skipped) fastify.log.debug("Capacity hold expiry skipped: another sweep is running");
      })
      .catch((err: unknown) => {
        fastify.log.error({ err }, "Capacity hold expiry failed; retrying on the next interval");
      })
      .finally(() => {
        running = undefined;
      });
    return running;
  };

  fastify.addHook("onReady", async () => {
    await sweep();
    timer = setInterval(() => {
      void sweep();
    }, HOLD_EXPIRY_INTERVAL_MS);
    timer.unref();
  });

  fastify.addHook("onClose", async () => {
    if (timer) clearInterval(timer);
    await running;
  });
};

export const cronPlugin = fp(cronPluginAsync, {
  name: "cron-plugin",
  dependencies: ["database-plugin"],
});
