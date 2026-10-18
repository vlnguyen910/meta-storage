import { z } from "zod";
import { STORAGE_UNIT_MESSAGES } from "./storage-units.messages";
import type {
  StorageUnitTransitionContext,
  StorageUnitTransitionValidationResult,
} from "./storage-units.types";

export enum StorageUnitStatus {
  AVAILABLE = "AVAILABLE",
  RESERVED = "RESERVED",
  OCCUPIED = "OCCUPIED",
  MAINTENANCE = "MAINTENANCE",
  INSPECTION = "INSPECTION",
  RETURN_PENDING = "RETURN_PENDING",
  LOCKED = "LOCKED",
  INACTIVE = "INACTIVE",
}

export const UnitAvailabilityOptionSchema = z.object({
  facilityId: z.string(),
  unitTypeId: z.string(),
  unitType: z.string(),
  sizeLabel: z.string(),
  sizeSqm: z.number().positive(),
  monthlyPrice: z.number().nonnegative(),
  availableCount: z.number().int().nonnegative(),
});

export type UnitAvailabilityOption = z.infer<typeof UnitAvailabilityOptionSchema>;

export const EligibleUnitSchema = z.object({
  id: z.string().uuid(),
  facilityId: z.string().uuid(),
  unitTypeId: z.string().uuid(),
  code: z.string(),
  floor: z.string().nullable().optional(),
  locationDescription: z.string().nullable().optional(),
  status: z.string(),
  isAvailableForPeriod: z.boolean(),
});

export type EligibleUnit = z.infer<typeof EligibleUnitSchema>;

export const storageUnitIdParamSchema = z.object({
  id: z.string().uuid(),
});
export type StorageUnitIdParam = z.infer<typeof storageUnitIdParamSchema>;

export const StorageUnitResponseSchema = z.object({
  id: z.string().uuid(),
  facilityId: z.string().uuid(),
  unitTypeId: z.string().uuid(),
  code: z.string(),
  floor: z.string().nullable().optional(),
  locationDescription: z.string().nullable().optional(),
  status: z.nativeEnum(StorageUnitStatus),
  createdAt: z.union([z.date(), z.string()]),
  updatedAt: z.union([z.date(), z.string()]),
});
export type StorageUnitResponse = z.infer<typeof StorageUnitResponseSchema>;

export const StorageUnitTransitionActionSchema = z.enum(["ENTER_MAINTENANCE", "EXIT_MAINTENANCE"]);

export const StorageUnitMaintenanceTransitionSchema = z
  .object({
    action: StorageUnitTransitionActionSchema,
    reason: z.string().trim().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === "ENTER_MAINTENANCE") {
      if (!data.reason || data.reason.trim().length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: STORAGE_UNIT_MESSAGES.maintenanceReasonRequired,
          path: ["reason"],
        });
      }
    }
  });

export const UpdateStorageUnitStatusBodySchema = z
  .object({
    status: z.enum(["AVAILABLE", "MAINTENANCE"]),
    reason: z.string().trim().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === "MAINTENANCE") {
      if (!data.reason || data.reason.trim().length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: STORAGE_UNIT_MESSAGES.maintenanceReasonRequired,
          path: ["reason"],
        });
      }
    }
  });

export function canTransitionStorageUnitStatus(
  currentStatus: StorageUnitStatus | string,
  targetStatus: StorageUnitStatus | string,
  context?: StorageUnitTransitionContext,
): StorageUnitTransitionValidationResult {
  if (currentStatus === targetStatus) {
    if (targetStatus === StorageUnitStatus.MAINTENANCE) {
      return { allowed: false, error: STORAGE_UNIT_MESSAGES.unitAlreadyInMaintenance };
    }
    if (targetStatus === StorageUnitStatus.AVAILABLE) {
      return { allowed: false, error: STORAGE_UNIT_MESSAGES.unitAlreadyAvailable };
    }
    return {
      allowed: false,
      error: STORAGE_UNIT_MESSAGES.invalidStatusTransition(currentStatus, targetStatus),
    };
  }

  // Transitions to MAINTENANCE
  if (targetStatus === StorageUnitStatus.MAINTENANCE) {
    if (currentStatus === StorageUnitStatus.OCCUPIED) {
      return {
        allowed: false,
        error: STORAGE_UNIT_MESSAGES.cannotPutOccupiedUnitInMaintenance,
      };
    }
    if (currentStatus === StorageUnitStatus.RESERVED) {
      return {
        allowed: false,
        error: STORAGE_UNIT_MESSAGES.cannotPutReservedUnitInMaintenance,
      };
    }
    if (currentStatus === StorageUnitStatus.INACTIVE) {
      return {
        allowed: false,
        error: STORAGE_UNIT_MESSAGES.cannotPutInactiveUnitInMaintenance,
      };
    }
    if (context?.hasActiveRental) {
      return {
        allowed: false,
        error: STORAGE_UNIT_MESSAGES.unitHasActiveRental,
      };
    }
    if (context?.hasActiveAssignment) {
      return {
        allowed: false,
        error: STORAGE_UNIT_MESSAGES.unitHasActiveAssignment,
      };
    }
    if (
      currentStatus === StorageUnitStatus.AVAILABLE ||
      currentStatus === StorageUnitStatus.INSPECTION ||
      currentStatus === StorageUnitStatus.RETURN_PENDING
    ) {
      return { allowed: true };
    }
    return {
      allowed: false,
      error: STORAGE_UNIT_MESSAGES.invalidStatusTransition(currentStatus, targetStatus),
    };
  }

  // Transitions to AVAILABLE
  if (targetStatus === StorageUnitStatus.AVAILABLE) {
    if (currentStatus === StorageUnitStatus.MAINTENANCE) {
      return { allowed: true };
    }
    if (
      currentStatus === StorageUnitStatus.INSPECTION ||
      currentStatus === StorageUnitStatus.RETURN_PENDING
    ) {
      return { allowed: true };
    }
    return {
      allowed: false,
      error: STORAGE_UNIT_MESSAGES.invalidStatusTransition(currentStatus, targetStatus),
    };
  }

  return {
    allowed: false,
    error: STORAGE_UNIT_MESSAGES.invalidStatusTransition(currentStatus, targetStatus),
  };
}

export * from "./storage-units.types";
