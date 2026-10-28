"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ADMIN_MESSAGES as M } from "./admin.messages";
import type { AdminUserStatusConfirmationProps } from "./admin.types";

export function AdminUserStatusConfirmation({
  user,
  pending,
  onCancel,
  onConfirm,
}: Readonly<AdminUserStatusConfirmationProps>) {
  const locking = user?.status === "ACTIVE";

  return (
    <AlertDialog
      open={user !== null}
      onOpenChange={(open: boolean) => {
        if (!open && !pending) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{locking ? M.lockConfirmTitle : M.unlockConfirmTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {user &&
              (locking
                ? M.lockConfirmDescription(user.name)
                : M.unlockConfirmDescription(user.name))}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button type="button" variant="outline" disabled={pending}>
              {M.cancel}
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              type="button"
              variant={locking ? "danger" : "primary"}
              loading={pending}
              onClick={onConfirm}
            >
              {locking ? M.lockConfirmAction : M.unlockConfirmAction}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
