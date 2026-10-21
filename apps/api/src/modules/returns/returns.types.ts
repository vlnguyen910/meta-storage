import type { bookings, Database, rentals, returnRequests } from "@metastorage/database";
import type { InspectionPhotoStorage } from "../../common/adapters/storage/photo-storage.types";

export interface ReturnsRoutesOptions {
  photoStorage?: InspectionPhotoStorage;
}

export type ReturnTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export interface ReturnContext {
  rental: typeof rentals.$inferSelect;
  booking: typeof bookings.$inferSelect;
}
export type ReturnRequestRow = typeof returnRequests.$inferSelect;
