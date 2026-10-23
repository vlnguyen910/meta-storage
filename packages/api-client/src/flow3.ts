import type {
  ApiEnvelope,
  ConfigureReturnCalendar,
  ConfigureReturnChecklist,
  ConfigureSystemSetting,
  ConfirmReturnRefund,
  ConfirmReturnRefundDto,
  ContractIssue,
  ContractUpload,
  GuestIssuedContractDto,
  GuestRentalPaymentItemDto,
  LifecycleNotificationItem,
  PrivateReturnPhotoDto,
  ProposeReturnTime,
  RentalDetail,
  RentalDocumentDto,
  RentalPaymentItem,
  ReturnCalendarDto,
  ReturnChecklistVersionDto,
  ReturnEvidenceInput,
  ReturnEvidencePhotoDto,
  ReturnInspectionDto,
  ReturnVersion,
  SaveReturnInspection,
  SystemSettingChangeDto,
  SystemSettingDto,
  SystemSettingKeyValue,
  SystemSettingUpdateResult,
} from "@metastorage/contracts";
import type { AxiosInstance } from "axios";
import type { RetryConfig } from "./types";

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
    guestRentals: {
      get: (code: string, signal?: AbortSignal) =>
        http
          .get<ApiEnvelope<RentalDetail>>(`/booking/tracking/${encodeURIComponent(code)}/rental`, {
            signal,
            skipAuthRefresh: true,
          } as RetryConfig)
          .then(unwrap),
      payments: (code: string, signal?: AbortSignal) =>
        http
          .get<ApiEnvelope<GuestRentalPaymentItemDto[]>>(
            `/booking/tracking/${encodeURIComponent(code)}/payments`,
            { signal, skipAuthRefresh: true } as RetryConfig,
          )
          .then(unwrap),
      contracts: (code: string, signal?: AbortSignal) =>
        http
          .get<ApiEnvelope<GuestIssuedContractDto[]>>(
            `/booking/tracking/${encodeURIComponent(code)}/contracts`,
            { signal, skipAuthRefresh: true } as RetryConfig,
          )
          .then(unwrap),
      pdf: (code: string, id: string, signal?: AbortSignal) =>
        http
          .get<Blob>(`/booking/tracking/${encodeURIComponent(code)}/contracts/${id}/pdf`, {
            responseType: "blob",
            signal,
            skipAuthRefresh: true,
          } as RetryConfig)
          .then((r) => r.data),
    },
    rentalDocuments: {
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
    returnActions: {
      property: (id: string, inspectionId: string, input: Omit<SaveReturnInspection, "results">) =>
        http
          .put<ApiEnvelope<ReturnInspectionDto>>(
            `/return-requests/${id}/inspections/${inspectionId}/property`,
            input,
          )
          .then(unwrap),
      photo: (id: string, inspectionId: string, photoId: string, signal?: AbortSignal) =>
        http
          .get<ApiEnvelope<PrivateReturnPhotoDto>>(
            `/return-requests/${id}/inspections/${inspectionId}/photos/${photoId}`,
            { signal },
          )
          .then(unwrap),
      evidence: (id: string, photoId: string, signal?: AbortSignal) =>
        http
          .get<ApiEnvelope<PrivateReturnPhotoDto>>(`/return-requests/${id}/evidence/${photoId}`, {
            signal,
          })
          .then(unwrap),
      uploadEvidence: (id: string, input: ReturnEvidenceInput) =>
        http
          .post<ApiEnvelope<ReturnEvidencePhotoDto>>(`/return-requests/${id}/evidence`, input)
          .then(unwrap),
      proposeTime: (id: string, input: ProposeReturnTime) =>
        http
          .post<ApiEnvelope<{ id: string; status: string }>>(
            `/return-requests/${id}/time-changes`,
            input,
          )
          .then(unwrap),
      decideTime: (
        id: string,
        changeId: string,
        input: ReturnVersion & { approve: boolean; reason: string },
      ) =>
        http
          .post<ApiEnvelope<{ id: string; status: string }>>(
            `/return-requests/${id}/time-changes/${changeId}/decision`,
            input,
          )
          .then(unwrap),
      confirmRefund: (id: string, input: ConfirmReturnRefund) =>
        http
          .post<ApiEnvelope<ConfirmReturnRefundDto>>(
            `/return-requests/${id}/refunds/confirm`,
            input,
          )
          .then(unwrap),
    },
    returnPolicy: {
      checklist: (signal?: AbortSignal) =>
        http
          .get<ApiEnvelope<ReturnChecklistVersionDto | null>>("/return-policy/checklist", {
            signal,
          })
          .then(unwrap),
      saveChecklist: (input: ConfigureReturnChecklist) =>
        http
          .put<ApiEnvelope<ReturnChecklistVersionDto>>("/return-policy/checklist", input)
          .then(unwrap),
      calendar: (id: string, signal?: AbortSignal) =>
        http
          .get<ApiEnvelope<ReturnCalendarDto>>(`/facilities/${id}/return-calendar`, { signal })
          .then(unwrap),
      saveCalendar: (id: string, input: ConfigureReturnCalendar) =>
        http
          .put<ApiEnvelope<Omit<ReturnCalendarDto, "operatingHours">>>(
            `/facilities/${id}/return-calendar`,
            input,
          )
          .then(unwrap),
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
