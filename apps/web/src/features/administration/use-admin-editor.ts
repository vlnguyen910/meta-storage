"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UserRole } from "@metastorage/contracts";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { isFacilityRole } from "./admin.helpers";
import { ADMIN_MESSAGES as M } from "./admin.messages";
import { AdminAssignmentDraftSchema, AdminUserDraftSchema } from "./admin.schema";
import type {
  AdminAccountChange,
  AdminAssignmentDraft,
  AdminEditorProps,
  AdminSnapshot,
  AdminUserDraft,
} from "./admin.types";

export function useAdminEditor({ user, data, actor }: Readonly<AdminEditorProps>) {
  const [review, setReview] = useState<readonly AdminAccountChange[] | null>(null);
  const [notice, setNotice] = useState("");
  const accountForm = useForm<AdminUserDraft>({
    resolver: zodResolver(AdminUserDraftSchema),
    defaultValues: { role: user.role, status: user.status, reason: "" },
  });
  const assignmentForm = useForm<AdminAssignmentDraft>({
    resolver: zodResolver(AdminAssignmentDraftSchema),
    defaultValues: { facilityIds: [...user.facilityIds], reason: "" },
  });
  const before: AdminSnapshot = {
    role: user.role,
    status: user.status,
    facilityIds: user.facilityIds,
  };
  const after: AdminSnapshot = Object.assign(
    {},
    before,
    ...(review ?? []).map((change) => change.patch),
  );
  const reviewAccount = (draft: AdminUserDraft) => {
    const changes: AdminAccountChange[] = [];
    if (draft.role !== user.role)
      changes.push({
        userId: user.id,
        action: "ROLE_CHANGED",
        patch: {
          role: draft.role,
          facilityIds:
            draft.role === UserRole.FACILITY_STAFF && user.facilityIds.length > 1
              ? []
              : isFacilityRole(draft.role)
                ? user.facilityIds
                : [],
        },
        reason: draft.reason,
        actor,
      });
    if (draft.status !== user.status)
      changes.push({
        userId: user.id,
        action: "STATUS_CHANGED",
        patch: { status: draft.status },
        reason: draft.reason,
        actor,
      });
    if (!changes.length) {
      setNotice(M.noChanges);
      return;
    }
    setNotice("");
    setReview(changes);
  };
  const reviewAssignment = (draft: AdminAssignmentDraft) => {
    if (!isFacilityRole(user.role)) {
      assignmentForm.setError("facilityIds", { message: M.invalidAssignmentRole });
      return;
    }
    if (draft.facilityIds.some((id) => !data.facilities.some((facility) => facility.id === id))) {
      assignmentForm.setError("facilityIds", { message: M.invalidFacility });
      return;
    }
    if (user.role === UserRole.FACILITY_STAFF && draft.facilityIds.length > 1) {
      assignmentForm.setError("facilityIds", { message: M.fsMultiTbd });
      return;
    }
    if ([...draft.facilityIds].sort().join() === [...user.facilityIds].sort().join()) {
      setNotice(M.noChanges);
      return;
    }
    setNotice("");
    setReview([
      {
        userId: user.id,
        action: "FACILITIES_CHANGED",
        patch: { facilityIds: draft.facilityIds },
        actor,
        reason: draft.reason,
      },
    ]);
  };
  return {
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
  };
}
