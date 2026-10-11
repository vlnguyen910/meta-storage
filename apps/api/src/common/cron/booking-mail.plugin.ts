import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { BookingEmailRepository } from "../../modules/bookings/booking-email.repository";
import { BookingEmailService } from "../../modules/bookings/booking-email.service";

const bookingMailPluginAsync: FastifyPluginAsync = async (fastify) => {
  const service = new BookingEmailService(new BookingEmailRepository(fastify.db), fastify.redis, {
    publicAppUrl: process.env.PUBLIC_APP_URL ?? "http://localhost:3000",
    magicLinkSecret: process.env.BOOKING_MAGIC_LINK_SECRET ?? "",
    qrTokenSecret: process.env.QR_TOKEN_SECRET ?? "storex-dev-qr-secret",
  });
  let timer: ReturnType<typeof setInterval> | undefined;
  let running: Promise<void> | undefined;
  const prepare = () => {
    if (running) return running;
    running = service
      .preparePendingConfirmations()
      .catch(() => {
        fastify.log.error("Booking confirmation preparation failed; retrying on the next interval");
      })
      .finally(() => {
        running = undefined;
      });
    return running;
  };
  fastify.addHook("onReady", async () => {
    await prepare();
    timer = setInterval(() => {
      void prepare();
    }, 10_000);
    timer.unref();
  });
  fastify.addHook("onClose", async () => {
    if (timer) clearInterval(timer);
    await running;
  });
};

export const bookingMailPlugin = fp(bookingMailPluginAsync, {
  name: "booking-mail-plugin",
  dependencies: ["database-plugin", "redis-plugin"],
});
