import type { FacilityTaskStatus } from "@metastorage/contracts";
import type { ReactElement, ReactNode } from "react";

export interface FacilityOption {
  id: string;
  name: string;
  code: string;
}
export interface Flow5ScopeProps {
  global?: boolean;
}
export interface FacilityPanelProps {
  facilityId: string;
}
export interface InventoryPanelProps extends FacilityPanelProps {
  canEdit: boolean;
  facilityOptions?: Array<{ id: string; name: string; code: string }>;
  onSelectFacility?: (id: string) => void;
}
export interface TaskPanelProps extends FacilityPanelProps {
  manager: boolean;
  status?: FacilityTaskStatus;
}
export interface ManagementFieldProps {
  label: string;
  error?: string;
  children: ReactElement;
}
export interface ManagementDialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  pending?: boolean;
  wide?: boolean;
}
export interface PageControlsProps {
  label: string;
  offset: number;
  count: number;
  total: number;
  onChange: (offset: number) => void;
  pending?: boolean;
}
export interface ManagementWorkspaceProps {
  membershipsOnly?: boolean;
}
