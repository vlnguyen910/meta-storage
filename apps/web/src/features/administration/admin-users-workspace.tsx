"use client";

import { UserRole } from "@metastorage/contracts";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/form-controls";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    <div className="grid min-w-0 gap-6">
      <header>
        <div>
          <h1 className="m-0 font-['Space_Grotesk'] text-2xl font-bold tracking-tight text-ink sm:text-[32px]">
            {M.titles.users}
          </h1>
          <p className="mb-0 mt-1 text-sm leading-6 text-muted">{M.descriptions.users}</p>
        </div>
      </header>

      <section aria-label={M.userMetrics} className="grid gap-5 md:grid-cols-3">
        {metrics.map((metric) => (
          <Card
            key={metric.label}
            className="flex min-h-36 items-center justify-between rounded-card border-line bg-white p-6 shadow-card"
          >
            <div className="grid gap-1">
              <span className="text-sm font-semibold text-muted">{metric.label}</span>
              <strong className="font-['Space_Grotesk'] text-3xl text-ink">
                {metric.value.toLocaleString("vi-VN")}
              </strong>
              <span className={`text-xs ${metric.detailClassName}`}>{metric.detail}</span>
            </div>
            <span className={`grid size-12 place-items-center rounded-xl ${metric.iconClassName}`}>
              <metric.icon size={22} aria-hidden="true" />
            </span>
          </Card>
        ))}
      </section>

      <section
        aria-label={M.filters}
        className="flex flex-col gap-3 rounded-card border border-line bg-white p-4 shadow-card lg:flex-row lg:items-center"
      >
        <div className="relative min-w-64 flex-1">
          <label className="sr-only" htmlFor="admin-user-search">
            {M.search}
          </label>
          <Search
            aria-hidden="true"
            size={19}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <Input
            id="admin-user-search"
            type="search"
            value={workspace.filters.search}
            placeholder={M.userSearchPlaceholder}
            className="min-h-10 rounded-lg border-line bg-canvas pl-10 shadow-sm"
            onChange={(event) => workspace.filter("search", event.target.value)}
          />
        </div>
        <Select
          value={workspace.filters.role || "all"}
          onValueChange={(value) => workspace.filter("role", value === "all" ? "" : value)}
        >
          <SelectTrigger aria-label={M.roleFilter} className="min-w-44 lg:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{M.allRoles}</SelectItem>
            {Object.values(UserRole).map((role) => (
              <SelectItem key={role} value={role}>
                {ADMIN_ROLE_LABELS[role]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={workspace.filters.status || "all"}
          onValueChange={(value) => workspace.filter("status", value === "all" ? "" : value)}
        >
          <SelectTrigger aria-label={M.statusFilter} className="min-w-40 lg:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{M.allStatuses}</SelectItem>
            <SelectItem value="ACTIVE">{M.active}</SelectItem>
            <SelectItem value="INACTIVE">{M.inactive}</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          className="min-h-10 rounded-lg px-3.5"
          icon={<RotateCcw size={17} aria-hidden="true" />}
          onClick={workspace.resetFilters}
        >
          {M.clearFilters}
        </Button>
      </section>

      <p
        role="status"
        className={workspace.notice ? "m-0 text-sm text-muted" : "sr-only"}
        aria-live="polite"
      >
        {workspace.notice}
      </p>

      {workspace.users.length === 0 ? (
        <section className={`${adminCard} text-center`}>
          <h2 className="text-lg font-bold">{M.empty}</h2>
          <p className="text-sm text-muted">{M.emptyHelp}</p>
        </section>
      ) : (
        <Card className="min-w-0 overflow-hidden rounded-card border-line bg-white shadow-card">
          <div className="overflow-x-auto">
            <Table className="min-w-[680px]">
              <TableHeader className="bg-canvas/60">
                <TableRow>
                  {M.userManagementHeadings.map((heading, index) => (
                    <TableHead
                      key={heading}
                      className={`px-6 font-semibold text-muted ${
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
                      <TableCell className="px-6 py-4">
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
                      <TableCell className="px-6 py-4">
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
                      <TableCell className="px-6 py-4">
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
                      <TableCell className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              className={`size-10 min-h-0 rounded-lg p-0 ${
                                workspace.detailId === user.id || workspace.editor?.id === user.id
                                  ? "bg-primary-soft text-primary"
                                  : ""
                              }`}
                              aria-label={M.actionsLabel(user.name)}
                            >
                              <MoreVertical size={19} aria-hidden="true" />
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
          <div className="border-t border-line p-4 [&>nav]:border-0 [&>nav]:p-0">
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
