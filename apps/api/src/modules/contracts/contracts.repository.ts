import { RENTAL_DOCUMENT_MESSAGES as m } from "@metastorage/contracts";
import {
  and,
  bookingContractAudit,
  bookingContracts,
  bookings,
  type Database,
  desc,
  eq,
  facilities,
  facilityAssignments,
  gt,
  handoverInspections,
  isNotNull,
  isNull,
  or,
  payments,
  rentals,
  unitTypes,
  users,
} from "@metastorage/database";
import { NotFoundError } from "../../common/errors/app-error";
import type { ContractRow, ContractTransaction } from "./contracts.types";
export class ContractsRepository {
  constructor(readonly db: Database) {}
  async booking(id: string, tx: ContractTransaction | Database = this.db) {
    const [row] = await tx
      .select({ booking: bookings, facility: facilities, unitType: unitTypes })
      .from(bookings)
      .innerJoin(facilities, eq(facilities.id, bookings.facilityId))
      .innerJoin(unitTypes, eq(unitTypes.id, bookings.unitTypeId))
      .where(eq(bookings.id, id));
    if (!row) throw new NotFoundError(m.notFound);
    return row;
  }
  async rental(id: string) {
    const [row] = await this.db
      .select({ bookingId: rentals.bookingId })
      .from(rentals)
      .where(eq(rentals.id, id));
    if (!row) throw new NotFoundError(m.notFound);
    return row;
  }
  async locked<T>(bookingId: string, action: (tx: ContractTransaction) => Promise<T>) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select({ id: bookings.id })
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .for("update");
      if (!row) throw new NotFoundError(m.notFound);
      return action(tx);
    });
  }
  async member(
    tx: ContractTransaction,
    facilityId: string,
    userId: string,
    role: "FACILITY_MANAGER" | "FACILITY_STAFF",
  ) {
    const [row] = await tx
      .select({ id: facilityAssignments.id })
      .from(facilityAssignments)
      .innerJoin(users, eq(users.id, facilityAssignments.userId))
      .where(
        and(
          eq(facilityAssignments.facilityId, facilityId),
          eq(facilityAssignments.userId, userId),
          eq(facilityAssignments.role, role),
          eq(facilityAssignments.isActive, true),
          eq(users.role, role),
          eq(users.status, "ACTIVE"),
          or(isNull(facilityAssignments.endedAt), gt(facilityAssignments.endedAt, new Date())),
        ),
      )
      .for("share");
    return Boolean(row);
  }
  list(bookingId: string, tx: ContractTransaction | Database = this.db) {
    return tx
      .select()
      .from(bookingContracts)
      .where(eq(bookingContracts.bookingId, bookingId))
      .orderBy(desc(bookingContracts.version));
  }
  async current(bookingId: string, tx: ContractTransaction | Database = this.db) {
    const [row] = await tx
      .select()
      .from(bookingContracts)
      .where(and(eq(bookingContracts.bookingId, bookingId), eq(bookingContracts.status, "ISSUED")))
      .orderBy(desc(bookingContracts.version))
      .limit(1);
    return row;
  }
  async payment(tx: ContractTransaction, bookingId: string) {
    const [row] = await tx
      .select()
      .from(payments)
      .where(eq(payments.bookingId, bookingId))
      .orderBy(desc(payments.createdAt), desc(payments.id))
      .limit(1);
    return row;
  }
  async hasRental(tx: ContractTransaction, bookingId: string) {
    const [row] = await tx
      .select({ id: rentals.id })
      .from(rentals)
      .where(eq(rentals.bookingId, bookingId));
    return Boolean(row);
  }
  async handoverContract(bookingId: string, tx: ContractTransaction | Database = this.db) {
    const [row] = await tx
      .select({ contractId: handoverInspections.contractId })
      .from(handoverInspections)
      .where(
        and(
          eq(handoverInspections.bookingId, bookingId),
          isNotNull(handoverInspections.handedOverAt),
        ),
      )
      .limit(1);
    return row?.contractId ?? null;
  }
  async objectReferenced(key: string) {
    const [row] = await this.db
      .select({ id: bookingContracts.id })
      .from(bookingContracts)
      .where(eq(bookingContracts.objectKey, key))
      .limit(1);
    return Boolean(row);
  }
  async insert(
    tx: ContractTransaction,
    values: typeof bookingContracts.$inferInsert,
  ): Promise<ContractRow> {
    const [row] = await tx.insert(bookingContracts).values(values).returning();
    if (!row) throw new NotFoundError(m.notFound);
    return row;
  }
  async issue(
    tx: ContractTransaction,
    id: string,
    actorId: string,
    terms: NonNullable<ContractRow["termsSnapshot"]>,
  ) {
    const [row] = await tx
      .update(bookingContracts)
      .set({ status: "ISSUED", issuedBy: actorId, issuedAt: new Date(), termsSnapshot: terms })
      .where(and(eq(bookingContracts.id, id), eq(bookingContracts.status, "UPLOADED")))
      .returning();
    if (!row) throw new NotFoundError(m.notFound);
    return row;
  }
  audit(
    tx: ContractTransaction,
    bookingId: string,
    contractId: string,
    actorId: string,
    action: string,
    details: Record<string, unknown>,
  ) {
    return tx
      .insert(bookingContractAudit)
      .values({ bookingId, contractId, actorId, action, details });
  }
}
