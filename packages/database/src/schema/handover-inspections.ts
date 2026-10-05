import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { bookings } from "./bookings";
import { checkInVerifications } from "./checkin-verifications";
import { facilities } from "./facilities";
import { storageUnits } from "./storage-units";
import { unitAssignments } from "./unit-assignments";
import { users } from "./users";

export const inspectionStatusEnum = pgEnum("inspection_status", ["DRAFT", "COMPLETED"]);
export const handoverInspections = pgTable(
  "handover_inspections",
  {
    id: uuid().defaultRandom().primaryKey(),
    bookingId: uuid()
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    facilityId: uuid()
      .notNull()
      .references(() => facilities.id, { onDelete: "restrict" }),
    physicalUnitId: uuid()
      .notNull()
      .references(() => storageUnits.id, { onDelete: "restrict" }),
    unitAssignmentId: uuid()
      .notNull()
      .references(() => unitAssignments.id, { onDelete: "restrict" }),
    verificationId: uuid()
      .notNull()
      .unique()
      .references(() => checkInVerifications.id, { onDelete: "restrict" }),
    unitCode: varchar({ length: 100 }).notNull(),
    policyVersion: varchar({ length: 20 }).default("H6_V1").notNull(),
    status: inspectionStatusEnum().default("DRAFT").notNull(),
    version: integer().default(0).notNull(),
    correctUnit: boolean(),
    conditionNotes: text().default("").notNull(),
    createdBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    completedBy: uuid().references(() => users.id, { onDelete: "restrict" }),
    completedAt: timestamp({ withTimezone: true }),
    handedOverBy: uuid().references(() => users.id, { onDelete: "restrict" }),
    handedOverAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("handover_inspections_booking_idx").on(t.bookingId)],
);

export const inspectionPhotos = pgTable(
  "inspection_photos",
  {
    id: uuid().defaultRandom().primaryKey(),
    inspectionId: uuid()
      .notNull()
      .references(() => handoverInspections.id, { onDelete: "restrict" }),
    uploadedBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    filename: varchar({ length: 120 }).notNull(),
    mimeType: varchar({ length: 40 }).notNull(),
    byteSize: integer().notNull(),
    dataBase64: text(),
    cloudinaryPublicId: text(),
    cloudinaryFormat: varchar({ length: 20 }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("inspection_photos_inspection_idx").on(t.inspectionId)],
);
