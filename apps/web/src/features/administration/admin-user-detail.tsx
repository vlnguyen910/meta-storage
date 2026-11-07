"use client";

import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/states";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { ADMIN_ROLE_LABELS, ADMIN_MESSAGES as M } from "./admin.messages";
import type { AdminUserDetailProps } from "./admin.types";
import { AdminDialog } from "./admin-parts";

export function AdminUserDetail({ userId, onClose, onEdit }: Readonly<AdminUserDetailProps>) {
  const query = useQuery({
    queryKey: ["administration", "users", "detail", userId],
    queryFn: () => api.users.get(userId),
  });

  return (
    <AdminDialog title={M.userDetail} onClose={onClose}>
      {query.isLoading ? (
        <LoadingState label={M.loading} />
      ) : !query.data || query.isError ? (
        <div className="grid gap-4">
          <p role="alert" className="m-0 text-sm text-danger">
            {M.error}
          </p>
          <Button variant="outline" onClick={() => query.refetch()}>
            {M.reset}
          </Button>
        </div>
      ) : (
        <>
          <p className="mb-5 mt-0 break-all text-sm text-muted">
            {query.data.name} ({query.data.email})
          </p>
          <dl className="grid gap-4 sm:grid-cols-2">
            {[
              [M.fullName, query.data.name],
              [M.workEmail, query.data.email],
              [M.phone, query.data.phone ?? M.none],
              [M.roleFilter, query.data.role ? ADMIN_ROLE_LABELS[query.data.role] : M.noRole],
              [
                M.statusFilter,
                query.data.status === "ACTIVE"
                  ? M.active
                  : query.data.status === "INACTIVE"
                    ? M.inactive
                    : M.noStatus,
              ],
              [M.emailVerified, query.data.emailVerified ? M.verified : M.notVerified],
              [M.createdAt, formatDateTime(query.data.createdAt)],
            ].map(([label, value]) => (
              <div key={label} className="grid gap-1.5">
                <dt className="text-sm font-semibold text-ink">{label}</dt>
                <dd className="m-0 min-h-10 rounded-lg border border-line bg-canvas px-3.5 py-2.5 text-sm text-ink">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex justify-end gap-3 border-t border-line pt-4">
            <Button variant="outline" onClick={onClose}>
              {M.cancel}
            </Button>
            {query.data.role && query.data.status && query.data.role !== "SYSTEM_ADMIN" && (
              <Button
                icon={<Pencil size={17} aria-hidden="true" />}
                onClick={() => onEdit(query.data)}
              >
                {M.edit}
              </Button>
            )}
          </div>
        </>
      )}
    </AdminDialog>
  );
}
