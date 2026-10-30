import type {
  ApiEnvelope,
  FacilitySupportQuery,
  SupportOperation,
  SupportOperationsDetail,
  SupportOperationsPage,
} from "@metastorage/contracts";
import type { AxiosInstance } from "axios";

const unwrap = <T>(response: { data: ApiEnvelope<T> }) => response.data.data;
export function createFacilityWorkspaceClient(http: AxiosInstance) {
  return {
    facilityWorkspace: {
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
