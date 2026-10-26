"use client";

import { useMemo, useState } from "react";
import { useAuthStore } from "@/features/auth/auth-store";
import { matchesSearch } from "./admin.helpers";
import { ADMIN_MESSAGES as M } from "./admin.messages";
import type { AdminAccountChange, AdminFilters, AdminUser } from "./admin.types";
import { useAdminData } from "./use-admin-data";

const pageSize = 10;
const initialFilters: AdminFilters = {
  search: "",
  role: "",
  status: "",
  facilityId: "",
  outcome: "",
  action: "",
  date: "",
};

export function useAdminUsersWorkspace() {
  const query = useAdminData();
  const actor = useAuthStore((state) => state.session?.user.name) ?? M.role;
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<AdminUser | null>(null);
  const [editor, setEditor] = useState<AdminUser | null>(null);
  const [notice, setNotice] = useState("");
  const users = useMemo(
    () =>
      (query.data?.users ?? []).filter(
        (user) =>
          matchesSearch([user.id, user.name, user.email], filters.search) &&
          (!filters.role || user.role === filters.role) &&
          (!filters.status || user.status === filters.status) &&
          (!filters.facilityId || user.facilityIds.includes(filters.facilityId)),
      ),
    [filters, query.data?.users],
  );
  const currentPage = Math.min(page, Math.max(1, Math.ceil(users.length / pageSize)));
  const visibleUsers = users.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const filter = (key: keyof AdminFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  const resetFilters = () => {
    setFilters(initialFilters);
    setPage(1);
  };
  const saveChanges = async (changes: readonly AdminAccountChange[]) => {
    await query.mutation.mutateAsync(changes);
    setNotice(M.saved);
  };

  return {
    actor,
    currentPage,
    detail,
    editor,
    filter,
    filters,
    notice,
    pageSize,
    query,
    resetFilters,
    saveChanges,
    setDetail,
    setEditor,
    setPage,
    users,
    visibleUsers,
  };
}
