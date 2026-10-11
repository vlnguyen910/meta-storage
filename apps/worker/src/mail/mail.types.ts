import type { Database } from "@metastorage/database";
import type Redis from "ioredis";

export interface MailMessage {
  deliveryId: string;
  recipientEmail: string;
  subject: string;
  html: string;
  text: string;
}

export interface ResendMailAdapterOptions {
  apiKey: string;
  fromEmail: string;
  fetcher?: (url: string, options: RequestInit) => Promise<Response>;
}

export interface MailAdapter {
  send(input: MailMessage): Promise<{
    providerMessageId: string;
  }>;
}

export interface BookingConfirmationDependencies {
  db: Database;
  redis: Redis;
  mailAdapter: MailAdapter;
  mailPayloadSecret: string;
}
