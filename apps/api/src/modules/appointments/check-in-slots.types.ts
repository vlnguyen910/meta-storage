import type { CheckInSlot } from "@metastorage/database";

export type ResolvedCheckInSlot = Pick<CheckInSlot, "id" | "sameDayCheckInEnabled"> & {
  checkInDate: string;
  startsAt: Date;
  endsAt: Date;
};
