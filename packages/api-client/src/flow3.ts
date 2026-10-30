import type {
  ApiEnvelope,
  ConfigureSystemSetting,
  LifecycleNotificationItem,
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
