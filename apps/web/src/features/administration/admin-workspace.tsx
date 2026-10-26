"use client";

import { UserRole } from "@metastorage/contracts";
import { Download, RotateCcw, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { Input } from "@/components/ui/form-controls";
import { ListPagination } from "@/components/ui/list-pagination";
import { LoadingState } from "@/components/ui/states";
import { useAuthStore } from "@/features/auth/auth-store";
import { formatDateTime } from "@/lib/format";
import {
  accessLabel,
  downloadCsv,
  isFacilityRole,
  matchesDate,
  matchesSearch,
} from "./admin.helpers";
import { ADMIN_ROLE_LABELS, ADMIN_MESSAGES as M } from "./admin.messages";
import type {
  AdminAudit,
  AdminFilters,
  AdminLogin,
  AdminUser,
  AdminWorkspaceProps,
} from "./admin.types";
import { AdminEditor } from "./admin-editor";
import { AdminBadge, AdminDrawer, AdminSnapshotView, AdminTable, adminCard } from "./admin-parts";
import { useAdminData } from "./use-admin-data";

const initialFilters: AdminFilters = {
  search: "",
  role: "",
  status: "",
  facilityId: "",
  outcome: "",
  action: "",
  date: "",
};
const codes = {
  users: "SA02",
  assignments: "SA03",
  "login-history": "SA04",
  "activity-logs": "SA05",
};

export function AdminWorkspace({ section }: Readonly<AdminWorkspaceProps>) {
  const query = useAdminData();
  const actor = useAuthStore((state) => state.session?.user.name) ?? M.role;
  const [filters, setFilters] = useState(initialFilters);
  const [searchInput, setSearchInput] = useState(initialFilters.search);
  const [pagination, setPagination] = useState({ section, page: 1 });
  const [editor, setEditor] = useState<AdminUser | null>(null);
  const [userDetail, setUserDetail] = useState<AdminUser | null>(null);
  const [loginDetail, setLoginDetail] = useState<AdminLogin | null>(null);
  const [auditDetail, setAuditDetail] = useState<AdminAudit | null>(null);
  const [notice, setNotice] = useState("");
  const filter = (key: keyof AdminFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPagination({ section, page: 1 });
  };
  const handleSearchSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    filter("search", searchInput.trim());
  };
  if (query.isLoading) return <LoadingState label={M.loading} variant="table" />;
  if (!query.data || query.isError)
    return (
      <section className={adminCard}>
        <p role="alert">{M.error}</p>
        <Button onClick={() => query.refetch()}>{M.reset}</Button>
      </section>
    );
  const data = query.data;
  const users = data.users.filter(
    (user) =>
      (section !== "assignments" || isFacilityRole(user.role)) &&
      matchesSearch([user.id, user.name, user.email], filters.search) &&
      (!filters.role || user.role === filters.role) &&
      (!filters.status || user.status === filters.status) &&
      (!filters.facilityId || user.facilityIds.includes(filters.facilityId)),
  );
  const logins = data.logins.filter(
    (entry) =>
      matchesSearch([entry.id, entry.name, entry.email], filters.search) &&
      (!filters.role || entry.role === filters.role) &&
      (!filters.outcome || entry.outcome === filters.outcome) &&
      matchesDate(entry.at, filters.date),
  );
  const audits = data.audits.filter(
    (entry) =>
      matchesSearch([entry.id, entry.actor, entry.target, entry.targetId], filters.search) &&
      (!filters.action || entry.action === filters.action) &&
      (!filters.outcome || entry.outcome === filters.outcome) &&
      (!filters.facilityId || entry.facilityIds.includes(filters.facilityId)) &&
      matchesDate(entry.at, filters.date),
  );
  const accounts = section === "users" || section === "assignments";
  const login = section === "login-history";
  const headings = accounts
    ? section === "users"
      ? M.userHeadings
      : M.assignmentHeadings
    : login
      ? M.loginHeadings
      : M.auditHeadings;
  const count = accounts ? users.length : login ? logins.length : audits.length;
  const pageSize = 10;
  const page = Math.min(
    pagination.section === section ? pagination.page : 1,
    Math.max(1, Math.ceil(count / pageSize)),
  );
  const start = (page - 1) * pageSize;
  const exportRows = () => {
    if (accounts)
      downloadCsv(
        section,
        [M.account, M.email, M.roleFilter, M.statusFilter, M.assignedFacilities, M.lastLogin],
        users.map((user) => [
          user.name,
          user.email,
          ADMIN_ROLE_LABELS[user.role],
          user.status === "ACTIVE" ? M.active : M.inactive,
          accessLabel(user, data.facilities),
          formatDateTime(user.lastLoginAt),
        ]),
      );
    else if (login)
      downloadCsv(
        section,
        M.loginHeadings.slice(0, -1),
        logins.map((entry) => [
          formatDateTime(entry.at),
          entry.email,
          ADMIN_ROLE_LABELS[entry.role],
          entry.ipMasked,
          entry.device,
          entry.outcome === "SUCCESS" ? M.success : M.failed,
        ]),
      );
    else
      downloadCsv(
        section,
        M.auditHeadings.slice(0, -1),
        audits.map((entry) => [
          formatDateTime(entry.at),
          entry.actor,
          entry.target,
          M.actions[entry.action],
          entry.facilityIds
            .map((id) => data.facilities.find((facility) => facility.id === id)?.name ?? id)
            .join(", ") || M.none,
          entry.outcome === "SUCCESS" ? M.success : M.failed,
        ]),
      );
  };
  return (
    <div className="flex flex-col h-full w-full overflow-hidden min-h-0 gap-3.5">
      <header className="shrink-0">
        <p className="mb-1 mt-0 text-xs font-semibold text-primary">
          {M.role} / {codes[section]}
        </p>
        <h1 className="m-0 font-['Space_Grotesk'] text-2xl font-bold tracking-tight sm:text-[28px]">
          {M.titles[section]}
        </h1>
        <p className="mb-0 mt-0.5 text-xs text-slate-600">{M.descriptions[section]}</p>
      </header>
      {section === "assignments" && (
        <p className="shrink-0 m-0 text-xs text-slate-600">{M.facilityHelp}</p>
      )}
      {!accounts && (
        <p className="shrink-0 m-0 text-xs text-slate-600">
          {M.readonlyLog} {M.privacy}
        </p>
      )}
      <section
        aria-label={section === "activity-logs" ? M.auditSearch : M.search}
        className="shrink-0 flex flex-wrap items-center gap-2.5 rounded-card border border-line bg-white p-2.5 shadow-card"
      >
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-1.5 min-w-64 flex-1">
          <div className="relative flex-1">
            <Search
              aria-hidden="true"
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <Input
              type="search"
              value={searchInput}
              placeholder={section === "activity-logs" ? M.auditSearch : M.search}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleSearchSubmit();
              }}
              className="h-9 min-h-9 rounded-lg border-line bg-canvas pl-9 text-xs shadow-2xs"
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            className="h-9 min-h-9 px-3 text-xs font-semibold shrink-0"
          >
            {M.searchConfirm}
          </Button>
        </form>

        {(accounts || login) && (
          <DropdownSelect
            value={filters.role}
            onChange={(val) => filter("role", val)}
            className="w-40"
            triggerClassName="h-9 min-h-9 text-xs bg-white border-line"
            placeholder={M.roleFilter}
            options={[
              { value: "", label: M.allRoles },
              ...Object.values(UserRole)
                .filter((role) => section !== "assignments" || isFacilityRole(role))
                .map((role) => ({
                  value: role,
                  label: ADMIN_ROLE_LABELS[role],
                })),
            ]}
            maxVisibleItems={6}
          />
        )}

        {accounts && (
          <DropdownSelect
            value={filters.status}
            onChange={(val) => filter("status", val)}
            className="w-36"
            triggerClassName="h-9 min-h-9 text-xs bg-white border-line"
            placeholder={M.statusFilter}
            options={[
              { value: "", label: M.allStatuses },
              { value: "ACTIVE", label: M.active },
              { value: "INACTIVE", label: M.inactive },
            ]}
            maxVisibleItems={6}
          />
        )}

        {(accounts || section === "activity-logs") && (
          <DropdownSelect
            value={filters.facilityId}
            onChange={(val) => filter("facilityId", val)}
            className="w-44"
            triggerClassName="h-9 min-h-9 text-xs bg-white border-line"
            placeholder={M.facilityFilter}
            options={[
              { value: "", label: M.allFacilities },
              ...data.facilities.map((facility) => ({
                value: facility.id,
                label: facility.name,
              })),
            ]}
            maxVisibleItems={6}
          />
        )}

        {section === "activity-logs" && (
          <DropdownSelect
            value={filters.action}
            onChange={(val) => filter("action", val)}
            className="w-44"
            triggerClassName="h-9 min-h-9 text-xs bg-white border-line"
            placeholder={M.actionFilter}
            options={[
              { value: "", label: M.all },
              ...Object.entries(M.actions).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
            maxVisibleItems={6}
          />
        )}

        {!accounts && (
          <DropdownSelect
            value={filters.outcome}
            onChange={(val) => filter("outcome", val)}
            className="w-36"
            triggerClassName="h-9 min-h-9 text-xs bg-white border-line"
            placeholder={M.outcomeFilter}
            options={[
              { value: "", label: M.all },
              { value: "SUCCESS", label: M.success },
              { value: "FAILED", label: M.failed },
            ]}
            maxVisibleItems={6}
          />
        )}

        {!accounts && (
          <Input
            type="date"
            value={filters.date}
            onChange={(event) => filter("date", event.target.value)}
            className="h-9 min-h-9 text-xs w-36 rounded-lg border-line bg-white px-2.5 shadow-2xs"
            aria-label={M.dateFilter}
          />
        )}

        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          <Button
            variant="outline"
            className="h-9 min-h-9 px-3 text-xs font-semibold gap-1.5"
            icon={<RotateCcw size={14} aria-hidden="true" />}
            onClick={() => {
              setSearchInput("");
              setFilters(initialFilters);
              setPagination({ section, page: 1 });
            }}
          >
            {M.clearFilters}
          </Button>
          <Button
            variant="outline"
            className="h-9 min-h-9 px-3 text-xs font-semibold gap-1.5"
            icon={<Download size={14} aria-hidden="true" />}
            onClick={exportRows}
            disabled={!count}
          >
            {M.export}
          </Button>
        </div>
      </section>
      {notice && (
        <p role="status" className="shrink-0 m-0 text-xs text-primary">
          {notice}
        </p>
      )}
      {count === 0 ? (
        <section className={`${adminCard} text-center`}>
          <h2 className="text-lg font-bold">{M.empty}</h2>
          <p className="text-sm text-slate-600">{M.emptyHelp}</p>
        </section>
      ) : (
        <AdminTable title={M.titles[section]} headings={headings}>
          {accounts
            ? users.slice(start, start + pageSize).map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.name}</strong>
                    <span className="mt-1 block text-xs text-slate-600">{user.email}</span>
                  </td>
                  <td>{ADMIN_ROLE_LABELS[user.role]}</td>
                  <td>
                    <AdminBadge
                      label={user.status === "ACTIVE" ? M.active : M.inactive}
                      warning={user.status !== "ACTIVE"}
                    />
                  </td>
                  <td className="max-w-xs">{accessLabel(user, data.facilities)}</td>
                  {section === "users" && (
                    <td>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : M.none}</td>
                  )}
                  <td>
                    <div className="grid gap-1">
                      {section === "users" && (
                        <Button
                          variant="ghost"
                          aria-label={M.detailLabel(user.name)}
                          onClick={() => setUserDetail(user)}
                        >
                          {M.details}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        aria-label={
                          section === "assignments"
                            ? M.assignmentLabel(user.name)
                            : M.editLabel(user.name)
                        }
                        onClick={() => setEditor(user)}
                      >
                        {section === "assignments" ? M.assign : M.edit}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            : login
              ? logins.slice(start, start + pageSize).map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDateTime(entry.at)}</td>
                    <td>
                      <strong>{entry.name}</strong>
                      <span className="mt-1 block text-xs text-slate-600">{entry.email}</span>
                    </td>
                    <td>{ADMIN_ROLE_LABELS[entry.role]}</td>
                    <td>{entry.ipMasked}</td>
                    <td>{entry.device}</td>
                    <td>
                      <AdminBadge
                        label={entry.outcome === "SUCCESS" ? M.success : M.failed}
                        warning={entry.outcome !== "SUCCESS"}
                      />
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        aria-label={M.detailLabel(entry.id)}
                        onClick={() => setLoginDetail(entry)}
                      >
                        {M.details}
                      </Button>
                    </td>
                  </tr>
                ))
              : audits.slice(start, start + pageSize).map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDateTime(entry.at)}</td>
                    <td>{entry.actor}</td>
                    <td>
                      {entry.target}
                      <span className="mt-1 block text-xs text-slate-600">{entry.targetId}</span>
                    </td>
                    <td>{M.actions[entry.action]}</td>
                    <td>{entry.facilityIds.join(", ") || M.none}</td>
                    <td>
                      <AdminBadge
                        label={entry.outcome === "SUCCESS" ? M.success : M.failed}
                        warning={entry.outcome !== "SUCCESS"}
                      />
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        aria-label={M.detailLabel(entry.id)}
                        onClick={() => setAuditDetail(entry)}
                      >
                        {M.details}
                      </Button>
                    </td>
                  </tr>
                ))}
        </AdminTable>
      )}
      <div className="shrink-0 [&>nav]:shadow-2xs">
        <ListPagination
          label={M.titles[section]}
          page={page}
          pageSize={pageSize}
          total={count}
          onPageChange={(next) => setPagination({ section, page: next })}
        />
      </div>
      {editor && (
        <AdminEditor
          key={editor.id}
          user={editor}
          data={data}
          actor={actor}
          assignment={section === "assignments"}
          pending={query.mutation.isPending}
          onClose={() => setEditor(null)}
          onSave={async (changes) => {
            await query.mutation.mutateAsync(changes);
            setNotice(M.saved);
          }}
        />
      )}
      {userDetail && (
        <AdminDrawer title={M.userDetail} onClose={() => setUserDetail(null)}>
          <p className="font-bold">{userDetail.name}</p>
          <p className="break-all text-sm">{userDetail.email}</p>
          <AdminSnapshotView
            title={M.accessPreview}
            snapshot={userDetail}
            facilities={data.facilities}
          />
          <p className="text-sm">
            {M.lastLogin}:{" "}
            {userDetail.lastLoginAt ? formatDateTime(userDetail.lastLoginAt) : M.none}
          </p>
        </AdminDrawer>
      )}
      {loginDetail && (
        <AdminDrawer title={M.loginDetail} onClose={() => setLoginDetail(null)}>
          <dl className="grid gap-3 text-sm">
            {[
              [M.account, loginDetail.name],
              [M.email, loginDetail.email],
              [M.roleFilter, ADMIN_ROLE_LABELS[loginDetail.role]],
              [M.time, formatDateTime(loginDetail.at)],
              [M.ip, loginDetail.ipMasked],
              [M.device, loginDetail.device],
              [M.outcomeFilter, loginDetail.outcome === "SUCCESS" ? M.success : M.failed],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-slate-600">{label}</dt>
                <dd className="m-0 break-words font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-slate-600">{M.privacy}</p>
        </AdminDrawer>
      )}
      {auditDetail && (
        <AdminDrawer title={M.auditDetail} onClose={() => setAuditDetail(null)}>
          <div className="grid gap-4">
            <p className="m-0 text-sm">{auditDetail.id}</p>
            <p className="m-0 text-sm">
              {M.actor}: {auditDetail.actor} · {ADMIN_ROLE_LABELS[auditDetail.actorRole]}
            </p>
            <p className="m-0 text-sm">
              {M.target}: {auditDetail.target}
            </p>
            <p className="m-0 text-sm">
              {M.identifier}: {auditDetail.targetId}
            </p>
            <p className="m-0 text-sm">
              {M.actions[auditDetail.action]} · {formatDateTime(auditDetail.at)}
            </p>
            <AdminBadge
              label={auditDetail.outcome === "SUCCESS" ? M.success : M.failed}
              warning={auditDetail.outcome !== "SUCCESS"}
            />
            <AdminSnapshotView
              title={M.before}
              snapshot={auditDetail.before}
              facilities={data.facilities}
            />
            <AdminSnapshotView
              title={M.after}
              snapshot={auditDetail.after}
              facilities={data.facilities}
            />
            <p className="text-sm">
              {M.reason}: {auditDetail.reason || M.none}
            </p>
          </div>
        </AdminDrawer>
      )}
    </div>
  );
}
