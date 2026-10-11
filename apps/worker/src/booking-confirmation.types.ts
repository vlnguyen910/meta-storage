import type { Database } from "@metastorage/database";
import type Redis from "ioredis";
import type { MailAdapter } from "./mail-adapter.types";
export interface BookingConfirmationDependencies {
  db: Database;
  redis: Redis;
  mailAdapter: MailAdapter;
  publicAppUrl: string;
  magicLinkSecret: string;
  qrTokenSecret: string;
}
