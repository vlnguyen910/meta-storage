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
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { Input } from "@/components/ui/form-controls";
import { ErrorState, LoadingState } from "@/components/ui/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { F3 } from "./integration.messages";
import { integrationError, minuteClock } from "./integration-utils";
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
      <div
        className={cn(
          "min-h-0",
          tab === "checklist"
            ? "flex-1 flex flex-col overflow-hidden"
            : "flex-1 overflow-y-auto pr-1",
        )}
      >
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
      className="flex flex-col flex-1 h-full w-full overflow-hidden min-h-0 gap-3"
      onSubmit={form.handleSubmit((values) => {
        form.clearErrors();
        mutation.mutate(values);
      })}
    >
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-card border border-line shadow-card">
        <div>
          <h2 className="text-base font-bold font-['Space_Grotesk'] text-slate-900 m-0">
            {F3.checklist} · {F3.version(snapshot?.version ?? 0)}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 m-0">{F3.checklistHelp}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-9 min-h-9 px-3 text-xs font-semibold gap-1.5"
            disabled={items.fields.length >= 100}
            onClick={() =>
              items.append({ code: "", label: "", group: "UNIT_CONDITION", serious: false })
            }
            icon={<Plus size={15} aria-hidden="true" />}
          >
            {F3.addItem}
          </Button>
          <Button
            type="submit"
            className="h-9 min-h-9 px-4 text-xs font-semibold"
            loading={mutation.isPending}
            disabled={mutation.isPending}
          >
            {F3.save}
          </Button>
        </div>
      </div>

      {(mutation.isError || form.formState.errors.root) && (
        <p
          role="alert"
          className="shrink-0 m-0 text-xs text-red-700 bg-red-50 p-2.5 rounded-lg border border-red-200"
        >
          {form.formState.errors.root?.message ?? integrationError(mutation.error)}
        </p>
      )}
      {mutation.isSuccess && (
        <p
          role="status"
          className="shrink-0 m-0 text-xs text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200"
        >
          {F3.saved}
        </p>
      )}

      <Card className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden rounded-card border-line bg-white shadow-card">
        <div className="flex-1 min-h-0 overflow-auto pb-16">
          <Table className="min-w-[760px] relative">
            <TableHeader className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs shadow-2xs">
              <TableRow>
                <TableHead className="w-14 text-center text-xs font-bold text-slate-600">
                  STT
                </TableHead>
                <TableHead className="w-1/4 text-xs font-bold text-slate-600">{F3.code}</TableHead>
                <TableHead className="w-2/5 text-xs font-bold text-slate-600">{F3.label}</TableHead>
                <TableHead className="w-1/4 text-xs font-bold text-slate-600">{F3.group}</TableHead>
                <TableHead className="w-32 text-center text-xs font-bold text-slate-600">
                  {F3.serious}
                </TableHead>
                <TableHead className="w-16 text-center text-xs font-bold text-slate-600"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.fields.map((field, index) => (
                <TableRow key={field.id} className="hover:bg-slate-50/60 transition-colors">
                  <TableCell className="text-center font-bold text-xs text-slate-500 py-2">
                    {index + 1}
                  </TableCell>
                  <TableCell className="py-2">
                    <Input
                      className="h-9 min-h-9 text-xs font-mono uppercase bg-canvas"
                      required
                      maxLength={80}
                      placeholder="VD: DEMO_CONDITION"
                      {...form.register(`items.${index}.code`)}
                    />
                  </TableCell>
                  <TableCell className="py-2">
                    <Input
                      className="h-9 min-h-9 text-xs bg-canvas"
                      required
                      maxLength={300}
                      placeholder="VD: Tình trạng ô kho..."
                      {...form.register(`items.${index}.label`)}
                    />
                  </TableCell>
                  <TableCell className="py-2">
                    <DropdownSelect
                      value={form.watch(`items.${index}.group`)}
                      onChange={(val) =>
                        form.setValue(
                          `items.${index}.group`,
                          val as (typeof RETURN_CHECKLIST_GROUPS)[number],
                        )
                      }
                      placement={index >= items.fields.length - 2 ? "top" : "bottom"}
                      className="w-full"
                      triggerClassName="h-9 min-h-9 text-xs bg-canvas border-line"
                      options={RETURN_CHECKLIST_GROUPS.map((group) => ({
                        value: group,
                        label: F3.groups[group],
                      }))}
                    />
                  </TableCell>
                  <TableCell className="text-center py-2">
                    <label className="inline-flex items-center justify-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-slate-300 text-primary cursor-pointer"
                        {...form.register(`items.${index}.serious`)}
                      />
                    </label>
                  </TableCell>
                  <TableCell className="text-center py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={items.fields.length <= 4}
                      onClick={() => items.remove(index)}
                      className="size-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30"
                      title={F3.remove}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
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
      className="space-y-3.5"
      onSubmit={form.handleSubmit((values) => {
        form.clearErrors();
        mutation.mutate(values);
      })}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-card border border-line shadow-card">
        <div>
          <h2 className="text-base font-bold font-['Space_Grotesk'] text-slate-900 m-0">
            {F3.calendar} · {F3.version(snapshot?.version ?? 0)}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 m-0">{F3.calendarDescription}</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
            <input
              type="checkbox"
              className="size-4 rounded border-slate-300 text-primary cursor-pointer"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
            />
            <span>{F3.confirmCalendar}</span>
          </label>
          <Button
            disabled={!acknowledged || mutation.isPending}
            loading={mutation.isPending}
            className="h-9 min-h-9 px-4 text-xs font-semibold"
          >
            {F3.save}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-3.5 bg-white rounded-card border border-line shadow-card space-y-3">
          <div className="grid gap-1 font-semibold text-xs">
            <label htmlFor="calendar-timezone">{F3.timezone}</label>
            <Input
              id="calendar-timezone"
              className="h-9 min-h-9 text-xs bg-canvas"
              required
              {...form.register("timezone")}
            />
          </div>
          <div className="grid gap-1 font-semibold text-xs">
            <label htmlFor="calendar-reminder-time">{F3.reminderTime}</label>
            <Input
              id="calendar-reminder-time"
              className="h-9 min-h-9 text-xs bg-canvas"
              required
              type="time"
              {...form.register("reminderTime")}
            />
          </div>
        </Card>
        <Card className="p-3.5 bg-white rounded-card border border-line shadow-card flex flex-col">
          <div className="grid gap-1 font-semibold text-xs flex-1">
            <label htmlFor="calendar-holidays">{F3.holidays}</label>
            <textarea
              id="calendar-holidays"
              rows={3}
              className="w-full flex-1 rounded-lg border border-line bg-canvas p-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="2026-01-01&#10;2026-04-30"
              {...form.register("holidays")}
            />
          </div>
        </Card>
      </div>

      <Card className="rounded-card border-line bg-white shadow-card overflow-hidden">
        <div className="p-3 border-b border-line bg-slate-50/70">
          <strong className="text-xs font-bold text-slate-700">{F3.operatingHours}</strong>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="w-1/3 text-xs font-bold text-slate-600">Ngày</TableHead>
                <TableHead className="w-1/3 text-xs font-bold text-slate-600">{F3.open}</TableHead>
                <TableHead className="w-1/3 text-xs font-bold text-slate-600">{F3.shut}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {F3.days.map((day, index) => {
                const active = form.watch(`hours.${index}.active`);
                return (
                  <TableRow key={day} className="hover:bg-slate-50/60 transition-colors">
                    <TableCell className="py-2">
                      <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold">
                        <input
                          type="checkbox"
                          className="size-4 rounded border-slate-300 text-primary cursor-pointer"
                          {...form.register(`hours.${index}.active`)}
                        />
                        <span className={active ? "text-slate-900 font-bold" : "text-slate-400"}>
                          {day}
                        </span>
                      </label>
                    </TableCell>
                    <TableCell className="py-2">
                      <Input
                        type="time"
                        className="h-8 min-h-8 text-xs w-36 bg-canvas"
                        disabled={!active}
                        {...form.register(`hours.${index}.openTime`)}
                      />
                    </TableCell>
                    <TableCell className="py-2">
                      <Input
                        type="time"
                        className="h-8 min-h-8 text-xs w-36 bg-canvas"
                        disabled={!active}
                        {...form.register(`hours.${index}.closeTime`)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <p className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-950 m-0">
        {F3.calendarWarning}
      </p>

      {(mutation.isError || form.formState.errors.root) && (
        <p
          role="alert"
          className="text-xs text-red-700 bg-red-50 p-2.5 rounded-lg border border-red-200 m-0"
        >
          {form.formState.errors.root?.message ?? integrationError(mutation.error)}
        </p>
      )}
      {mutation.isSuccess && (
        <p
          role="status"
          className="text-xs text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 m-0"
        >
          {F3.saved}
        </p>
      )}
    </form>
  );
}
