import {
  HANDOVER_CHECKLIST_ITEMS,
  INSPECTION_CHECKLIST_VERSION,
  type Inspection,
} from "@metastorage/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalLoadingProvider } from "@/components/providers/global-loading-provider";
import { api } from "@/lib/api";
import { useInspectionEditor } from "./use-check-in-flow";

vi.mock("@/lib/api", () => ({
  api: {
    inspections: {
      save: vi.fn(),
      history: vi.fn(),
      complete: vi.fn(),
      upload: vi.fn(),
      removePhoto: vi.fn(),
    },
  },
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/staff/check-in",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
function record(version = 0): Inspection {
  return {
    id: "a2222222-2222-2222-2222-222222222222",
    bookingId: "b0000000-0000-4000-8000-000000000001",
    facilityId: "f0000000-0000-4000-8000-000000000001",
    physicalUnitId: "c0000000-0000-4000-8000-000000000001",
    unitCode: "HCM-01-002",
    unitAssignmentId: "a0000000-0000-4000-8000-000000000001",
    verificationId: "a1111111-1111-1111-1111-111111111111",
    policyVersion: "H6_V1",
    checklistVersion: INSPECTION_CHECKLIST_VERSION,
    checklistDefinition: [...HANDOVER_CHECKLIST_ITEMS],
    results: [],
    status: "DRAFT",
    version,
    correctUnit: null,
    conditionNotes: version ? "Server note" : "",
    createdBy: "staff",
    completedBy: null,
    createdAt: "2026-10-20T00:00:00Z",
    updatedAt: "2026-10-20T00:00:00Z",
    completedAt: null,
    photos: [],
  };
}
function harness() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <GlobalLoadingProvider>{children}</GlobalLoadingProvider>
    </QueryClientProvider>
  );
}
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

describe("inspection draft recovery", () => {
  it("keeps local notes/checklist and original version when server data changes", async () => {
    const { result, rerender } = renderHook(
      ({ inspection }) => useInspectionEditor(inspection, vi.fn()),
      { initialProps: { inspection: record() }, wrapper: harness() },
    );
    act(() => {
      result.current.form.setValue("conditionNotes", "Unsaved note", { shouldDirty: true });
      result.current.setResult("ASSIGNED_UNIT", "PASS");
    });
    rerender({ inspection: record(1) });
    expect(result.current.form.getValues("conditionNotes")).toBe("Unsaved note");
    expect(result.current.form.getValues("results")).toHaveLength(1);
    expect(result.current.form.getValues("version")).toBe(0);
  });
  it("requires explicit reconciliation before saving a draft on the newest version", async () => {
    const latest = record(1);
    vi.mocked(api.inspections.history).mockResolvedValue([latest]);
    const { result, rerender } = renderHook(
      ({ inspection }) => useInspectionEditor(inspection, vi.fn()),
      { initialProps: { inspection: record() }, wrapper: harness() },
    );
    act(() =>
      result.current.form.setValue("conditionNotes", "Unsaved note", { shouldDirty: true }),
    );
    rerender({ inspection: latest });
    await act(() => result.current.save());
    expect(api.inspections.save).not.toHaveBeenCalled();
    await act(() => result.current.refreshForComparison());
    act(() => result.current.keepDraft());
    expect(result.current.form.getValues("conditionNotes")).toBe("Unsaved note");
    expect(result.current.form.getValues("version")).toBe(1);
    vi.mocked(api.inspections.save).mockResolvedValue({
      ...latest,
      version: 2,
      conditionNotes: "Unsaved note",
    });
    await act(() => result.current.save());
    expect(api.inspections.save).toHaveBeenCalledWith(
      latest.id,
      expect.objectContaining({ version: 1, conditionNotes: "Unsaved note" }),
    );
  });
  it("does not lose a draft when loading the server comparison fails", async () => {
    vi.mocked(api.inspections.history).mockRejectedValue(new Error("offline"));
    const initial = record();
    const { result } = renderHook(() => useInspectionEditor(initial, vi.fn()), {
      wrapper: harness(),
    });
    act(() =>
      result.current.form.setValue("conditionNotes", "Unsaved note", { shouldDirty: true }),
    );
    await act(() => result.current.refreshForComparison());
    expect(result.current.form.getValues("conditionNotes")).toBe("Unsaved note");
    expect(result.current.form.getValues("version")).toBe(0);
    expect(result.current.error).toContain("offline");
  });
  it("never reapplies a draft to a locked or reassigned inspection", async () => {
    const latest = { ...record(1), status: "COMPLETED" as const };
    vi.mocked(api.inspections.history).mockResolvedValue([latest]);
    const initial = record();
    const { result } = renderHook(() => useInspectionEditor(initial, vi.fn()), {
      wrapper: harness(),
    });
    act(() =>
      result.current.form.setValue("conditionNotes", "Unsaved note", { shouldDirty: true }),
    );
    await act(() => result.current.refreshForComparison());
    act(() => result.current.keepDraft());
    expect(result.current.form.getValues("version")).toBe(0);
    expect(api.inspections.save).not.toHaveBeenCalled();
  });
  it("retains the frozen version after a 409 until the user chooses a resolution", async () => {
    vi.mocked(api.inspections.save).mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { error: { message: "Version conflict" } } },
    });
    const initial = record();
    const { result } = renderHook(() => useInspectionEditor(initial, vi.fn()), {
      wrapper: harness(),
    });
    act(() =>
      result.current.form.setValue("conditionNotes", "Unsaved note", { shouldDirty: true }),
    );
    await act(() => result.current.save());
    await waitFor(() => expect(result.current.error).toBe("Version conflict"));
    expect(result.current.form.getValues("conditionNotes")).toBe("Unsaved note");
    expect(result.current.form.getValues("version")).toBe(0);
  });
  it("blocks reapplying results after a physical unit assignment changed", async () => {
    const latest = { ...record(1), unitAssignmentId: "a9999999-9999-4999-8999-999999999999" };
    vi.mocked(api.inspections.history).mockResolvedValue([latest]);
    const initial = record();
    const { result } = renderHook(() => useInspectionEditor(initial, vi.fn()), {
      wrapper: harness(),
    });
    act(() =>
      result.current.form.setValue("conditionNotes", "Unsaved note", { shouldDirty: true }),
    );
    await act(() => result.current.refreshForComparison());
    act(() => result.current.keepDraft());
    expect(result.current.form.getValues("version")).toBe(0);
    expect(result.current.form.getValues("conditionNotes")).toBe("Unsaved note");
    expect(api.inspections.save).not.toHaveBeenCalled();
  });
  it("replaces the draft only when explicitly choosing the server snapshot", async () => {
    vi.mocked(api.inspections.history).mockResolvedValue([record(1)]);
    const initial = record();
    const { result } = renderHook(() => useInspectionEditor(initial, vi.fn()), {
      wrapper: harness(),
    });
    act(() =>
      result.current.form.setValue("conditionNotes", "Unsaved note", { shouldDirty: true }),
    );
    await act(() => result.current.refreshForComparison());
    act(() => result.current.loadServerDraft());
    expect(result.current.form.getValues("conditionNotes")).toBe("Server note");
    expect(result.current.form.getValues("version")).toBe(1);
    expect(result.current.dirty).toBe(false);
  });
});
