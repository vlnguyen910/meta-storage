"use client";
import type {
  ConfigureReturnCalendar,
  ConfigureReturnChecklist,
  ReturnCalendarDto,
  ReturnChecklistVersionDto,
} from "@metastorage/contracts";
import {
  ConfigureReturnCalendarSchema,
  ConfigureReturnChecklistSchema,
  RETURN_CHECKLIST_GROUPS,
} from "@metastorage/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { api } from "@/lib/api";
import { F3 } from "./integration.messages";
import { f3Input, f3Panel, integrationError, minuteClock } from "./integration-utils";
import type { ReturnCalendarDraft } from "./return-policy-settings.types";
import { SystemSettingFields } from "./system-setting-fields";
import { useFlow3Identity } from "./use-flow3-identity";

export function ReturnPolicySettings() {
  const [tab, setTab] = useState<"checklist" | "calendar" | "reminders">("checklist");
  return (
    <div className="flex flex-col h-full w-full overflow-hidden min-h-0 gap-3.5">
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-['Space_Grotesk']">
            {F3.settings}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">{F3.settingsDescription}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["checklist", "calendar", "reminders"] as const).map((value) => (
            <Button
              key={value}
              variant={tab === value ? "primary" : "outline"}
              aria-pressed={tab === value}
              className="h-9 min-h-9 text-xs font-semibold"
              onClick={() => setTab(value)}
            >
              {F3[value]}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {tab === "checklist" ? (
          <ChecklistSettings />
        ) : tab === "calendar" ? (
          <CalendarSettings />
        ) : (
          <SystemSettingFields keys={["EXPIRY_REMINDER_DAYS", "ABANDONED_REVIEW_DAYS"]} />
        )}
      </div>
    </div>
  );
}

function ChecklistSettings() {
  const identity = useFlow3Identity();
  const query = useQuery({
    queryKey: ["return-policy", identity, "checklist"],
    queryFn: ({ signal }) => api.returnPolicy.checklist(signal),
  });
  if (query.isPending) return <LoadingState variant="form" />;
  if (query.isError)
    return <ErrorState message={integrationError(query.error)} onRetry={() => query.refetch()} />;
  return <ChecklistForm snapshot={query.data} />;
}
function ChecklistForm({ snapshot }: { snapshot: ReturnChecklistVersionDto | null }) {
  const client = useQueryClient();
  const form = useForm<ConfigureReturnChecklist>({
    defaultValues: {
      expectedVersion: snapshot?.version ?? 0,
      items:
        snapshot?.items ??
        RETURN_CHECKLIST_GROUPS.map((group) => ({ code: "", label: "", group, serious: false })),
    },
  });
  const items = useFieldArray({ control: form.control, name: "items" });
  const mutation = useMutation({
    meta: { globalLoading: true },
    mutationFn: async (values: ConfigureReturnChecklist) => {
      const parsed = ConfigureReturnChecklistSchema.safeParse({
        ...values,
        expectedVersion: snapshot?.version ?? 0,
      });
      if (!parsed.success) {
        form.setError("root", { message: F3.invalid });
        throw new Error("validation");
      }
      return api.returnPolicy.saveChecklist(parsed.data);
    },
    onSettled: () => client.invalidateQueries({ queryKey: ["return-policy"] }),
  });
  return (
    <form
      className={f3Panel}
      onSubmit={form.handleSubmit((values) => {
        form.clearErrors();
        mutation.mutate(values);
      })}
    >
      <h2 className="text-lg font-bold">
        {F3.checklist} · {F3.version(snapshot?.version ?? 0)}
      </h2>
      <p className="text-sm text-slate-600">{F3.checklistHelp}</p>
      {items.fields.map((field, index) => (
        <fieldset
          key={field.id}
          className="grid gap-3 rounded border border-slate-200 p-4 sm:grid-cols-2"
        >
          <legend className="px-1 font-bold">{index + 1}</legend>
          <label className="grid gap-2 text-sm font-semibold">
            {F3.code}
            <input
              className={f3Input}
              required
              maxLength={80}
              {...form.register(`items.${index}.code`)}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            {F3.label}
            <input
              className={f3Input}
              required
              maxLength={300}
              {...form.register(`items.${index}.label`)}
            />
          </label>
          <div className="grid gap-2 text-sm font-semibold">
            <span>{F3.group}</span>
            <DropdownSelect
              value={form.watch(`items.${index}.group`)}
              onChange={(val) =>
                form.setValue(
                  `items.${index}.group`,
                  val as (typeof RETURN_CHECKLIST_GROUPS)[number],
                )
              }
              className="w-full"
              triggerClassName="h-10 min-h-10 bg-white"
              options={RETURN_CHECKLIST_GROUPS.map((group) => ({
                value: group,
                label: F3.groups[group],
              }))}
            />
          </div>
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" {...form.register(`items.${index}.serious`)} />
            {F3.serious}
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={items.fields.length <= 4}
            onClick={() => items.remove(index)}
          >
            {F3.remove}
          </Button>
        </fieldset>
      ))}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={items.fields.length >= 100}
          onClick={() =>
            items.append({ code: "", label: "", group: "UNIT_CONDITION", serious: false })
          }
        >
          {F3.addItem}
        </Button>
        <Button loading={mutation.isPending} disabled={mutation.isPending}>
          {F3.save}
        </Button>
      </div>
      {(mutation.isError || form.formState.errors.root) && (
        <p role="alert" className="text-red-700">
          {form.formState.errors.root?.message ?? integrationError(mutation.error)}
        </p>
      )}
      {mutation.isSuccess && (
        <p role="status" className="text-emerald-800">
          {F3.saved}
        </p>
      )}
    </form>
  );
}

function CalendarSettings() {
  const identity = useFlow3Identity();
  const [facilityId, setFacilityId] = useState("");
  const facilities = useQuery({
    queryKey: ["return-policy", identity, "facilities"],
    queryFn: async () => {
      const rows = [];
      for (let offset = 0; ; offset += 100) {
        const page = await api.facilities.listActive({ limit: 100, offset });
        rows.push(...page);
        if (page.length < 100) return rows;
      }
    },
  });
  const calendar = useQuery({
    queryKey: ["return-policy", identity, "calendar", facilityId],
    queryFn: ({ signal }) => api.returnPolicy.calendar(facilityId, signal),
    enabled: Boolean(facilityId),
    retry: false,
  });
  const absent = isAxiosError(calendar.error) && calendar.error.response?.status === 404;
  return (
    <div className="space-y-4">
      <div className="grid gap-2 font-semibold text-sm">
        <span>{F3.facility}</span>
        <DropdownSelect
          value={facilityId}
          onChange={(val) => setFacilityId(val)}
          className="w-full sm:w-80"
          triggerClassName="h-10 min-h-10 bg-white"
          placeholder={F3.chooseFacility}
          options={[
            { value: "", label: F3.chooseFacility },
            ...(facilities.data?.map((facility) => ({
              value: facility.id,
              label: facility.name,
            })) ?? []),
          ]}
          maxVisibleItems={8}
        />
      </div>
      {facilities.isPending && <LoadingState variant="form" />}
      {facilities.isError && (
        <ErrorState
          message={integrationError(facilities.error)}
          onRetry={() => facilities.refetch()}
        />
      )}
      {facilityId &&
        (calendar.isPending ? (
          <LoadingState variant="form" />
        ) : calendar.isError && !absent ? (
          <ErrorState
            message={integrationError(calendar.error)}
            onRetry={() => calendar.refetch()}
          />
        ) : (
          <CalendarForm key={facilityId} facilityId={facilityId} snapshot={calendar.data ?? null} />
        ))}
    </div>
  );
}

function CalendarForm({
  facilityId,
  snapshot,
}: {
  facilityId: string;
  snapshot: ReturnCalendarDto | null;
}) {
  const client = useQueryClient();
  const [acknowledged, setAcknowledged] = useState(false);
  const form = useForm<ReturnCalendarDraft>({
    defaultValues: {
      timezone: snapshot?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      reminderTime: minuteClock(snapshot?.reminderTime ?? ""),
      holidays: snapshot?.holidays.join("\n") ?? "",
      hours: F3.days.map((_, index) => {
        const row = snapshot?.operatingHours.find((h) => h.dayOfWeek === index);
        return {
          active: Boolean(row),
          openTime: minuteClock(row?.openTime ?? ""),
          closeTime: minuteClock(row?.closeTime ?? ""),
        };
      }),
    },
  });
  const mutation = useMutation({
    meta: { globalLoading: true },
    mutationFn: async (values: ReturnCalendarDraft) => {
      const input: ConfigureReturnCalendar = {
        expectedVersion: snapshot?.version ?? 0,
        timezone: values.timezone,
        reminderTime: values.reminderTime,
        holidays: values.holidays
          .split(/\r?\n/)
          .map((v) => v.trim())
          .filter(Boolean),
        operatingHours: values.hours.flatMap((h, dayOfWeek) =>
          h.active ? [{ dayOfWeek, openTime: h.openTime, closeTime: h.closeTime }] : [],
        ),
      };
      const parsed = ConfigureReturnCalendarSchema.safeParse(input);
      if (!parsed.success) {
        form.setError("root", { message: F3.invalid });
        throw new Error("validation");
      }
      return api.returnPolicy.saveCalendar(facilityId, parsed.data);
    },
    onSuccess: () => setAcknowledged(false),
    onSettled: () => client.invalidateQueries({ queryKey: ["return-policy"] }),
  });
  return (
    <form
      className={f3Panel}
      onSubmit={form.handleSubmit((values) => {
        form.clearErrors();
        mutation.mutate(values);
      })}
    >
      <h2 className="font-bold text-lg">
        {F3.calendar} · {F3.version(snapshot?.version ?? 0)}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 font-semibold text-sm">
          {F3.timezone}
          <input className={f3Input} required {...form.register("timezone")} />
        </label>
        <label className="grid gap-2 font-semibold text-sm">
          {F3.reminderTime}
          <input className={f3Input} required type="time" {...form.register("reminderTime")} />
        </label>
      </div>
      <label className="grid gap-2 font-semibold text-sm">
        {F3.holidays}
        <textarea rows={4} className={f3Input} {...form.register("holidays")} />
      </label>
      <fieldset className="space-y-3">
        <legend className="font-bold">{F3.operatingHours}</legend>
        {F3.days.map((day, index) => (
          <div key={day} className="grid gap-3 sm:grid-cols-3 border-b border-slate-200 pb-3">
            <label className="flex min-h-11 gap-3 items-center">
              <input type="checkbox" {...form.register(`hours.${index}.active`)} />
              {day}
            </label>
            <label className="grid gap-1 text-sm">
              {F3.open}
              <input
                type="time"
                className={f3Input}
                disabled={!form.watch(`hours.${index}.active`)}
                {...form.register(`hours.${index}.openTime`)}
              />
            </label>
            <label className="grid gap-1 text-sm">
              {F3.shut}
              <input
                type="time"
                className={f3Input}
                disabled={!form.watch(`hours.${index}.active`)}
                {...form.register(`hours.${index}.closeTime`)}
              />
            </label>
          </div>
        ))}
      </fieldset>
      <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
        {F3.calendarWarning}
      </p>
      <label className="flex min-h-11 gap-3 items-center">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
        />
        {F3.confirmCalendar}
      </label>
      <Button disabled={!acknowledged || mutation.isPending} loading={mutation.isPending}>
        {F3.save}
      </Button>
      {(mutation.isError || form.formState.errors.root) && (
        <p role="alert" className="text-red-700">
          {form.formState.errors.root?.message ?? integrationError(mutation.error)}
        </p>
      )}
      {mutation.isSuccess && (
        <p role="status" className="text-emerald-800">
          {F3.saved}
        </p>
      )}
    </form>
  );
}
