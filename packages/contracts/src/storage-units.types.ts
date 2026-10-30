import type { z } from "zod";
import type {
  StorageUnitMaintenanceTransitionSchema,
  StorageUnitStatus,
  StorageUnitTransitionActionSchema,
  UpdateStorageUnitStatusBodySchema,
} from "./storage-units";

export interface StorageUnitDetail {
  id: string;
  facilityId: string;
  unitTypeId: string;
  code: string;
  floor: string | null;
  locationDescription: string | null;
  status: `${StorageUnitStatus}`;
  createdAt: string;
  updatedAt: string;
}

export interface StorageUnitListItem extends StorageUnitDetail {
  unitTypeName: string;
  unitTypeSizeLabel: string;
}

export interface StorageUnitListResult {
  items: StorageUnitListItem[];
  total: number;
  limit: number;
  offset: number;
}

export type StorageUnitTransitionAction = z.infer<typeof StorageUnitTransitionActionSchema>;
export type StorageUnitMaintenanceTransition = z.infer<
  typeof StorageUnitMaintenanceTransitionSchema
>;
export type UpdateStorageUnitStatusBody = z.infer<typeof UpdateStorageUnitStatusBodySchema>;

export interface StorageUnitTransitionContext {
  hasActiveAssignment?: boolean;
  hasActiveRental?: boolean;
}

export interface StorageUnitTransitionValidationResult {
  allowed: boolean;
  error?: string;
}
