import type { ReturnQueueItemDto, ReturnRequestDto } from "@metastorage/contracts";

export interface FacilityReturnQueueProps {
  actorRole: "FACILITY_MANAGER" | "FACILITY_STAFF";
}

export interface ReturnQueueRowProps {
  request: ReturnQueueItemDto;
  actorRole: "FACILITY_MANAGER" | "FACILITY_STAFF";
  assignedStaffName?: string | null;
  onOpenAssignModal?: (request: ReturnRequestDto) => void;
}

export interface ReturnStaffAssignModalProps {
  request: ReturnRequestDto;
  facilityId: string;
  assignedStaffName?: string | null;
  staffList: Array<{ id: string; name: string; isActive?: boolean }>;
  isLoadingStaff: boolean;
  isStaffError: boolean;
  onClose: () => void;
}
