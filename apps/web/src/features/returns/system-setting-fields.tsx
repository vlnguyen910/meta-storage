"use client";
import type { SystemSettingDto, SystemSettingKeyValue } from "@metastorage/contracts";
import { ConfigureSystemSettingSchema } from "@metastorage/contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { api } from "@/lib/api";
import { F3 } from "./integration.messages";
import { f3Input, f3Panel, integrationError } from "./integration-utils";
import { useFlow3Identity } from "./use-flow3-identity";

export function SystemSettingFields({ keys }: { keys: SystemSettingKeyValue[] }) {
  const identity = useFlow3Identity();
  const query = useQuery({
    queryKey: ["system-settings", identity],
    queryFn: ({ signal }) => api.systemSettings.list(signal),
  });
  if (query.isPending) return <LoadingState variant="form" />;
  if (query.isError)
    return <ErrorState message={integrationError(query.error)} onRetry={() => query.refetch()} />;
  return (
    <div className="space-y-4">
      {keys.map((key) => {
        const setting = query.data.find((s) => s.key === key);
        return setting ? (
          <SettingField key={key} setting={setting} />
        ) : (
          <p role="alert" key={key}>
            {F3.unavailable}
          </p>
        );
      })}
    </div>
  );
}

function SettingField({ setting }: { setting: SystemSettingDto }) {
  const identity = useFlow3Identity();
  const client = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);
  const form = useForm<{ value: number }>({ defaultValues: { value: Number(setting.value) } });
  const mutation = useMutation({
    meta: { globalLoading: true },
    mutationFn: async (values: { value: number }) => {
      const input = ConfigureSystemSettingSchema.safeParse({
        key: setting.key,
        value: values.value,
        expectedVersion: setting.version,
      });
      if (!input.success) {
        form.setError("value", { message: F3.invalid });
        throw new Error("validation");
      }
      return api.systemSettings.update(input.data);
    },
    onSettled: () => client.invalidateQueries({ queryKey: ["system-settings"] }),
  });
  const history = useInfiniteQuery({
    queryKey: ["system-settings", "history", identity, setting.key],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => api.systemSettings.history(setting.key, pageParam, signal),
    getNextPageParam: (last, pages) => (last.length === 20 ? pages.length * 20 : undefined),
    enabled: showHistory,
  });
  const label =
    setting.key === "OPENING_HOUR" || setting.key === "CLOSING_HOUR"
      ? setting.description
      : setting.key === "OVERDUE_FEE_RATE"
        ? F3.overdueRate
        : setting.key === "EXPIRY_REMINDER_DAYS"
          ? F3.expiryDays
          : F3.reviewDays;
  return (
    <section className={f3Panel}>
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => {
          form.clearErrors();
          mutation.mutate(values);
        })}
      >
        <label className="grid gap-2 font-semibold">
          {label}
          <input
            type="number"
            min={setting.key === "CLOSING_HOUR" ? 1 : 0}
            max={
              setting.key === "OPENING_HOUR"
                ? 23
                : setting.key === "CLOSING_HOUR"
                  ? 24
                  : setting.key === "OVERDUE_FEE_RATE"
                    ? 100
                    : 2147483647
            }
            step={1}
            required
            className={f3Input}
            {...form.register("value", { valueAsNumber: true, required: true })}
          />
        </label>
        <p className="text-sm text-slate-600">
          {setting.key === "OVERDUE_FEE_RATE" ? F3.rateHelp : setting.description}
        </p>
        <p className="text-xs text-slate-600">
          {F3.version(setting.version)} · {String(setting.value)}
        </p>
        <Button loading={mutation.isPending} disabled={mutation.isPending}>
          {F3.save}
        </Button>
        {(form.formState.errors.value || mutation.isError) && (
          <p role="alert" className="text-red-700">
            {form.formState.errors.value?.message ?? integrationError(mutation.error)}
          </p>
        )}
        {mutation.isSuccess && (
          <p role="status" className="text-emerald-800">
            {F3.saved}
          </p>
        )}
      </form>
      <Button
        type="button"
        variant="outline"
        aria-expanded={showHistory}
        onClick={() => setShowHistory((v) => !v)}
      >
        {F3.history}
      </Button>
      {showHistory && (
        <div className="space-y-3">
          {history.isPending ? (
            <LoadingState variant="table" />
          ) : history.isError ? (
            <ErrorState
              message={integrationError(history.error)}
              onRetry={() => history.refetch()}
            />
          ) : (
            <ul className="space-y-2">
              {!history.data.pages.flat().length && <li>{F3.noHistory}</li>}
              {history.data.pages.flat().map((entry) => (
                <li
                  key={entry.id}
                  className="rounded border border-slate-200 p-3 text-sm break-words"
                >
                  {String(entry.before.value)} → <strong>{String(entry.after.value)}</strong> ·{" "}
                  {new Date(entry.createdAt).toLocaleString("vi-VN")}
                  <p className="break-all text-xs text-slate-600">
                    {F3.actor}: {entry.actorId}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {history.hasNextPage && (
            <Button
              variant="outline"
              loading={history.isFetchingNextPage}
              onClick={() => void history.fetchNextPage()}
            >
              {F3.loadMore}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
