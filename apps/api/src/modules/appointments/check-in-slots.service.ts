import type { CheckInSlotOption } from "@metastorage/contracts";
import { localDate } from "../../common/date";
import type { CheckInSlotsRepository } from "./check-in-slots.repository";
import type { ResolvedCheckInSlot } from "./check-in-slots.types";

const FACILITY_TIME_ZONE = "Asia/Ho_Chi_Minh";

export class CheckInSlotsService {
  constructor(private readonly repository: CheckInSlotsRepository) {}

  list(): Promise<CheckInSlotOption[]> {
    return this.repository.list();
  }

  async findByIdForDate(
    checkInSlotId: string,
    checkInDate: string,
  ): Promise<ResolvedCheckInSlot | null> {
    const slot = await this.repository.findByIdForDate(checkInSlotId, checkInDate);
    return slot && slot.endsAt > slot.startsAt ? slot : null;
  }

  findForCheckIn(checkInAt: Date): Promise<ResolvedCheckInSlot | null> {
    return this.repository.findForCheckIn(checkInAt);
  }

  allowsSameDayReservation(slot: ResolvedCheckInSlot, checkInDate: string, now = new Date()) {
    return (
      slot.sameDayCheckInEnabled &&
      checkInDate === localDate(now, FACILITY_TIME_ZONE) &&
      now < slot.endsAt
    );
  }

  allowsCheckInDuringSameDaySlot(slot: ResolvedCheckInSlot, checkInDate: string, now = new Date()) {
    return this.allowsSameDayReservation(slot, checkInDate, now) && now >= slot.startsAt;
  }
}
