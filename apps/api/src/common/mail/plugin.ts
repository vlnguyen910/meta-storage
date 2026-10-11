import { MAIL_QUEUE_NAME, type MailJobData } from "@metastorage/shared/mail";
import { Queue } from "bullmq";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

const mailQueuePluginAsync: FastifyPluginAsync = async (fastify) => {
  const queue = new Queue<MailJobData>(MAIL_QUEUE_NAME, { connection: fastify.redis });
  queue.on("error", () => fastify.log.error("Mail queue Redis error"));
  fastify.decorate("mailQueue", queue);
  fastify.addHook("onClose", async () => {
    await queue.close();
  });
};

export const mailQueuePlugin = fp(mailQueuePluginAsync, {
  name: "mail-queue-plugin",
  dependencies: ["redis-plugin"],
});
