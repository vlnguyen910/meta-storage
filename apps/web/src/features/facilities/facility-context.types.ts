import type { ApiFacilityAssignment } from "@metastorage/contracts";

export interface FacilityContextState {
  assignments: ApiFacilityAssignment[];
  activeAssignments: ApiFacilityAssignment[];
  currentFacility: ApiFacilityAssignment | undefined;
  currentFacilityId: string;
  isSingleFacility: boolean;
  isMultiFacility: boolean;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  switchFacility: (facilityId: string) => void;
}
