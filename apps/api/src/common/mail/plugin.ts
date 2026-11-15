import { MAIL_QUEUE_NAME, type MailJobData } from "@metastorage/contracts/mail";

import { Queue } from "bullmq";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { env } from "../../config/env";
import { mailProducer } from "./mail.service";

const mailQueuePluginAsync: FastifyPluginAsync = async (fastify) => {
  const queue = new Queue<MailJobData>(MAIL_QUEUE_NAME, { connection: fastify.redis });
  queue.on("error", () => fastify.log.error("Mail queue Redis error"));
  fastify.decorate("mailQueue", queue);
  mailProducer.connect(queue, env.BOOKING_MAGIC_LINK_SECRET);
  fastify.addHook("onClose", async () => {
    mailProducer.disconnect(queue);
    await queue.close();
  });
};

export const mailQueuePlugin = fp(mailQueuePluginAsync, {
  name: "mail-queue-plugin",
  dependencies: ["redis-plugin"],
});
