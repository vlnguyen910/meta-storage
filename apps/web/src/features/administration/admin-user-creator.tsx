"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UserRole } from "@metastorage/database/schema/user-enums";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FieldShell, Input } from "@/components/ui/form-controls";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminApiError } from "./admin.helpers";
import { ADMIN_ROLE_LABELS, ADMIN_MESSAGES as M } from "./admin.messages";
import { AdminUserCreateSchema, type AdminUserCreateValues } from "./admin.schema";
import type { AdminUserCreatorProps } from "./admin.types";
import { AdminDialog } from "./admin-parts";

const CREATABLE_ROLES = [
  UserRole.FACILITY_STAFF,
  UserRole.FACILITY_MANAGER,
  UserRole.BUSINESS_OPERATIONS_MANAGER,
] as const;

export function AdminUserCreator({ onClose, onSave }: Readonly<AdminUserCreatorProps>) {
  const [notice, setNotice] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<AdminUserCreateValues>({
    resolver: zodResolver(AdminUserCreateSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      role: UserRole.FACILITY_STAFF,
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: AdminUserCreateValues) => {
    try {
      setNotice("");
      await onSave({
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        phone: values.phone?.trim() ? values.phone.trim() : null,
        role: values.role,
        password: values.password,
        status: "ACTIVE",
        emailVerified: true,
      });
      onClose();
    } catch (error) {
      setNotice(adminApiError(error, M.createError));
    }
  };

  return (
    <AdminDialog title={M.createUserTitle} onClose={onClose}>
      <p className="mb-4 mt-0 text-xs text-muted">{M.createUserDescription}</p>

      {notice && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-danger"
        >
          {notice}
        </div>
      )}

      <form className="grid gap-3.5" onSubmit={form.handleSubmit(onSubmit)}>
        {/* Full Name */}
        <FieldShell label={M.fullName} error={form.formState.errors.name?.message}>
          <Input
            placeholder="Ví dụ: Nguyễn Văn A"
            className="h-10 min-h-10 text-xs"
            {...form.register("name")}
          />
        </FieldShell>

        {/* Work Email */}
        <FieldShell label={M.workEmail} error={form.formState.errors.email?.message}>
          <Input
            type="email"
            placeholder="Ví dụ: nhanvien@metastorage.vn"
            className="h-10 min-h-10 text-xs"
            {...form.register("email")}
          />
        </FieldShell>

        {/* Phone Number */}
        <FieldShell label={M.phoneOptional} error={form.formState.errors.phone?.message}>
          <Input
            type="tel"
            placeholder={M.phonePlaceholder}
            className="h-10 min-h-10 text-xs"
            {...form.register("phone")}
          />
        </FieldShell>

        {/* Role Selection */}
        <FieldShell label={M.roleFilter} error={form.formState.errors.role?.message}>
          <Controller
            control={form.control}
            name="role"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="h-10 min-h-10 text-xs">
                  <SelectValue placeholder={M.chooseRolePlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {CREATABLE_ROLES.map((role) => (
                    <SelectItem key={role} value={role} className="text-xs">
                      {ADMIN_ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FieldShell>

        {/* Password */}
        <FieldShell label={M.passwordLabel} error={form.formState.errors.password?.message}>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder={M.passwordPlaceholder}
              className="h-10 min-h-10 pr-10 text-xs"
              {...form.register("password")}
            />
            <button
              type="button"
              aria-label={showPassword ? M.hidePassword : M.showPassword}
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </FieldShell>

        {/* Confirm Password */}
        <FieldShell
          label={M.confirmPasswordLabel}
          error={form.formState.errors.confirmPassword?.message}
        >
          <div className="relative">
            <Input
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder={M.confirmPasswordPlaceholder}
              className="h-10 min-h-10 pr-10 text-xs"
              {...form.register("confirmPassword")}
            />
            <button
              type="button"
              aria-label={showConfirmPassword ? M.hidePassword : M.showPassword}
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              {showConfirmPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </FieldShell>

        {/* Actions */}
        <div className="mt-2 flex justify-end gap-2.5 border-t border-line pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-9 min-h-9 px-4 text-xs font-semibold"
          >
            {M.cancel}
          </Button>
          <Button
            type="submit"
            loading={form.formState.isSubmitting}
            className="h-9 min-h-9 px-4 text-xs font-semibold gap-1.5"
            icon={<UserPlus size={15} aria-hidden="true" />}
          >
            {M.createUser}
          </Button>
        </div>
      </form>
    </AdminDialog>
  );
}
