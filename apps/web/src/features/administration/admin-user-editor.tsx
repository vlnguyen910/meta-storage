"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UserRole } from "@metastorage/contracts";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FieldShell, Select } from "@/components/ui/form-controls";
import { ADMIN_ROLE_LABELS, ADMIN_MESSAGES as M } from "./admin.messages";
import { AdminUserEditSchema } from "./admin.schema";
import type { AdminUserEditorProps, AdminUserEditValues } from "./admin.types";
import { AdminDialog } from "./admin-parts";

export function AdminUserEditor({ user, onClose, onSave }: Readonly<AdminUserEditorProps>) {
  const [notice, setNotice] = useState("");
  const form = useForm<AdminUserEditValues>({
    resolver: zodResolver(AdminUserEditSchema),
    defaultValues: { role: user.role },
  });

  return (
    <AdminDialog title={M.edit} onClose={onClose}>
      <p className="mb-5 mt-0 text-sm text-muted">
        {user.name} · {user.email}
      </p>
      <p className="mb-0 rounded-lg bg-canvas p-3 text-sm text-muted">{M.clearingAccess}</p>
      <form
        className="grid gap-4"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            await onSave(values.role);
            onClose();
          } catch {
            setNotice(M.updateError);
          }
        })}
      >
        <FieldShell label={M.roleChanged}>
          <Select {...form.register("role")}>
            {Object.values(UserRole)
              .filter((role) => role !== UserRole.SYSTEM_ADMINISTRATOR)
              .map((role) => (
                <option key={role} value={role}>
                  {ADMIN_ROLE_LABELS[role]}
                </option>
              ))}
          </Select>
        </FieldShell>
        {notice && (
          <p role="alert" className="m-0 text-sm text-danger">
            {notice}
          </p>
        )}
        <div className="flex justify-end gap-3 border-t border-line pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            {M.cancel}
          </Button>
          <Button
            type="submit"
            loading={form.formState.isSubmitting}
            disabled={!form.formState.isDirty}
          >
            {M.save}
          </Button>
        </div>
      </form>
    </AdminDialog>
  );
}
