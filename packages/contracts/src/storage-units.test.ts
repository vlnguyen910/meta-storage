import { describe, expect, it } from "vitest";
import {
  canTransitionStorageUnitStatus,
  STORAGE_UNIT_MESSAGES,
  StorageUnitMaintenanceTransitionSchema,
  StorageUnitStatus,
  UpdateStorageUnitStatusBodySchema,
} from "./index";

describe("Storage Unit Maintenance & Status Transitions (Open Decision F4)", () => {
  describe("canTransitionStorageUnitStatus", () => {
    it("allows AVAILABLE to transition to MAINTENANCE when no active rental or assignment exists", () => {
      const result = canTransitionStorageUnitStatus(
        StorageUnitStatus.AVAILABLE,
        StorageUnitStatus.MAINTENANCE,
        { hasActiveAssignment: false, hasActiveRental: false },
      );
      expect(result.allowed).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("rejects AVAILABLE to MAINTENANCE when unit has active rental conflict", () => {
      const result = canTransitionStorageUnitStatus(
        StorageUnitStatus.AVAILABLE,
        StorageUnitStatus.MAINTENANCE,
        { hasActiveRental: true },
      );
      expect(result.allowed).toBe(false);
      expect(result.error).toBe(STORAGE_UNIT_MESSAGES.unitHasActiveRental);
    });

    it("rejects AVAILABLE to MAINTENANCE when unit has active booking assignment", () => {
      const result = canTransitionStorageUnitStatus(
        StorageUnitStatus.AVAILABLE,
        StorageUnitStatus.MAINTENANCE,
        { hasActiveAssignment: true },
      );
      expect(result.allowed).toBe(false);
      expect(result.error).toBe(STORAGE_UNIT_MESSAGES.unitHasActiveAssignment);
    });

    it("allows MAINTENANCE to transition to AVAILABLE upon completion of repair/cleaning", () => {
      const result = canTransitionStorageUnitStatus(
        StorageUnitStatus.MAINTENANCE,
        StorageUnitStatus.AVAILABLE,
      );
      expect(result.allowed).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("strictly blocks direct OCCUPIED to MAINTENANCE transition to protect active rentals", () => {
      const result = canTransitionStorageUnitStatus(
        StorageUnitStatus.OCCUPIED,
        StorageUnitStatus.MAINTENANCE,
      );
      expect(result.allowed).toBe(false);
      expect(result.error).toBe(STORAGE_UNIT_MESSAGES.cannotPutOccupiedUnitInMaintenance);
    });

    it("strictly blocks direct RESERVED to MAINTENANCE transition to protect assigned bookings", () => {
      const result = canTransitionStorageUnitStatus(
        StorageUnitStatus.RESERVED,
        StorageUnitStatus.MAINTENANCE,
      );
      expect(result.allowed).toBe(false);
      expect(result.error).toBe(STORAGE_UNIT_MESSAGES.cannotPutReservedUnitInMaintenance);
    });

    it("rejects INACTIVE units from transitioning into MAINTENANCE", () => {
      const result = canTransitionStorageUnitStatus(
        StorageUnitStatus.INACTIVE,
        StorageUnitStatus.MAINTENANCE,
      );
      expect(result.allowed).toBe(false);
      expect(result.error).toBe(STORAGE_UNIT_MESSAGES.cannotPutInactiveUnitInMaintenance);
    });

    it("allows INSPECTION to transition to MAINTENANCE when damage is found upon return", () => {
      const result = canTransitionStorageUnitStatus(
        StorageUnitStatus.INSPECTION,
        StorageUnitStatus.MAINTENANCE,
      );
      expect(result.allowed).toBe(true);
    });

    it("allows INSPECTION to transition to AVAILABLE when unit passes inspection", () => {
      const result = canTransitionStorageUnitStatus(
        StorageUnitStatus.INSPECTION,
        StorageUnitStatus.AVAILABLE,
      );
      expect(result.allowed).toBe(true);
    });

    it("rejects transitioning to the identical status", () => {
      const maintToMaint = canTransitionStorageUnitStatus(
        StorageUnitStatus.MAINTENANCE,
        StorageUnitStatus.MAINTENANCE,
      );
      expect(maintToMaint.allowed).toBe(false);
      expect(maintToMaint.error).toBe(STORAGE_UNIT_MESSAGES.unitAlreadyInMaintenance);

      const availToAvail = canTransitionStorageUnitStatus(
        StorageUnitStatus.AVAILABLE,
        StorageUnitStatus.AVAILABLE,
      );
      expect(availToAvail.allowed).toBe(false);
      expect(availToAvail.error).toBe(STORAGE_UNIT_MESSAGES.unitAlreadyAvailable);
    });

    it("rejects illegal bypass transitions such as OCCUPIED directly to AVAILABLE", () => {
      const result = canTransitionStorageUnitStatus(
        StorageUnitStatus.OCCUPIED,
        StorageUnitStatus.AVAILABLE,
      );
      expect(result.allowed).toBe(false);
      expect(result.error).toBe(
        STORAGE_UNIT_MESSAGES.invalidStatusTransition(
          StorageUnitStatus.OCCUPIED,
          StorageUnitStatus.AVAILABLE,
        ),
      );
    });
  });

  describe("StorageUnitMaintenanceTransitionSchema & UpdateStorageUnitStatusBodySchema", () => {
    it("validates successful ENTER_MAINTENANCE payload with mandatory reason", () => {
      const validPayload = {
        action: "ENTER_MAINTENANCE",
        reason: "Bảo dưỡng hệ thống khóa cửa và kiểm tra chống ẩm",
      };
      const parsed = StorageUnitMaintenanceTransitionSchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);
    });

    it("fails ENTER_MAINTENANCE when reason is missing or shorter than 3 characters", () => {
      const missingReason = { action: "ENTER_MAINTENANCE" };
      const parsedMissing = StorageUnitMaintenanceTransitionSchema.safeParse(missingReason);
      expect(parsedMissing.success).toBe(false);

      const shortReason = { action: "ENTER_MAINTENANCE", reason: "ok" };
      const parsedShort = StorageUnitMaintenanceTransitionSchema.safeParse(shortReason);
      expect(parsedShort.success).toBe(false);
    });

    it("validates EXIT_MAINTENANCE without requiring a reason", () => {
      const validPayload = { action: "EXIT_MAINTENANCE" };
      const parsed = StorageUnitMaintenanceTransitionSchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);
    });

    it("validates UpdateStorageUnitStatusBodySchema for MAINTENANCE and AVAILABLE", () => {
      const maintValid = UpdateStorageUnitStatusBodySchema.safeParse({
        status: "MAINTENANCE",
        reason: "Sơn sửa và thay gioăng cao su cửa",
      });
      expect(maintValid.success).toBe(true);

      const maintNoReason = UpdateStorageUnitStatusBodySchema.safeParse({
        status: "MAINTENANCE",
      });
      expect(maintNoReason.success).toBe(false);

      const availValid = UpdateStorageUnitStatusBodySchema.safeParse({
        status: "AVAILABLE",
      });
      expect(availValid.success).toBe(true);
    });
  });
});
