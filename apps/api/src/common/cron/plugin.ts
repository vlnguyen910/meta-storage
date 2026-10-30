import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { createPaymentsService } from "../../modules/payments/payments.service";
import { createReservationsService } from "../../modules/reservations/reservations.service";
import type { CronOptions } from "./cron.types";
import { expireCapacityHolds } from "./expire-capacity-holds";

const HOLD_EXPIRY_INTERVAL_MS = 30_000;

const cronPluginAsync: FastifyPluginAsync<CronOptions> = async (fastify, options) => {
  let timer: ReturnType<typeof setInterval> | undefined;
  let running: Promise<void> | undefined;

  const sweep = () => {
    if (running) return running;
    running = Promise.allSettled([
      createReservationsService(fastify.db).sweepNoShows(new Date(), options.facilityId),
      createPaymentsService(fastify)
        .reconcilePendingPayments(options.facilityId)
        .then(({ failed }) => {
          if (failed > 0)
            fastify.log.warn({ failed }, "SePay reconciliation failed; retrying on the next sweep");
        }),
      expireCapacityHolds(fastify.db, new Date(), options.facilityId).then(
        ({ expired, skipped }) => {
          if (expired > 0) fastify.log.info({ expired }, "Expired capacity holds");
          if (skipped) fastify.log.debug("Capacity hold expiry skipped: another sweep is running");
        },
      ),
    ])
      .then((results) => {
        for (const result of results) {
          if (result.status === "rejected")
            fastify.log.error(
              { err: result.reason },
              "Reservation lifecycle sweep failed; retrying on the next interval",
            );
        }
      })
      .catch((err: unknown) => {
        fastify.log.error(
          { err },
          "Reservation lifecycle sweep failed; retrying on the next interval",
        );
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
