import { NotFoundError } from "../../common/errors/app-error";
import { RENTAL_MESSAGES } from "./rentals.messages";
import type { RentalsRepository } from "./rentals.repository";

export class RentalsService {
  constructor(private readonly repository: RentalsRepository) {}

  async listMine(userId: string) {
    return this.repository.listByUserId(userId);
  }

  async getMine(rentalId: string, userId: string) {
    const rental = await this.repository.findByIdAndUserId(rentalId, userId);
    if (!rental) throw new NotFoundError(RENTAL_MESSAGES.rentalNotFound);
    return rental;
  }
}
