import type { CheckInSlotsRepository } from "./check-in-slots.repository";
import type { ResolvedCheckInSlot } from "./check-in-slots.types";

export class CheckInSlotsService {
  constructor(private readonly repository: CheckInSlotsRepository) {}

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
}
