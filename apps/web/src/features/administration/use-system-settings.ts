import type {
  ConfigureSystemSetting,
  OperationalSettingsDto,
  SystemSettingChangeDto,
  SystemSettingDto,
  SystemSettingKeyValue,
} from "@metastorage/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useOperationalSettings() {
  return useQuery<OperationalSettingsDto>({
    queryKey: ["operational-settings"],
    queryFn: () => api.systemSettings.operational(),
    staleTime: 30_000,
  });
}

export function useSystemSettings() {
  return useQuery<SystemSettingDto[]>({
    queryKey: ["system-settings"],
    queryFn: () => api.systemSettings.list(),
  });
}

export function useUpdateSystemSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ConfigureSystemSetting) => api.systemSettings.update(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["system-settings"] }),
        queryClient.invalidateQueries({ queryKey: ["operational-settings"] }),
      ]);
    },
  });
}

export function useSystemSettingHistory(key: SystemSettingKeyValue | null) {
  return useQuery<SystemSettingChangeDto[]>({
    queryKey: ["system-settings", key, "history"],
    queryFn: () => (key ? api.systemSettings.history(key) : Promise.resolve([])),
    enabled: Boolean(key),
  });
}
