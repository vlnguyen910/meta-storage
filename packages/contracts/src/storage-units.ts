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

export const StorageUnitListQuerySchema = z.object({
  facilityId: z.string().uuid(),
  status: z.nativeEnum(StorageUnitStatus).optional(),
  unitTypeId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type StorageUnitListQuery = z.infer<typeof StorageUnitListQuerySchema>;

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

export const StorageUnitMaintenanceTransitionSchema = z.object({
  action: StorageUnitTransitionActionSchema,
});

export const UpdateStorageUnitStatusBodySchema = z.object({
  status: z.enum(["AVAILABLE", "MAINTENANCE"]),
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

export const CreateStorageUnitSchema = z
  .object({
    unitTypeId: z.string().uuid(),
    code: z.string().trim().min(1).max(80),
    floor: z.string().trim().max(50).nullable().optional(),
    locationDescription: z.string().trim().max(255).nullable().optional(),
  })
  .strict();
export const UpdateStorageUnitSchema = CreateStorageUnitSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
);
export const SetFacilityUnitTypeSchema = z
  .object({
    isActive: z.boolean(),
    expectedVersion: z.number().int().nonnegative().max(2147483646),
  })
  .strict();
export type CreateStorageUnitInput = z.infer<typeof CreateStorageUnitSchema>;
export type UpdateStorageUnitInput = z.infer<typeof UpdateStorageUnitSchema>;
export type SetFacilityUnitTypeInput = z.infer<typeof SetFacilityUnitTypeSchema>;
