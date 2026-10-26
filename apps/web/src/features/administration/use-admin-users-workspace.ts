"use client";

import type { User, UserRole, UserStatus } from "@metastorage/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { adminApiError, isManagedUser, matchesSearch } from "./admin.helpers";
import { ADMIN_MESSAGES as M } from "./admin.messages";
import type { AdminManagedUser, AdminUserFilters } from "./admin.types";

const pageSize = 10;
const apiPageSize = 100;
const queryKey = ["administration", "users"] as const;
const initialFilters: AdminUserFilters = { search: "", role: "", status: "" };

async function listAllUsers(): Promise<User[]> {
  const users: User[] = [];
  for (let offset = 0; ; offset += apiPageSize) {
    const page = await api.users.list({ limit: apiPageSize, offset });
    users.push(...page);
    if (page.length < apiPageSize) return users;
  }
}

export function useAdminUsersWorkspace() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey, queryFn: listAllUsers });
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editor, setEditor] = useState<AdminManagedUser | null>(null);
  const [notice, setNotice] = useState("");
  const invalidateUsers = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({ queryKey: [...queryKey, "detail"] }),
    ]);
  const updateMutation = useMutation({
    meta: { globalLoading: true },
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      api.users.setRole(userId, role),
    onSuccess: () => {
      setNotice(M.roleUpdateSuccess);
      return invalidateUsers();
    },
    onError: (error) => setNotice(adminApiError(error, M.updateError)),
  });
  const statusMutation = useMutation({
    meta: { globalLoading: true },
    mutationFn: ({ userId, status }: { userId: string; status: UserStatus }) =>
      api.users.setStatus(userId, { status }),
    onSuccess: () => {
      setNotice(M.statusUpdateSuccess);
      return invalidateUsers();
    },
    onError: (error) => setNotice(adminApiError(error, M.updateError)),
  });
  const users = useMemo(
    () =>
      (query.data ?? []).filter(
        (user) =>
          matchesSearch([user.id, user.name, user.email], filters.search) &&
          (!filters.role || user.role === filters.role) &&
          (!filters.status || user.status === filters.status),
      ),
    [filters, query.data],
  );
  const currentPage = Math.min(page, Math.max(1, Math.ceil(users.length / pageSize)));
  const visibleUsers = users.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const filter = (key: keyof AdminUserFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  const resetFilters = () => {
    setFilters(initialFilters);
    setPage(1);
  };
  const saveUser = async (userId: string, role: UserRole) => {
    setNotice("");
    await updateMutation.mutateAsync({ userId, role });
  };
  const toggleStatus = (user: User) => {
    if (!isManagedUser(user) || user.role === "SYSTEM_ADMIN") return;
    const status: UserStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    if (
      !window.confirm(M.statusChangeConfirm(user.name, status === "INACTIVE" ? M.lock : M.unlock))
    )
      return;
    setNotice("");
    statusMutation.mutate({ userId: user.id, status });
  };

  return {
    currentPage,
    detailId,
    editor,
    filter,
    filters,
    isChangingStatus: statusMutation.isPending,
    notice,
    pageSize,
    query,
    resetFilters,
    saveUser,
    setDetailId,
    setEditor,
    setPage,
    toggleStatus,
    users,
    visibleUsers,
  };
}
