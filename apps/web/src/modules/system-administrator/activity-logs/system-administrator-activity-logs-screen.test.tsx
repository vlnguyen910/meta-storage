import { type ActivityLogPage, ActivityLogResult } from "@metastorage/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ADMIN_MESSAGES as M } from "@/features/administration/admin.messages";
import { api } from "@/lib/api";
import { SystemAdministratorActivityLogsScreen } from "./system-administrator-activity-logs-screen";

vi.mock("@/lib/api", () => ({ api: { activityLogs: { list: vi.fn() } } }));
const list = vi.mocked(api.activityLogs.list);
const page: ActivityLogPage = {
  limit: 20,
  offset: 0,
  total: 21,
  items: [
    {
      id: "log-1",
      userId: "b666c066-dbf7-40b4-9855-c34243a1f881",
      user: { name: "Nguyễn An", email: "an@example.test", role: "FACILITY_MANAGER" as const },
      action: "UPDATE",
      entityType: "USER",
      entityId: null,
      description: "Update user role",
      result: ActivityLogResult.SUCCESS,
      createdAt: "2026-11-02T00:30:00Z",
      ipAddress: "192.168.1.10",
      facilityId: null,
    },
  ],
};
beforeEach(() => {
  list.mockReset();
  list.mockResolvedValue(page);
});
function renderLogs() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <SystemAdministratorActivityLogsScreen />
    </QueryClientProvider>,
  );
}

it("shows six lookup columns and sends filters, Vietnam day boundaries and pagination to the API", async () => {
  renderLogs();
  await screen.findByRole("table", { name: M.titles.activityLogs });
  expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(
    M.activityLogs.headings,
  );
  expect(screen.getByText("an@example.test")).toBeVisible();
  expect(screen.queryByText(M.totalUsers)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(M.activityLogs.search), {
    target: { value: "  Nguyễn  " },
  });
  fireEvent.click(screen.getByRole("button", { name: M.activityLogs.role }));
  fireEvent.click(screen.getByRole("option", { name: "Quản lý cơ sở" }));
  fireEvent.click(screen.getByRole("button", { name: M.actionFilter }));
  fireEvent.click(screen.getByRole("option", { name: "Cập nhật" }));
  fireEvent.click(screen.getByRole("button", { name: M.activityLogs.module }));
  fireEvent.click(screen.getByRole("option", { name: "Tài khoản" }));
  fireEvent.change(screen.getByLabelText(M.activityLogs.from), { target: { value: "2026-11-01" } });
  fireEvent.change(screen.getByLabelText(M.activityLogs.to), { target: { value: "2026-11-02" } });
  fireEvent.click(screen.getByRole("button", { name: M.activityLogs.apply }));
  await waitFor(() =>
    expect(list.mock.calls.at(-1)?.[0]).toMatchObject({
      search: "Nguyễn",
      role: "FACILITY_MANAGER",
      action: "UPDATE",
      entityType: "USER",
      from: "2026-11-01T00:00:00+07:00",
      to: "2026-11-02T23:59:59.999+07:00",
      limit: 20,
      offset: 0,
    }),
  );
  await waitFor(() => expect(screen.getByRole("button", { name: "Trang sau" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
  await waitFor(() =>
    expect(list.mock.calls.at(-1)?.[0]).toMatchObject({
      search: "Nguyễn",
      role: "FACILITY_MANAGER",
      offset: 20,
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: M.clearFilters }));
  await waitFor(() => expect(list.mock.calls.at(-1)?.[0]).toEqual({ limit: 20, offset: 0 }));
  expect(screen.getByLabelText(M.activityLogs.search)).toHaveValue("");
  const calls = list.mock.calls.length;
  fireEvent.change(screen.getByLabelText(M.activityLogs.from), { target: { value: "2026-11-03" } });
  fireEvent.change(screen.getByLabelText(M.activityLogs.to), { target: { value: "2026-11-01" } });
  fireEvent.click(screen.getByRole("button", { name: M.activityLogs.apply }));
  expect(await screen.findByRole("alert")).toHaveTextContent(M.activityLogs.invalidFilters);
  expect(list).toHaveBeenCalledTimes(calls);
});

it("keeps filters available after an error and retries into the empty state", async () => {
  list.mockRejectedValueOnce(new Error("Unavailable"));
  renderLogs();
  expect(await screen.findByRole("alert")).toHaveTextContent(M.activityLogs.error);
  expect(screen.getByLabelText(M.activityLogs.search)).toBeEnabled();
  list.mockResolvedValue({ limit: 20, offset: 0, total: 0, items: [] });
  fireEvent.click(screen.getByRole("button", { name: M.activityLogs.retry }));
  expect(await screen.findByText(M.activityLogs.empty)).toBeVisible();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

it("returns to a valid server page when a refresh reduces the matching history", async () => {
  renderLogs();
  await screen.findByRole("table", { name: M.titles.activityLogs });
  fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
  await waitFor(() => expect(list.mock.calls.at(-1)?.[0]?.offset).toBe(20));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: M.activityLogs.refresh })).toBeEnabled(),
  );
  list.mockImplementation(async (params) => ({
    ...page,
    total: 1,
    items: params?.offset ? [] : page.items,
  }));
  fireEvent.click(screen.getByRole("button", { name: M.activityLogs.refresh }));
  await waitFor(() => expect(list.mock.calls.at(-1)?.[0]?.offset).toBe(0));
  expect(await screen.findByRole("table", { name: M.titles.activityLogs })).toBeVisible();
});
