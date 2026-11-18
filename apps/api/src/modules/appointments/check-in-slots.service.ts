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

  async allowsSameDayReservationForStartAt(checkInAt: Date, now = new Date()) {
    const slot = await this.repository.findUniqueByStartAt(checkInAt);
    if (!slot || slot.endsAt <= slot.startsAt) return false;
    return this.allowsSameDayReservation(slot, localDate(checkInAt, FACILITY_TIME_ZONE), now);
  }

  findForCheckIn(checkInAt: Date): Promise<ResolvedCheckInSlot | null> {
    return this.repository.findForCheckIn(checkInAt);
  }

  allowsSameDayAppointment(slot: ResolvedCheckInSlot, scheduledDate: string, now = new Date()) {
    return scheduledDate === localDate(now, FACILITY_TIME_ZONE) && now < slot.endsAt;
  }

  /** A same-day check-in slot ignores its time window: any time today is allowed. */
  allowsSameDayReservation(slot: ResolvedCheckInSlot, checkInDate: string, now = new Date()) {
    if (slot.sameDayCheckInEnabled) return checkInDate === localDate(now, FACILITY_TIME_ZONE);
    return this.allowsSameDayAppointment(slot, checkInDate, now);
  }

  allowsCheckInDuringSameDaySlot(slot: ResolvedCheckInSlot, checkInDate: string, now = new Date()) {
    return slot.sameDayCheckInEnabled && checkInDate === localDate(now, FACILITY_TIME_ZONE);
  }
}
