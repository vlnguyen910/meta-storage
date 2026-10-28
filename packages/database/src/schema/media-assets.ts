import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const CLOUDINARY_RESOURCE_TYPES = ["image", "video", "raw"] as const;
export type CloudinaryResourceType = (typeof CLOUDINARY_RESOURCE_TYPES)[number];
export const cloudinaryResourceTypeEnum = pgEnum(
  "cloudinary_resource_type",
  CLOUDINARY_RESOURCE_TYPES,
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid().defaultRandom().primaryKey(),
    ownerType: varchar({ length: 50 }).notNull(),
    ownerId: uuid().notNull(),
    purpose: varchar({ length: 50 }).notNull(),
    uploadedBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    filename: varchar({ length: 255 }).notNull(),
    mimeType: varchar({ length: 100 }).notNull(),
    byteSize: integer().notNull(),
    cloudinaryResourceType: cloudinaryResourceTypeEnum().notNull(),
    cloudinaryPublicId: text().notNull().unique(),
    cloudinaryFormat: varchar({ length: 30 }).notNull(),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("media_assets_owner_idx").on(t.ownerType, t.ownerId, t.purpose),
    index("media_assets_uploaded_by_idx").on(t.uploadedBy, t.createdAt),
    check("media_assets_size_valid", sql`${t.byteSize} >= 0`),
  ],
);

export type MediaAsset = typeof mediaAssets.$inferSelect;
export type NewMediaAsset = typeof mediaAssets.$inferInsert;
