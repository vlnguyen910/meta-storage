"use client";

import { UserRole } from "@metastorage/contracts";
import { Button } from "@/components/ui/button";
import { FieldShell, Input, Select } from "@/components/ui/form-controls";
import { ADMIN_ROLE_LABELS, ADMIN_MESSAGES as M } from "./admin.messages";
import type { AdminEditorProps } from "./admin.types";
import { AdminDrawer, AdminSnapshotView } from "./admin-parts";
import { useAdminEditor } from "./use-admin-editor";

export function AdminEditor({
  user,
  data,
  assignment,
  pending,
  onSave,
  onClose,
  actor,
}: Readonly<AdminEditorProps>) {
  const {
    review,
    setReview,
    notice,
    setNotice,
    before,
    after,
    accountForm,
    assignmentForm,
    reviewAccount,
    reviewAssignment,
  } = useAdminEditor({ user, data, assignment, pending, onSave, onClose, actor });

  return (
    <AdminDrawer title={assignment ? M.assignmentDetail : M.edit} onClose={onClose}>
      <p className="font-semibold">
        {user.name}
        <span className="mt-1 block break-all text-sm font-normal text-slate-600">
          {user.email}
        </span>
      </p>
      {review ? (
        <div className="grid gap-4">
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{M.review}</p>
          <AdminSnapshotView title={M.before} snapshot={before} facilities={data.facilities} />
          <AdminSnapshotView title={M.after} snapshot={after} facilities={data.facilities} />
          <p className="text-sm text-slate-600">{review[0]?.reason || M.none}</p>
          <Button
            loading={pending}
            onClick={async () => {
              try {
                await onSave(review);
                onClose();
              } catch {
                setNotice(M.error);
              }
            }}
          >
            {M.save}
          </Button>
          <Button variant="outline" disabled={pending} onClick={() => setReview(null)}>
            {M.cancel}
          </Button>
        </div>
      ) : assignment ? (
        <form className="grid gap-4" onSubmit={assignmentForm.handleSubmit(reviewAssignment)}>
          <p className="text-sm text-slate-600">{M.facilityHelp}</p>
          <fieldset className="grid gap-2">
            <legend className="mb-3 font-semibold">{M.assignedFacilities}</legend>
            {data.facilities.map((facility) => (
              <label
                key={facility.id}
                className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 p-3"
              >
                <input
                  type="checkbox"
                  value={facility.id}
                  className="size-5 accent-primary"
                  {...assignmentForm.register("facilityIds")}
                />
                <span>{facility.name}</span>
              </label>
            ))}
          </fieldset>
          {user.role === UserRole.FACILITY_STAFF && (
            <p className="text-sm text-amber-900">{M.fsMultiTbd}</p>
          )}
          {assignmentForm.formState.errors.facilityIds && (
            <p role="alert" className="text-sm text-red-700">
              {assignmentForm.formState.errors.facilityIds.message}
            </p>
          )}
          <FieldShell label={M.reason}>
            <Input {...assignmentForm.register("reason")} />
          </FieldShell>
          <Button type="submit">{M.preview}</Button>
        </form>
      ) : (
        <form className="grid gap-4" onSubmit={accountForm.handleSubmit(reviewAccount)}>
          <FieldShell label={M.roleChanged} error={accountForm.formState.errors.role?.message}>
            <Select {...accountForm.register("role")}>
              {Object.values(UserRole).map((role) => (
                <option key={role} value={role}>
                  {ADMIN_ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
          </FieldShell>
          <FieldShell label={M.statusChanged} error={accountForm.formState.errors.status?.message}>
            <Select {...accountForm.register("status")}>
              <option value="ACTIVE">{M.active}</option>
              <option value="INACTIVE">{M.inactive}</option>
            </Select>
          </FieldShell>
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{M.clearingAccess}</p>
          <FieldShell label={M.reason}>
            <Input {...accountForm.register("reason")} />
          </FieldShell>
          <Button type="submit">{M.preview}</Button>
        </form>
      )}
      <p role="status" className="text-sm text-primary">
        {notice}
      </p>
    </AdminDrawer>
  );
}
