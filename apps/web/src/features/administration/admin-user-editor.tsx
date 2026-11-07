"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UserRole } from "@metastorage/database/schema/user-enums";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FieldShell } from "@/components/ui/form-controls";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminApiError } from "./admin.helpers";
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
          } catch (error) {
            setNotice(adminApiError(error, M.updateError));
          }
        })}
      >
        <FieldShell label={M.roleChanged}>
          <Controller
            control={form.control}
            name="role"
            render={({ field }) => (
              <Select
                value={field.value === UserRole.STORAGE_CUSTOMER ? "" : field.value}
                onValueChange={field.onChange}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      user.role === UserRole.STORAGE_CUSTOMER ? M.chooseReplacementRole : undefined
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(UserRole)
                    .filter(
                      (role) =>
                        role !== UserRole.SYSTEM_ADMINISTRATOR &&
                        role !== UserRole.STORAGE_CUSTOMER,
                    )
                    .map((role) => (
                      <SelectItem key={role} value={role}>
                        {ADMIN_ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          />
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
