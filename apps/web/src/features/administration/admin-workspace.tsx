"use client";

import { UserRole } from "@metastorage/contracts";
import { Download, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldShell, Input, Select } from "@/components/ui/form-controls";
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
import { AdminSummary } from "./admin-summary";
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
  dashboard: "SA01",
  users: "SA02",
  assignments: "SA03",
  "login-history": "SA04",
  "activity-logs": "SA05",
};

export function AdminWorkspace({ section }: Readonly<AdminWorkspaceProps>) {
  const query = useAdminData();
  const actor = useAuthStore((state) => state.session?.user.name) ?? M.role;
  const [filters, setFilters] = useState(initialFilters);
  const [editor, setEditor] = useState<AdminUser | null>(null);
  const [userDetail, setUserDetail] = useState<AdminUser | null>(null);
  const [loginDetail, setLoginDetail] = useState<AdminLogin | null>(null);
  const [auditDetail, setAuditDetail] = useState<AdminAudit | null>(null);
  const [notice, setNotice] = useState("");
  const filter = (key: keyof AdminFilters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  if (query.isLoading) return <LoadingState label={M.loading} />;
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
    <div className="grid min-w-0 gap-5">
      <header>
        <p className="mb-2 mt-0 text-xs font-semibold text-primary">
          {M.role} / {codes[section]}
        </p>
        <h1 className="m-0 text-2xl font-bold tracking-tight sm:text-3xl">{M.titles[section]}</h1>
        <p className="mb-0 mt-3 text-sm leading-6 text-slate-600">{M.descriptions[section]}</p>
      </header>
      <p className="m-0 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-900">
        {M.demoNote}
      </p>
      {section === "dashboard" ? (
        <AdminSummary data={data} />
      ) : (
        <>
          {section === "assignments" && (
            <p className="m-0 text-sm text-slate-600">{M.facilityHelp}</p>
          )}
          {!accounts && (
            <p className="m-0 text-sm text-slate-600">
              {M.readonlyLog} {M.privacy}
            </p>
          )}
          <section
            aria-label={section === "activity-logs" ? M.auditSearch : M.search}
            className={`${adminCard} grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-4`}
          >
            <FieldShell label={section === "activity-logs" ? M.auditSearch : M.search}>
              <Input
                type="search"
                value={filters.search}
                onChange={(event) => filter("search", event.target.value)}
              />
            </FieldShell>
            {(accounts || login) && (
              <FieldShell label={M.roleFilter}>
                <Select
                  value={filters.role}
                  onChange={(event) => filter("role", event.target.value)}
                >
                  <option value="">{M.all}</option>
                  {Object.values(UserRole)
                    .filter((role) => section !== "assignments" || isFacilityRole(role))
                    .map((role) => (
                      <option key={role} value={role}>
                        {ADMIN_ROLE_LABELS[role]}
                      </option>
                    ))}
                </Select>
              </FieldShell>
            )}
            {accounts && (
              <FieldShell label={M.statusFilter}>
                <Select
                  value={filters.status}
                  onChange={(event) => filter("status", event.target.value)}
                >
                  <option value="">{M.all}</option>
                  <option value="ACTIVE">{M.active}</option>
                  <option value="INACTIVE">{M.inactive}</option>
                </Select>
              </FieldShell>
            )}
            {(accounts || section === "activity-logs") && (
              <FieldShell label={M.facilityFilter}>
                <Select
                  value={filters.facilityId}
                  onChange={(event) => filter("facilityId", event.target.value)}
                >
                  <option value="">{M.all}</option>
                  {data.facilities.map((facility) => (
                    <option key={facility.id} value={facility.id}>
                      {facility.name}
                    </option>
                  ))}
                </Select>
              </FieldShell>
            )}
            {!accounts && (
              <FieldShell label={M.outcomeFilter}>
                <Select
                  value={filters.outcome}
                  onChange={(event) => filter("outcome", event.target.value)}
                >
                  <option value="">{M.all}</option>
                  <option value="SUCCESS">{M.success}</option>
                  <option value="FAILED">{M.failed}</option>
                </Select>
              </FieldShell>
            )}
            {!accounts && (
              <FieldShell label={M.dateFilter}>
                <Input
                  type="date"
                  value={filters.date}
                  onChange={(event) => filter("date", event.target.value)}
                />
              </FieldShell>
            )}
            {section === "activity-logs" && (
              <FieldShell label={M.actionFilter}>
                <Select
                  value={filters.action}
                  onChange={(event) => filter("action", event.target.value)}
                >
                  <option value="">{M.all}</option>
                  {Object.entries(M.actions).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </FieldShell>
            )}
            <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-4">
              <Button
                variant="outline"
                icon={<RotateCcw size={17} aria-hidden="true" />}
                onClick={() => setFilters(initialFilters)}
              >
                {M.reset}
              </Button>
              <Button
                variant="outline"
                icon={<Download size={17} aria-hidden="true" />}
                onClick={exportRows}
                disabled={!count}
              >
                {M.export}
              </Button>
            </div>
          </section>
          <p role="status" className="m-0 text-sm text-primary">
            {notice}
          </p>
          {count === 0 ? (
            <section className={`${adminCard} text-center`}>
              <h2 className="text-lg font-bold">{M.empty}</h2>
              <p className="text-sm text-slate-600">{M.emptyHelp}</p>
            </section>
          ) : (
            <AdminTable title={M.titles[section]} headings={headings}>
              {accounts
                ? users.map((user) => (
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
                  ? logins.map((entry) => (
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
                  : audits.map((entry) => (
                      <tr key={entry.id}>
                        <td>{formatDateTime(entry.at)}</td>
                        <td>{entry.actor}</td>
                        <td>
                          {entry.target}
                          <span className="mt-1 block text-xs text-slate-600">
                            {entry.targetId}
                          </span>
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
        </>
      )}
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
