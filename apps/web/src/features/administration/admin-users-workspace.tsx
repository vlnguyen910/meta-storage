"use client";

import { UserRole } from "@metastorage/database/schema/user-enums";
import {
  CheckCircle2,
  Eye,
  LockKeyhole,
  MoreVertical,
  Pencil,
  RotateCcw,
  Search,
  UnlockKeyhole,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { Input } from "@/components/ui/form-controls";
import { ListPagination } from "@/components/ui/list-pagination";
import { LoadingState } from "@/components/ui/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isManagedUser, roleBadgeClassName, userInitials } from "./admin.helpers";
import { ADMIN_ROLE_LABELS, ADMIN_MESSAGES as M } from "./admin.messages";
import { adminCard } from "./admin-parts";
import { AdminUserDetail } from "./admin-user-detail";
import { AdminUserEditor } from "./admin-user-editor";
import { AdminUserStatusConfirmation } from "./admin-user-status-confirmation";
import { useAdminUsersWorkspace } from "./use-admin-users-workspace";

export function AdminUsersWorkspace() {
  const workspace = useAdminUsersWorkspace();
  const data = workspace.query.data;
  const [searchInput, setSearchInput] = useState(workspace.filters.search);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    workspace.filter("search", searchInput.trim());
  };

  if (workspace.query.isLoading) return <LoadingState label={M.loading} variant="table" />;
  if (!data || workspace.query.isError)
    return (
      <section className={adminCard}>
        <p role="alert">{M.error}</p>
        <Button onClick={() => workspace.query.refetch()}>{M.reset}</Button>
      </section>
    );

  const metrics = [
    {
      label: M.totalUsers,
      value: data.length,
      detail: M.allSystemAccounts,
      detailClassName: "text-muted",
      icon: UsersRound,
      iconClassName: "bg-slate-100 text-slate-600",
    },
    {
      label: M.active,
      value: data.filter((user) => user.status === "ACTIVE").length,
      detail: M.activeShare(data.filter((user) => user.status === "ACTIVE").length, data.length),
      detailClassName: "text-accent",
      icon: CheckCircle2,
      iconClassName: "bg-accent-soft text-accent",
    },
    {
      label: M.inactive,
      value: data.filter((user) => user.status === "INACTIVE").length,
      detail: M.lockedReview,
      detailClassName: "text-warning",
      icon: LockKeyhole,
      iconClassName: "bg-red-50 text-danger",
    },
  ];
  const editor = workspace.editor;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden min-h-0 gap-3.5">
      <header className="shrink-0">
        <div>
          <h1 className="m-0 font-['Space_Grotesk'] text-2xl font-bold tracking-tight text-ink sm:text-[28px]">
            {M.titles.users}
          </h1>
          <p className="mb-0 mt-0.5 text-xs text-muted">{M.descriptions.users}</p>
        </div>
      </header>

      <section aria-label={M.userMetrics} className="grid shrink-0 gap-3 md:grid-cols-3">
        {metrics.map((metric) => (
          <Card
            key={metric.label}
            className="flex min-h-24 items-center justify-between rounded-card border-line bg-white p-4 shadow-card hover:border-primary/40 transition-colors"
          >
            <div className="grid gap-0.5">
              <span className="text-xs font-semibold text-muted">{metric.label}</span>
              <strong className="font-['Space_Grotesk'] text-2xl text-ink">
                {metric.value.toLocaleString("vi-VN")}
              </strong>
              <span className={`text-[11px] ${metric.detailClassName}`}>{metric.detail}</span>
            </div>
            <span className={`grid size-10 place-items-center rounded-xl ${metric.iconClassName}`}>
              <metric.icon size={20} aria-hidden="true" />
            </span>
          </Card>
        ))}
      </section>

      <section
        aria-label={M.filters}
        className="flex shrink-0 flex-wrap items-center gap-2.5 rounded-card border border-line bg-white p-3 shadow-card relative z-20"
      >
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-64">
          <div className="relative flex-1">
            <label className="sr-only" htmlFor="admin-user-search">
              {M.search}
            </label>
            <Search
              aria-hidden="true"
              size={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <Input
              id="admin-user-search"
              type="search"
              value={searchInput}
              placeholder={M.userSearchPlaceholder}
              className="h-9 min-h-9 rounded-lg border-line bg-canvas pl-9 text-xs shadow-xs"
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleSearchSubmit();
              }}
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            className="h-9 min-h-9 px-3 text-xs font-semibold gap-1.5 shrink-0"
            icon={<Search size={14} aria-hidden="true" />}
          >
            {M.searchConfirm}
          </Button>
        </form>

        <DropdownSelect
          value={workspace.filters.role || "all"}
          onChange={(value) => workspace.filter("role", value === "all" ? "" : value)}
          placement="bottom"
          className="min-w-44 lg:w-44"
          triggerClassName="h-9 min-h-9 text-xs"
          options={[
            { value: "all", label: M.allRoles },
            ...Object.values(UserRole).map((role) => ({
              value: role,
              label: ADMIN_ROLE_LABELS[role],
            })),
          ]}
          maxVisibleItems={6}
        />

        <DropdownSelect
          value={workspace.filters.status || "all"}
          onChange={(value) => workspace.filter("status", value === "all" ? "" : value)}
          placement="bottom"
          className="min-w-40 lg:w-40"
          triggerClassName="h-9 min-h-9 text-xs"
          options={[
            { value: "all", label: M.allStatuses },
            { value: "ACTIVE", label: M.active },
            { value: "INACTIVE", label: M.inactive },
          ]}
          maxVisibleItems={6}
        />

        <Button
          variant="outline"
          className="h-9 min-h-9 rounded-lg px-3 text-xs font-semibold shrink-0"
          icon={<RotateCcw size={15} aria-hidden="true" />}
          onClick={() => {
            setSearchInput("");
            workspace.resetFilters();
          }}
        >
          {M.clearFilters}
        </Button>
      </section>

      {workspace.notice && (
        <p role="status" className="shrink-0 m-0 text-xs text-muted" aria-live="polite">
          {workspace.notice}
        </p>
      )}

      {workspace.users.length === 0 ? (
        <section className={`${adminCard} text-center`}>
          <h2 className="text-lg font-bold">{M.empty}</h2>
          <p className="text-sm text-muted">{M.emptyHelp}</p>
        </section>
      ) : (
        <Card className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden rounded-card border-line bg-white shadow-card">
          <div className="flex-1 min-h-0 overflow-auto">
            <Table className="min-w-[700px] relative">
              <TableHeader className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs shadow-2xs">
                <TableRow>
                  {M.userManagementHeadings.map((heading, index) => (
                    <TableHead
                      key={heading}
                      className={`px-5 py-3 text-xs font-bold text-slate-600 ${
                        index === 0 ? "w-5/12" : index === 3 ? "w-1/12 text-right" : "w-3/12"
                      }`}
                    >
                      {heading}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspace.visibleUsers.map((user) => {
                  const canManage =
                    isManagedUser(user) && user.role !== UserRole.SYSTEM_ADMINISTRATOR;
                  return (
                    <TableRow
                      key={user.id}
                      className={
                        workspace.detailId === user.id || workspace.editor?.id === user.id
                          ? "bg-primary-soft/30 hover:bg-primary-soft/50"
                          : "hover:bg-canvas/60"
                      }
                    >
                      <TableCell className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-slate-100 text-xs font-bold text-secondary">
                            {userInitials(user.name)}
                          </span>
                          <span className="min-w-0">
                            <strong className="block truncate text-sm text-ink">{user.name}</strong>
                            <span className="block truncate text-xs text-muted">{user.email}</span>
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-3">
                        <Badge
                          className={
                            user.role
                              ? roleBadgeClassName(user.role)
                              : "border-line bg-slate-50 text-secondary"
                          }
                        >
                          {user.role ? ADMIN_ROLE_LABELS[user.role] : M.noRole}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-5 py-3">
                        <Badge
                          className={
                            user.status === "ACTIVE"
                              ? "border-emerald-100 bg-accent-soft text-accent"
                              : user.status === "INACTIVE"
                                ? "border-red-100 bg-red-50 text-red-700"
                                : "border-line bg-slate-50 text-secondary"
                          }
                        >
                          <span
                            aria-hidden="true"
                            className={`mr-1.5 size-1.5 rounded-full ${
                              user.status === "ACTIVE"
                                ? "bg-accent"
                                : user.status === "INACTIVE"
                                  ? "bg-danger"
                                  : "bg-slate-400"
                            }`}
                          />
                          {user.status === "ACTIVE"
                            ? M.active
                            : user.status === "INACTIVE"
                              ? M.inactive
                              : M.noStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-5 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              className={`size-9 min-h-0 rounded-lg p-0 ${
                                workspace.detailId === user.id || workspace.editor?.id === user.id
                                  ? "bg-primary-soft text-primary"
                                  : ""
                              }`}
                              aria-label={M.actionsLabel(user.name)}
                            >
                              <MoreVertical size={18} aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onSelect={() => workspace.setDetailId(user.id)}>
                              <Eye size={17} aria-hidden="true" className="mr-2 text-muted" />
                              {M.details}
                            </DropdownMenuItem>
                            {canManage && (
                              <DropdownMenuItem
                                onSelect={() => {
                                  if (
                                    isManagedUser(user) &&
                                    user.role !== UserRole.SYSTEM_ADMINISTRATOR
                                  )
                                    workspace.setEditor(user);
                                }}
                              >
                                <Pencil size={17} aria-hidden="true" className="mr-2 text-muted" />
                                {M.edit}
                              </DropdownMenuItem>
                            )}
                            {canManage && (
                              <DropdownMenuItem
                                disabled={workspace.isChangingStatus}
                                className={
                                  user.status === "ACTIVE"
                                    ? "text-danger focus:text-danger"
                                    : "text-primary focus:text-primary"
                                }
                                onSelect={() => workspace.requestStatusChange(user)}
                              >
                                {user.status === "ACTIVE" ? (
                                  <LockKeyhole size={17} aria-hidden="true" className="mr-2" />
                                ) : (
                                  <UnlockKeyhole size={17} aria-hidden="true" className="mr-2" />
                                )}
                                {user.status === "ACTIVE" ? M.lock : M.unlock}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="shrink-0 border-t border-line px-4 py-2.5 bg-white [&>nav]:border-0 [&>nav]:p-0 [&>nav]:shadow-none">
            <ListPagination
              label={M.titles.users}
              page={workspace.currentPage}
              pageSize={workspace.pageSize}
              total={workspace.users.length}
              onPageChange={workspace.setPage}
            />
          </div>
        </Card>
      )}

      {workspace.detailId && (
        <AdminUserDetail
          userId={workspace.detailId}
          onClose={() => workspace.setDetailId(null)}
          onEdit={(user) => {
            if (isManagedUser(user) && user.role !== UserRole.SYSTEM_ADMINISTRATOR)
              workspace.setEditor(user);
            workspace.setDetailId(null);
          }}
        />
      )}

      {editor && (
        <AdminUserEditor
          user={editor}
          onClose={() => workspace.setEditor(null)}
          onSave={(role) => workspace.saveUser(editor.id, role)}
        />
      )}
      <AdminUserStatusConfirmation
        user={workspace.statusConfirmation}
        pending={workspace.isChangingStatus}
        onCancel={() => workspace.setStatusConfirmation(null)}
        onConfirm={workspace.confirmStatusChange}
      />
    </div>
  );
}
