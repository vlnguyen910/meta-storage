import type { z } from "zod";
import type {
  StorageUnitMaintenanceTransitionSchema,
  StorageUnitTransitionActionSchema,
  UpdateStorageUnitStatusBodySchema,
} from "./storage-units";

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
