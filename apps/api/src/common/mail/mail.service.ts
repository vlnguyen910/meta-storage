import { createHmac } from "node:crypto";
import {
  AUTH_MAIL_TTL_SECONDS,
  type AuthMailInput,
  AuthMailInputSchema,
  AuthMailJobDataSchema,
  type MailJobData,
} from "@metastorage/contracts/mail";
import { encryptMailPayload } from "@metastorage/shared/mail";
import type { Queue } from "bullmq";
import { MAIL_MESSAGES } from "./mail.messages";

// Better Auth is a singleton; its producer uses the queue owned by Fastify.
export class MailProducer {
  private queue?: Queue<MailJobData>;
  private secret = "";

  connect(queue: Queue<MailJobData>, secret: string) {
    this.queue = queue;
    this.secret = secret;
  }

  disconnect(queue: Queue<MailJobData>) {
    if (this.queue !== queue) return;
    this.queue = undefined;
    this.secret = "";
  }

  async enqueue(input: AuthMailInput): Promise<void> {
    if (!this.queue || this.secret.length < 32) throw new Error(MAIL_MESSAGES.notConfigured);
    input = AuthMailInputSchema.parse(input);
    const deliveryId = `auth-mail-${createHmac("sha256", this.secret).update(JSON.stringify(input)).digest("hex")}`;
    const expiresAt = new Date(Date.now() + AUTH_MAIL_TTL_SECONDS * 1000).toISOString();
    await this.queue.add(
      input.kind,
      AuthMailJobDataSchema.parse({
        kind: input.kind,
        deliveryId,
        expiresAt,
        payload: encryptMailPayload(
          JSON.stringify({ ...input, deliveryId, expiresAt }),
          this.secret,
          deliveryId,
        ),
      }),
      {
        jobId: deliveryId,
        attempts: 5,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { age: AUTH_MAIL_TTL_SECONDS },
        removeOnFail: { age: AUTH_MAIL_TTL_SECONDS },
      },
    );
  }
}

export const mailProducer = new MailProducer();
