import { sql } from "drizzle-orm";
import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { UserRole, UserStatus } from "./user-enums";

export { ROLES, type Role, USER_STATUS, UserRole, UserStatus } from "./user-enums";
export const roleEnum = pgEnum("role", UserRole);
export const statusEnum = pgEnum("status", UserStatus);

export const users = pgTable(
  "users",
  {
    id: uuid().defaultRandom().primaryKey(),
    name: text().notNull(),
    email: varchar({ length: 255 }).notNull().unique(),
    emailVerified: boolean().default(false).notNull(),
    image: text(),
    phone: varchar({ length: 20 }).unique(),
    role: roleEnum(),
    status: statusEnum(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("users_single_system_admin_idx")
      .on(table.role)
      .where(sql`${table.role} = 'SYSTEM_ADMIN'`),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
