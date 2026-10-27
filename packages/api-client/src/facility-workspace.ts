import type {
  ApiEnvelope,
  FacilityRentalDetail,
  FacilitySupportQuery,
  FacilityWorkspaceQuery,
  FacilityWorkspaceRentalPage,
  SupportOperation,
  SupportOperationsDetail,
  SupportOperationsPage,
} from "@metastorage/contracts";
import type { AxiosInstance } from "axios";

const unwrap = <T>(response: { data: ApiEnvelope<T> }) => response.data.data;
export function createFacilityWorkspaceClient(http: AxiosInstance) {
  return {
    facilityWorkspace: {
      rentals: (params: Partial<FacilityWorkspaceQuery>, signal?: AbortSignal) =>
        http
          .get<ApiEnvelope<FacilityWorkspaceRentalPage>>("/facility-workspace/rentals", {
            params,
            signal,
          })
          .then(unwrap),
      rental: (id: string, signal?: AbortSignal) =>
        http
          .get<ApiEnvelope<FacilityRentalDetail>>(
            `/facility-workspace/rentals/${encodeURIComponent(id)}`,
            { signal },
          )
          .then(unwrap),
      tickets: (params: Partial<FacilitySupportQuery>, signal?: AbortSignal) =>
        http
          .get<ApiEnvelope<SupportOperationsPage>>("/facility-workspace/support", {
            params,
            signal,
          })
          .then(unwrap),
      ticket: (id: string, offset = 0, signal?: AbortSignal) =>
        http
          .get<ApiEnvelope<SupportOperationsDetail>>(
            `/facility-workspace/support/${encodeURIComponent(id)}`,
            { params: { limit: 20, offset }, signal },
          )
          .then(unwrap),
      ticketAction: (id: string, input: SupportOperation) =>
        http
          .post<ApiEnvelope<SupportOperationsDetail>>(
            `/facility-workspace/support/${encodeURIComponent(id)}/actions`,
            input,
          )
          .then(unwrap),
      ticketImage: (id: string, imageId: string, signal?: AbortSignal) =>
        http
          .get<ArrayBuffer>(
            `/facility-workspace/support/${encodeURIComponent(id)}/images/${encodeURIComponent(imageId)}`,
            { responseType: "arraybuffer", signal },
          )
          .then((response) => response.data),
    },
  };
}
