import type {
  ApiEnvelope,
  ConfigureSystemSetting,
  ContractIssue,
  ContractUpload,
  LifecycleNotificationItem,
  RentalDocumentDto,
  RentalPaymentItem,
  SystemSettingChangeDto,
  SystemSettingDto,
  SystemSettingKeyValue,
  SystemSettingUpdateResult,
} from "@metastorage/contracts";
import type { AxiosInstance } from "axios";

const unwrap = <T>(response: { data: ApiEnvelope<T> }) => response.data.data;

export function createFlow3Client(http: AxiosInstance) {
  return {
    rentalPayments: (id: string, signal?: AbortSignal) =>
      http
        .get<ApiEnvelope<RentalPaymentItem[]>>(`/rentals/${id}/payments`, { signal })
        .then(unwrap),
    inbox: (offset = 0, signal?: AbortSignal) =>
      http
        .get<ApiEnvelope<LifecycleNotificationItem[]>>("/notifications", {
          params: { limit: 20, offset },
          signal,
        })
        .then(unwrap),
    rentalDocuments: {
      pdfBytes: (bookingId: string, id: string, signal?: AbortSignal) =>
        http
          .get<ArrayBuffer>(`/bookings/${bookingId}/contracts/${id}/pdf`, {
            responseType: "arraybuffer",
            signal,
          })
          .then((r) => r.data),
      list: (bookingId: string, signal?: AbortSignal) =>
        http
          .get<ApiEnvelope<RentalDocumentDto[]>>(`/bookings/${bookingId}/contracts`, { signal })
          .then(unwrap),
      rental: (id: string, signal?: AbortSignal) =>
        http
          .get<ApiEnvelope<RentalDocumentDto[]>>(`/rentals/${id}/contracts`, { signal })
          .then(unwrap),
      upload: (id: string, input: ContractUpload) =>
        http
          .post<ApiEnvelope<RentalDocumentDto>>(`/bookings/${id}/contracts`, input, {
            timeout: 60000,
          })
          .then(unwrap),
      issue: (bookingId: string, id: string, input: ContractIssue) =>
        http
          .post<ApiEnvelope<RentalDocumentDto>>(
            `/bookings/${bookingId}/contracts/${id}/issue`,
            input,
          )
          .then(unwrap),
      pdf: (bookingId: string, id: string, signal?: AbortSignal) =>
        http
          .get<Blob>(`/bookings/${bookingId}/contracts/${id}/pdf`, { responseType: "blob", signal })
          .then((r) => r.data),
    },
    systemSettings: {
      list: (signal?: AbortSignal) =>
        http.get<ApiEnvelope<SystemSettingDto[]>>("/system-settings", { signal }).then(unwrap),
      update: (input: ConfigureSystemSetting) =>
        http.put<ApiEnvelope<SystemSettingUpdateResult>>("/system-settings", input).then(unwrap),
      history: (key: SystemSettingKeyValue, offset = 0, signal?: AbortSignal) =>
        http
          .get<ApiEnvelope<SystemSettingChangeDto[]>>(`/system-settings/${key}/history`, {
            params: { limit: 20, offset },
            signal,
          })
          .then(unwrap),
    },
  };
}
