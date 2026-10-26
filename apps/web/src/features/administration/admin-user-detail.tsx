import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { accessLabel } from "./admin.helpers";
import { ADMIN_ROLE_LABELS, ADMIN_MESSAGES as M } from "./admin.messages";
import type { AdminUserDetailProps } from "./admin.types";
import { AdminDialog } from "./admin-parts";

export function AdminUserDetail({ user, data, onClose, onEdit }: Readonly<AdminUserDetailProps>) {
  return (
    <AdminDialog title={M.userDetail} onClose={onClose}>
      <p className="mb-5 mt-0 break-all text-sm text-muted">
        {user.name} ({user.email})
      </p>
      <dl className="grid gap-4 sm:grid-cols-2">
        {[
          [M.fullName, user.name],
          [M.workEmail, user.email],
          [M.statusFilter, user.status === "ACTIVE" ? M.active : M.inactive],
          [M.roleFilter, ADMIN_ROLE_LABELS[user.role]],
          [M.assignedFacilities, accessLabel(user, data.facilities)],
          [M.lastLogin, user.lastLoginAt ? formatDateTime(user.lastLoginAt) : M.none],
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
        <Button icon={<Pencil size={17} aria-hidden="true" />} onClick={onEdit}>
          {M.edit}
        </Button>
      </div>
    </AdminDialog>
  );
}
