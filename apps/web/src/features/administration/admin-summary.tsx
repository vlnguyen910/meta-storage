import { UserRole } from "@metastorage/contracts";
import Link from "next/link";
import { systemAdministratorRoutes as routes } from "@/config/routes";
import { formatDateTime } from "@/lib/format";
import { isFacilityRole } from "./admin.helpers";
import { ADMIN_ROLE_LABELS, ADMIN_MESSAGES as M } from "./admin.messages";
import type { AdminSummaryProps } from "./admin.types";
import { AdminBadge, AdminTable, adminCard } from "./admin-parts";

export function AdminSummary({ data }: Readonly<AdminSummaryProps>) {
  const metrics = [
    { label: M.totalUsers, value: data.users.length, href: routes.users },
    {
      label: M.activeUsers,
      value: data.users.filter((user) => user.status === "ACTIVE").length,
      href: routes.users,
    },
    {
      label: M.lockedUsers,
      value: data.users.filter((user) => user.status === "INACTIVE").length,
      href: routes.users,
    },
    {
      label: M.pendingAssignments,
      value: data.users.filter((user) => isFacilityRole(user.role) && !user.facilityIds.length)
        .length,
      href: routes.facilityAssignments,
    },
  ];
  return (
    <div className="grid min-w-0 gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Link
            href={metric.href}
            className={`${adminCard} transition hover:border-primary focus-visible:outline-2 focus-visible:outline-primary`}
            key={metric.label}
          >
            <p className="m-0 text-sm text-slate-600">{metric.label}</p>
            <p className="mb-0 mt-3 text-3xl font-bold text-primary">{metric.value}</p>
          </Link>
        ))}
      </div>
      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <section className={adminCard}>
          <h2 className="mt-0 text-lg font-bold">{M.roleDistribution}</h2>
          <ul className="m-0 grid list-none gap-3 p-0">
            {Object.values(UserRole).map((role) => (
              <li
                className="flex justify-between gap-4 border-b border-slate-100 pb-3 text-sm"
                key={role}
              >
                <span>{ADMIN_ROLE_LABELS[role]}</span>
                <strong>{data.users.filter((user) => user.role === role).length}</strong>
              </li>
            ))}
          </ul>
        </section>
        <section className="min-w-0">
          <h2 className="text-lg font-bold">{M.facilitySummary}</h2>
          <AdminTable title={M.facilitySummary} headings={M.facilityHeadings}>
            {data.facilities.map((facility) => (
              <tr key={facility.id}>
                <td>{facility.name}</td>
                <td>
                  {
                    data.users.filter(
                      (user) =>
                        user.role === UserRole.FACILITY_MANAGER &&
                        user.facilityIds.includes(facility.id),
                    ).length
                  }
                </td>
                <td>
                  {
                    data.users.filter(
                      (user) =>
                        user.role === UserRole.FACILITY_STAFF &&
                        user.facilityIds.includes(facility.id),
                    ).length
                  }
                </td>
              </tr>
            ))}
          </AdminTable>
        </section>
      </div>
      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <section className={adminCard}>
          <h2 className="mt-0 text-lg font-bold">
            <Link href={routes.loginHistory} className="hover:text-primary">
              {M.latestLogins}
            </Link>
          </h2>
          <ul className="m-0 grid list-none gap-3 p-0">
            {data.logins.slice(0, 4).map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 text-sm"
              >
                <div>
                  <strong>{entry.name}</strong>
                  <p className="mb-0 mt-1 text-xs text-slate-600">{formatDateTime(entry.at)}</p>
                </div>
                <AdminBadge
                  label={entry.outcome === "SUCCESS" ? M.success : M.failed}
                  warning={entry.outcome === "FAILED"}
                />
              </li>
            ))}
          </ul>
        </section>
        <section className={adminCard}>
          <h2 className="mt-0 text-lg font-bold">
            <Link href={routes.activityLogs} className="hover:text-primary">
              {M.latestActivity}
            </Link>
          </h2>
          <ul className="m-0 grid list-none gap-3 p-0">
            {data.audits.slice(0, 4).map((entry) => (
              <li key={entry.id} className="border-b border-slate-100 pb-3 text-sm">
                <strong>{M.actions[entry.action]}</strong>
                <p className="mb-0 mt-1 text-slate-600">
                  {entry.target} · {formatDateTime(entry.at)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
