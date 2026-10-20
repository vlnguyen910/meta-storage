import { randomUUID } from "node:crypto";
import type {
  ContractIssue,
  ContractTermsSnapshot,
  ContractUpload,
  RentalDocumentDto,
} from "@metastorage/contracts";
import { RENTAL_DOCUMENT_MESSAGES as m } from "@metastorage/contracts";
import { z } from "zod";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../common/errors/app-error";
import { contractHash, decodeContract, validateContractPdf } from "./contracts.policy";
import type { ContractsRepository } from "./contracts.repository";
import type {
  ContractActor,
  ContractRow,
  ContractStorage,
  ContractTransaction,
} from "./contracts.types";
import { S3ContractStorage } from "./s3-contract.storage";

const dto = (
  row: ContractRow,
  currentId: string | null,
  usedId: string | null,
): RentalDocumentDto => ({
  id: row.id,
  bookingId: row.bookingId,
  version: row.version,
  status: row.status,
  filename: row.filename,
  byteSize: row.byteSize,
  pageCount: row.pageCount,
  uploadedAt: row.uploadedAt.toISOString(),
  issuedAt: row.issuedAt?.toISOString() ?? null,
  terms: row.termsSnapshot,
  currentIssued: row.id === currentId,
  usedForHandover: row.id === usedId,
});
export class ContractsService {
  constructor(
    readonly repository: ContractsRepository,
    private readonly storage: ContractStorage = new S3ContractStorage(),
  ) {}
  private async access(
    tx: ContractTransaction,
    actor: ContractActor,
    bookingId: string,
    write = false,
  ) {
    const context = await this.repository.booking(bookingId, tx),
      booking = context.booking;
    if (actor.role === "CUSTOMER" && !write) {
      if (booking.userId !== actor.id) throw new NotFoundError(m.notFound);
    } else if (actor.role === "FACILITY_MANAGER" || (!write && actor.role === "FACILITY_STAFF")) {
      if (
        !(await this.repository.member(tx, booking.facilityId, actor.id, actor.role)) ||
        (actor.role === "FACILITY_STAFF" && booking.assignedStaffId !== actor.id)
      )
        throw new ForbiddenError(m.forbidden);
    } else throw new ForbiddenError(m.forbidden);
    return context;
  }
  private async mutable(tx: ContractTransaction, bookingId: string, status: string) {
    if (
      !["DRAFT", "CONFIRMED"].includes(status) ||
      (await this.repository.hasRental(tx, bookingId))
    )
      throw new ConflictError(m.conflict);
  }
  private async terms(tx: ContractTransaction, bookingId: string): Promise<ContractTermsSnapshot> {
    const { booking: b, facility: f, unitType: u } = await this.repository.booking(bookingId, tx);
    const payment = await this.repository.payment(tx, bookingId);
    const whole = (amount: string) =>
      /^\d+(?:\.0+)?$/.test(amount) ? BigInt(amount.replace(/\.0+$/, "")) : null;
    if (
      payment?.status !== "SUCCEEDED" ||
      !payment.paidAt ||
      payment.currency !== "VND" ||
      whole(payment.totalAmount) === null ||
      whole(payment.totalAmount) !== whole(b.totalAmount)
    )
      throw new ConflictError(m.paymentRequired);
    if (b.status !== "CONFIRMED") throw new ConflictError(m.conflict);
    const rate = whole(b.monthlyRateSnapshot),
      fee = whole(b.rentalFeeAmount),
      deposit = whole(b.depositAmount);
    if (
      !b.contactName?.trim() ||
      !b.contactEmail?.trim() ||
      !z.email().safeParse(b.contactEmail.trim()).success ||
      !b.contactPhone?.trim() ||
      !f.name.trim() ||
      !f.address.trim() ||
      !u.name.trim() ||
      !Number.isInteger(b.requestedMonths) ||
      b.requestedMonths < 1 ||
      rate === null ||
      fee === null ||
      deposit === null ||
      rate === 0n ||
      fee === 0n ||
      fee + deposit !== whole(b.totalAmount) ||
      !Number.isFinite(b.rentalEndAt.getTime()) ||
      b.rentalEndAt <= new Date(`${b.checkInDate}T00:00:00Z`)
    )
      throw new ValidationError(m.incomplete);
    return {
      bookingId,
      contactName: b.contactName.trim(),
      contactEmail: b.contactEmail.trim(),
      contactPhone: b.contactPhone.trim(),
      facilityId: f.id,
      facilityName: f.name,
      facilityAddress: f.address,
      unitTypeId: u.id,
      unitTypeName: u.name,
      requestedMonths: b.requestedMonths,
      checkInDate: b.checkInDate,
      checkInSlotId: b.checkInSlotId,
      rentalEndAt: b.rentalEndAt.toISOString(),
      monthlyRate: b.monthlyRateSnapshot,
      rentalFee: b.rentalFeeAmount,
      deposit: b.depositAmount,
      paymentId: payment.id,
      paidAt: payment.paidAt.toISOString(),
    };
  }
  private visible(actor: ContractActor, row: ContractRow) {
    return actor.role === "FACILITY_MANAGER" || row.status === "ISSUED";
  }
  private async result(tx: ContractTransaction, row: ContractRow) {
    return dto(
      row,
      (await this.repository.current(row.bookingId, tx))?.id ?? null,
      await this.repository.handoverContract(row.bookingId, tx),
    );
  }
  async list(actor: ContractActor, bookingId: string) {
    return this.repository.locked(bookingId, async (tx) => {
      await this.access(tx, actor, bookingId);
      const rows = await this.repository.list(bookingId, tx),
        current = rows.find((row) => row.status === "ISSUED");
      const usedId = await this.repository.handoverContract(bookingId, tx);
      return rows
        .filter((row) => this.visible(actor, row))
        .map((row) => dto(row, current?.id ?? null, usedId));
    });
  }
  async rental(actor: ContractActor, rentalId: string) {
    return this.list(actor, (await this.repository.rental(rentalId)).bookingId);
  }
  async upload(actor: ContractActor, bookingId: string, input: ContractUpload) {
    // Authorize before PDF parsing/storage; recheck live membership and booking after I/O.
    const existing = await this.repository.locked(bookingId, async (tx) => {
      const context = await this.access(tx, actor, bookingId, true);
      await this.mutable(tx, bookingId, context.booking.status);
      return (await this.repository.list(bookingId, tx)).find(
        (row) => row.idempotencyKey === input.idempotencyKey,
      );
    });
    const bytes = decodeContract(input.dataBase64),
      info = await validateContractPdf(bytes);
    const matches = (row: ContractRow) =>
      row.sha256 === info.sha256 && row.filename === input.filename && row.uploadedBy === actor.id;
    if (existing) {
      if (!matches(existing)) throw new ConflictError(m.conflict);
      return this.repository.locked(bookingId, async (tx) => {
        await this.access(tx, actor, bookingId, true);
        const row = (await this.repository.list(bookingId, tx)).find((r) => r.id === existing.id);
        if (!row) throw new ConflictError(m.conflict);
        return this.result(tx, row);
      });
    }
    const id = randomUUID(),
      objectKey = `contracts/${bookingId}/${id}.pdf`;
    let retained = false,
      writeStarted = false,
      transactionResolved = false;
    try {
      await this.storage.put(objectKey, bytes);
      writeStarted = true;
      const result = await this.repository.locked(bookingId, async (tx) => {
        const context = await this.access(tx, actor, bookingId, true);
        await this.mutable(tx, bookingId, context.booking.status);
        const versions = await this.repository.list(bookingId, tx),
          duplicate = versions.find((row) => row.idempotencyKey === input.idempotencyKey);
        if (duplicate) {
          if (!matches(duplicate)) throw new ConflictError(m.conflict);
          return this.result(tx, duplicate);
        }
        const row = await this.repository.insert(tx, {
          id,
          bookingId,
          version: (versions[0]?.version ?? 0) + 1,
          filename: input.filename,
          objectKey,
          idempotencyKey: input.idempotencyKey,
          uploadedBy: actor.id,
          ...info,
        });
        await this.repository.audit(tx, bookingId, id, actor.id, "CONTRACT_UPLOADED", {
          version: row.version,
          sha256: row.sha256,
          byteSize: row.byteSize,
        });
        return this.result(tx, row);
      });
      transactionResolved = true;
      retained = result.id === id;
      return result;
    } catch (error) {
      // A business rejection is known to roll back. Unexpected transport/DB errors
      // can leave COMMIT in flight, even if a second connection sees no row yet.
      if (error instanceof AppError && error.statusCode >= 400 && error.statusCode < 500)
        transactionResolved = true;
      throw error;
    } finally {
      if (!retained) {
        // A connection failure can make the commit outcome unknown. Never delete
        // a referenced object; retain it if the database cannot confirm absence.
        try {
          if (!(await this.repository.objectReferenced(objectKey))) {
            if (!writeStarted || transactionResolved) await this.storage.remove(objectKey);
            else console.error("Contract orphan cleanup deferred");
          }
        } catch {
          console.error("Contract orphan cleanup deferred");
        }
      }
    }
  }
  private async readValid(row: ContractRow) {
    let bytes: Uint8Array;
    try {
      bytes = await this.storage.get(row.objectKey);
    } catch {
      throw new AppError(m.unavailable, 503, "CONTRACT_STORAGE_UNAVAILABLE");
    }
    if (bytes.length !== row.byteSize || contractHash(bytes) !== row.sha256)
      throw new ValidationError(m.invalidPdf);
    const info = await validateContractPdf(bytes);
    if (info.pageCount !== row.pageCount) throw new ValidationError(m.invalidPdf);
    return bytes;
  }
  async issue(actor: ContractActor, bookingId: string, id: string, input: ContractIssue) {
    const before = await this.repository.locked(bookingId, async (tx) => {
      await this.access(tx, actor, bookingId, true);
      const row = (await this.repository.list(bookingId, tx)).find((r) => r.id === id);
      if (!row) throw new NotFoundError(m.notFound);
      return row;
    });
    await this.readValid(before);
    return this.repository.locked(bookingId, async (tx) => {
      const context = await this.access(tx, actor, bookingId, true);
      const row = (await this.repository.list(bookingId, tx)).find((r) => r.id === id);
      if (!row || row.sha256 !== before.sha256) throw new ConflictError(m.conflict);
      if (row.status === "ISSUED") return this.result(tx, row);
      await this.mutable(tx, bookingId, context.booking.status);
      const current = await this.repository.current(bookingId, tx);
      if (
        (current?.id ?? null) !== input.expectedCurrentIssuedId ||
        (current && current.version > row.version)
      )
        throw new ConflictError(m.conflict);
      const terms = await this.terms(tx, bookingId);
      const issued = await this.repository.issue(tx, id, actor.id, terms);
      await this.repository.audit(tx, bookingId, id, actor.id, "CONTRACT_ISSUED", {
        previousCurrentId: current?.id ?? null,
        version: issued.version,
      });
      return this.result(tx, issued);
    });
  }
  async file(actor: ContractActor, bookingId: string, id: string) {
    const row = await this.repository.locked(bookingId, async (tx) => {
      await this.access(tx, actor, bookingId);
      const row = (await this.repository.list(bookingId, tx)).find((r) => r.id === id);
      if (!row || !this.visible(actor, row)) throw new NotFoundError(m.notFound);
      return row;
    });
    const bytes = await this.readValid(row);
    await this.repository.locked(bookingId, (tx) => this.access(tx, actor, bookingId));
    return { bytes, id };
  }
  async prepareHandover(actor: ContractActor, bookingId: string) {
    const row = await this.repository.locked(bookingId, async (tx) => {
      await this.access(tx, actor, bookingId);
      if (actor.role !== "FACILITY_STAFF") throw new ForbiddenError(m.forbidden);
      const row = await this.repository.current(bookingId, tx);
      if (!row?.termsSnapshot) throw new ConflictError(m.issuedRequired);
      return row;
    });
    await this.readValid(row);
    return row;
  }
  async bindHandover(
    tx: ContractTransaction,
    actor: ContractActor,
    bookingId: string,
    candidate?: ContractRow,
  ) {
    await this.access(tx, actor, bookingId);
    if (actor.role !== "FACILITY_STAFF" || !candidate) throw new ConflictError(m.issuedRequired);
    const row = await this.repository.current(bookingId, tx);
    if (!row?.termsSnapshot || row.id !== candidate.id || row.sha256 !== candidate.sha256)
      throw new ConflictError(m.issuedRequired);
    const currentTerms = await this.terms(tx, bookingId),
      terms = row.termsSnapshot;
    const keys = [
      "bookingId",
      "contactName",
      "contactEmail",
      "contactPhone",
      "facilityId",
      "unitTypeId",
      "requestedMonths",
      "checkInDate",
      "checkInSlotId",
      "rentalEndAt",
      "monthlyRate",
      "rentalFee",
      "deposit",
      "paymentId",
    ] as const;
    if (keys.some((key) => terms[key] !== currentTerms[key])) throw new ConflictError(m.conflict);
    await this.repository.audit(tx, bookingId, row.id, actor.id, "CONTRACT_USED_FOR_HANDOVER", {
      version: row.version,
    });
    return row.id;
  }
}
