"use client";

import {
  ActivityLogAction,
  ActivityLogEntityType,
  type ActivityLogQuery,
  ActivityLogQuerySchema,
  UserRole,
} from "@metastorage/contracts";
import { formatReference } from "@metastorage/shared";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert, RefreshCw, RotateCcw, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { FieldShell, Input } from "@/components/ui/form-controls";
import { ListPagination } from "@/components/ui/list-pagination";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ACTIVITY_ACTION_LABELS,
  ACTIVITY_MODULE_LABELS,
  ADMIN_ROLE_LABELS,
  ADMIN_MESSAGES as M,
} from "@/features/administration/admin.messages";
import { api } from "@/lib/api";

const initialFilters = { search: "", role: "", action: "", entityType: "", from: "", to: "" };
const initialQuery: ActivityLogQuery = { limit: 20, offset: 0 };
const controlClass = "min-h-11 min-w-0 rounded-lg text-sm";
const dateFormat = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Ho_Chi_Minh",
});
const timeFormat = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "Asia/Ho_Chi_Minh",
});

function useActivityLogs() {
  const [params, setParams] = useState(initialQuery);
  const form = useForm({ defaultValues: initialFilters });
  const query = useQuery({
    queryKey: ["administration", "activity-logs", params],
    queryFn: ({ signal }) => api.activityLogs.list(params, signal),
  });
  useEffect(() => {
    if (!query.data) return;
    const lastOffset = Math.max(0, Math.ceil(query.data.total / params.limit) - 1) * params.limit;
    if (params.offset > lastOffset) setParams((current) => ({ ...current, offset: lastOffset }));
  }, [params.limit, params.offset, query.data]);
  const apply = form.handleSubmit((fields) => {
    const result = ActivityLogQuerySchema.safeParse({
      ...initialQuery,
      search: fields.search.trim() || undefined,
      role: fields.role || undefined,
      action: fields.action || undefined,
      entityType: fields.entityType || undefined,
      from: fields.from ? `${fields.from}T00:00:00+07:00` : undefined,
      to: fields.to ? `${fields.to}T23:59:59.999+07:00` : undefined,
    });
    if (!result.success) {
      form.setError("root", { message: M.activityLogs.invalidFilters });
      return;
    }
    setParams(result.data);
  });
  const reset = () => {
    form.reset(initialFilters);
    setParams(initialQuery);
  };
  return {
    form,
    query,
    params,
    apply,
    reset,
    setPage: (page: number) =>
      setParams((current) => ({ ...current, offset: (page - 1) * current.limit })),
  };
}

export function SystemAdministratorActivityLogsScreen() {
  const { form, query, params, apply, reset, setPage } = useActivityLogs();
  const data = query.data;
  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto [--radius-card:15px]">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="m-0 font-['Space_Grotesk'] text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">
            {M.titles.activityLogs}
          </h1>
          <p className="mb-0 mt-1 text-sm text-muted">{M.activityLogs.description}</p>
        </div>
        <Button
          variant="outline"
          className="rounded-lg text-sm"
          disabled={query.isFetching}
          onClick={() => query.refetch()}
          icon={<RefreshCw size={16} aria-hidden="true" />}
        >
          {M.activityLogs.refresh}
        </Button>
      </header>

      <form
        aria-label={M.activityLogs.filters}
        onSubmit={apply}
        className="flex shrink-0 flex-col gap-4 rounded-card border border-line bg-surface p-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FieldShell label={M.activityLogs.search}>
            <Input
              type="search"
              {...form.register("search")}
              maxLength={150}
              placeholder={M.userSearchPlaceholder}
              className={controlClass}
            />
          </FieldShell>
          <FieldShell label={M.activityLogs.role}>
            <DropdownSelect
              ariaLabel={M.activityLogs.role}
              value={form.watch("role") || ""}
              onChange={(val) => form.setValue("role", val, { shouldValidate: true })}
              options={[
                { value: "", label: M.allRoles },
                ...Object.values(UserRole).map((role) => ({
                  value: role,
                  label: ADMIN_ROLE_LABELS[role] ?? role,
                })),
              ]}
              className="w-full"
              triggerClassName={controlClass}
            />
          </FieldShell>
          <FieldShell label={M.actionFilter}>
            <DropdownSelect
              ariaLabel={M.actionFilter}
              value={form.watch("action") || ""}
              onChange={(val) => form.setValue("action", val, { shouldValidate: true })}
              options={[
                { value: "", label: M.allActions },
                ...Object.values(ActivityLogAction).map((action) => ({
                  value: action,
                  label: ACTIVITY_ACTION_LABELS[action] ?? action,
                })),
              ]}
              className="w-full"
              triggerClassName={controlClass}
            />
          </FieldShell>
          <FieldShell label={M.activityLogs.module}>
            <DropdownSelect
              ariaLabel={M.activityLogs.module}
              value={form.watch("entityType") || ""}
              onChange={(val) => form.setValue("entityType", val, { shouldValidate: true })}
              options={[
                { value: "", label: M.activityLogs.allModules },
                ...Object.values(ActivityLogEntityType).map((module) => ({
                  value: module,
                  label: ACTIVITY_MODULE_LABELS[module] ?? module,
                })),
              ]}
              className="w-full"
              triggerClassName={controlClass}
            />
          </FieldShell>
          <FieldShell label={M.activityLogs.from}>
            <Input type="date" {...form.register("from")} className={controlClass} />
          </FieldShell>
          <FieldShell label={M.activityLogs.to}>
            <Input type="date" {...form.register("to")} className={controlClass} />
          </FieldShell>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-3">
          {form.formState.errors.root ? (
            <p role="alert" className="m-0 text-xs font-medium text-danger">
              {form.formState.errors.root.message}
            </p>
          ) : (
            <span className="text-xs text-muted">{M.activityLogs.timezone}</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 min-h-10 rounded-lg px-3.5 text-xs font-semibold"
              onClick={reset}
              icon={<RotateCcw size={15} aria-hidden="true" />}
            >
              {M.clearFilters}
            </Button>
            <Button
              type="submit"
              className="h-10 min-h-10 rounded-lg px-4 text-xs font-semibold"
              icon={<Search size={15} aria-hidden="true" />}
            >
              {M.activityLogs.apply}
            </Button>
          </div>
        </div>
      </form>

      <section
        aria-label={M.titles.activityLogs}
        aria-busy={query.isFetching}
        className="flex min-h-[320px] shrink-0 flex-col overflow-hidden rounded-card border border-line bg-surface lg:flex-1"
      >
        <div className="min-h-0 flex-1 overflow-auto">
          {query.isPending ? (
            <LoadingState label={M.activityLogs.loading} variant="table" />
          ) : query.isError ? (
            <ErrorState message={M.activityLogs.error} onRetry={() => query.refetch()} />
          ) : !data?.items.length ? (
            <EmptyState title={M.activityLogs.empty} description={M.activityLogs.emptyHelp} />
          ) : (
            <Table
              tabIndex={0}
              className="min-w-[920px] focus-visible:outline-2 focus-visible:outline-primary"
            >
              <TableCaption className="sr-only">{M.titles.activityLogs}</TableCaption>
              <TableHeader className="bg-canvas">
                <TableRow>
                  {M.activityLogs.headings.map((heading) => (
                    <TableHead key={heading} scope="col">
                      {heading}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((log) => {
                  const failed = log.result === "FAILURE";
                  const ResultIcon = failed ? CircleAlert : CheckCircle2;
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="min-w-56">
                        <span className="block font-semibold text-ink">
                          {log.user?.name ??
                            (log.userId ? M.activityLogs.deletedUser : M.activityLogs.unknownUser)}
                        </span>
                        <span className="mt-1 block font-mono text-xs text-muted">
                          {log.user?.email ??
                            (log.userId ? formatReference(log.userId, "USR") : "—")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="bg-primary-soft py-1 text-primary hover:bg-primary-soft"
                        >
                          {ACTIVITY_ACTION_LABELS[log.action] ?? log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {ACTIVITY_MODULE_LABELS[log.entityType] ?? log.entityType}
                      </TableCell>
                      <TableCell className="min-w-64 max-w-96 whitespace-normal">
                        <p className="m-0 text-sm text-ink">{log.description}</p>
                        <Badge
                          variant="secondary"
                          className={`mt-1 gap-1 ${failed ? "bg-danger/10 text-ink hover:bg-danger/10" : "bg-accent-soft text-accent hover:bg-accent-soft"}`}
                        >
                          <ResultIcon size={12} aria-hidden="true" />
                          {failed ? M.failed : M.success}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        <time dateTime={log.createdAt}>
                          {dateFormat.format(new Date(log.createdAt))}
                          <span className="mt-1 block text-xs text-muted">
                            {timeFormat.format(new Date(log.createdAt))}
                          </span>
                        </time>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
        {data && !query.isError && (
          <ListPagination
            label={M.titles.activityLogs}
            page={Math.floor(params.offset / params.limit) + 1}
            pageSize={params.limit}
            total={data.total}
            onPageChange={setPage}
            pending={query.isFetching}
            unitLabel={M.activityLogs.unit}
            className="rounded-none border-0 border-t border-line shadow-none"
          />
        )}
      </section>
      <p className="m-0 shrink-0 text-xs text-muted">{M.activityLogs.timezone}</p>
    </div>
  );
}
