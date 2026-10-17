import type { CheckInSlot } from "@metastorage/database";

export type ResolvedCheckInSlot = Pick<CheckInSlot, "id"> & {
  checkInDate: string;
  startsAt: Date;
  endsAt: Date;
};
