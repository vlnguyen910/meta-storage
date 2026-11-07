import type { ApiFacilityAssignment } from "@metastorage/contracts";

export interface FacilitySwitcherProps {
  activeAssignments: ApiFacilityAssignment[];
  currentFacilityId: string;
  onSwitchFacility: (facilityId: string) => void;
  className?: string;
}
