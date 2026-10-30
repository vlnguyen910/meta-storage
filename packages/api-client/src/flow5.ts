import type {
  ApiEnvelope,
  ApiFacility,
  ApiFacilityAssignment,
  CreateAssignmentBody,
  CreateFacilityBody,
  CreateFacilityTaskInput,
  CreateStorageUnitInput,
  CreateUnitTypeInput,
  FacilityQuery,
  FacilityTaskDashboardSummary,
  FacilityTaskDetail,
  FacilityTaskListQuery,
  FacilityTaskListResult,
  FacilityUnitTypeDto,
  FacilityUnitTypeManagementItem,
  StaffFacilityTaskListQuery,
  StorageUnitDetail,
  StorageUnitListQuery,
  StorageUnitListResult,
  StorageUnitMaintenanceTransition,
  UnitTypeManagementQuery,
  UpdateFacilityBody,
  UpdateFacilityTaskInput,
  UpdateStorageUnitInput,
  UpdateUnitTypeInput,
} from "@metastorage/contracts";
import type { AxiosInstance } from "axios";
import type { Flow5AssignableAccount } from "./flow5.types";

const unwrap = <T>(response: { data: ApiEnvelope<T> }) => response.data.data;

export function createFlow5Client(http: AxiosInstance) {
  return {
    flow5: {
      accounts: (offset = 0, signal?: AbortSignal) =>
        http
          .get<ApiEnvelope<Flow5AssignableAccount[]>>("/users", {
            params: { limit: 100, offset },
            signal,
          })
          .then(unwrap),
      facilities: {
        list: (params: Partial<FacilityQuery> = {}, signal?: AbortSignal) =>
          http
            .get<ApiEnvelope<ApiFacility[]>>("/facilities/management", { params, signal })
            .then(unwrap),
        get: (id: string, signal?: AbortSignal) =>
          http.get<ApiEnvelope<ApiFacility>>(`/facilities/${id}`, { signal }).then(unwrap),
        create: (input: CreateFacilityBody) =>
          http.post<ApiEnvelope<ApiFacility>>("/facilities", input).then(unwrap),
        update: (id: string, input: UpdateFacilityBody) =>
          http.patch<ApiEnvelope<ApiFacility>>(`/facilities/${id}`, input).then(unwrap),
        offerings: (id: string, offset = 0, signal?: AbortSignal) =>
          http
            .get<ApiEnvelope<FacilityUnitTypeManagementItem[]>>(
              `/facilities/${id}/unit-types/management`,
              { params: { limit: 100, offset }, signal },
            )
            .then(unwrap),
        setOffering: (id: string, typeId: string, isActive: boolean) =>
          http
            .patch<ApiEnvelope<FacilityUnitTypeManagementItem>>(
              `/facilities/${id}/unit-types/${typeId}`,
              { isActive },
            )
            .then(unwrap),
        assignments: (id: string, offset = 0, signal?: AbortSignal) =>
          http
            .get<ApiEnvelope<ApiFacilityAssignment[]>>(`/facilities/${id}/assignments`, {
              params: { limit: 100, offset },
              signal,
            })
            .then(unwrap),
        assign: (id: string, input: CreateAssignmentBody) =>
          http
            .post<ApiEnvelope<ApiFacilityAssignment>>(`/facilities/${id}/assignments`, input)
            .then(unwrap),
        revoke: (id: string, userId: string) =>
          http
            .delete<ApiEnvelope<ApiFacilityAssignment>>(`/facilities/${id}/assignments/${userId}`)
            .then(unwrap),
      },
      unitTypes: {
        list: (params: Partial<UnitTypeManagementQuery> = {}, signal?: AbortSignal) =>
          http
            .get<ApiEnvelope<FacilityUnitTypeDto[]>>("/unit-types", { params, signal })
            .then(unwrap),
        create: (input: CreateUnitTypeInput) =>
          http.post<ApiEnvelope<FacilityUnitTypeDto>>("/unit-types", input).then(unwrap),
        update: (id: string, input: UpdateUnitTypeInput) =>
          http.patch<ApiEnvelope<FacilityUnitTypeDto>>(`/unit-types/${id}`, input).then(unwrap),
      },
      units: {
        list: (params: StorageUnitListQuery, signal?: AbortSignal) =>
          http
            .get<ApiEnvelope<StorageUnitListResult>>("/storage-units", { params, signal })
            .then(unwrap),
        get: (id: string, signal?: AbortSignal) =>
          http.get<ApiEnvelope<StorageUnitDetail>>(`/storage-units/${id}`, { signal }).then(unwrap),
        create: (facilityId: string, input: CreateStorageUnitInput) =>
          http
            .post<ApiEnvelope<StorageUnitDetail>>(`/facilities/${facilityId}/storage-units`, input)
            .then(unwrap),
        update: (id: string, input: UpdateStorageUnitInput) =>
          http.patch<ApiEnvelope<StorageUnitDetail>>(`/storage-units/${id}`, input).then(unwrap),
        transition: (id: string, input: StorageUnitMaintenanceTransition) =>
          http
            .post<ApiEnvelope<StorageUnitDetail>>(`/storage-units/${id}/transitions`, input)
            .then(unwrap),
      },
      tasks: {
        dashboardMine: (signal?: AbortSignal) =>
          http
            .get<ApiEnvelope<FacilityTaskDashboardSummary>>("/facility-tasks/dashboard/my", {
              signal,
            })
            .then(unwrap),
        listMine: (params: StaffFacilityTaskListQuery, signal?: AbortSignal) =>
          http
            .get<ApiEnvelope<FacilityTaskListResult>>("/facility-tasks/my", { params, signal })
            .then(unwrap),
        listFacility: (params: FacilityTaskListQuery, signal?: AbortSignal) =>
          http
            .get<ApiEnvelope<FacilityTaskListResult>>("/facility-tasks/facility", {
              params,
              signal,
            })
            .then(unwrap),
        create: (input: CreateFacilityTaskInput) =>
          http.post<ApiEnvelope<FacilityTaskDetail>>("/facility-tasks", input).then(unwrap),
        update: (id: string, input: UpdateFacilityTaskInput) =>
          http.patch<ApiEnvelope<FacilityTaskDetail>>(`/facility-tasks/${id}`, input).then(unwrap),
      },
    },
  };
}
