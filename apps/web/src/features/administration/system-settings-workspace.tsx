"use client";

import type {
  ConfigureSystemSetting,
  SystemSettingDto,
  SystemSettingKeyValue,
} from "@metastorage/contracts";
import axios from "axios";
import { History, Pencil, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownSelect } from "@/components/ui/dropdown-select";
import { FieldShell, Input } from "@/components/ui/form-controls";
import { ErrorState, LoadingState } from "@/components/ui/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/format";
import { ADMIN_MESSAGES as M } from "./admin.messages";
import { AdminDialog, adminCard } from "./admin-parts";
import {
  useSystemSettingHistory,
  useSystemSettings,
  useUpdateSystemSetting,
} from "./use-system-settings";

const ms = M.systemSettings;

export function SystemSettingsWorkspace() {
  const { showToast } = useToast();
  const query = useSystemSettings();
  const updateMutation = useUpdateSystemSetting();

  const [searchInput, setSearchInput] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [editingSetting, setEditingSetting] = useState<SystemSettingDto | null>(null);
  const [historyKey, setHistoryKey] = useState<SystemSettingKeyValue | null>(null);

  const items = query.data ?? [];

  const filteredItems = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    return items.filter((item) => {
      const label = ms.keyLabels[item.key as keyof typeof ms.keyLabels] || item.key;
      const desc = item.description || "";
      const matchesSearch =
        !q ||
        label.toLowerCase().includes(q) ||
        item.key.toLowerCase().includes(q) ||
        desc.toLowerCase().includes(q);
      const matchesCategory = categoryFilter === "ALL" || item.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [items, searchInput, categoryFilter]);

  if (query.isLoading) {
    return <LoadingState label={M.loading} variant="table" />;
  }

  if (query.isError) {
    return (
      <section className={adminCard}>
        <ErrorState message={M.error} onRetry={() => query.refetch()} />
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header filter bar */}
      <Card className="p-4 bg-white border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={ms.searchPlaceholder}
              className="pl-9 h-10 text-sm bg-slate-50/50 border-slate-200 focus:bg-white"
            />
          </div>

          <div className="w-full sm:w-56 shrink-0">
            <DropdownSelect
              value={categoryFilter}
              onChange={(val) => setCategoryFilter(val)}
              className="w-full"
              triggerClassName="h-10 text-sm bg-slate-50/50 border-slate-200"
              options={[
                { value: "ALL", label: ms.allCategories },
                { value: "SYSTEM", label: ms.categories.SYSTEM },
                { value: "RENTAL", label: ms.categories.RENTAL },
                { value: "FINANCE", label: ms.categories.FINANCE },
                { value: "OPERATIONS", label: ms.categories.OPERATIONS },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Main Table */}
      <div className="border border-slate-200 rounded-xl bg-white shadow-xs overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/95 border-b border-slate-200">
            <TableRow>
              <TableHead className="w-[35%]">{ms.headings[0]}</TableHead>
              <TableHead className="w-[15%]">{ms.headings[1]}</TableHead>
              <TableHead className="w-[18%]">{ms.headings[2]}</TableHead>
              <TableHead className="w-[12%]">{ms.headings[3]}</TableHead>
              <TableHead className="w-[12%]">{ms.headings[4]}</TableHead>
              <TableHead className="w-[8%] text-right">{ms.headings[5]}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                  {M.empty}
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((setting) => {
                const label = ms.keyLabels[setting.key as keyof typeof ms.keyLabels] || setting.key;
                const unit = ms.units[setting.unit as keyof typeof ms.units] || "";
                const categoryLabel =
                  ms.categories[setting.category as keyof typeof ms.categories] || setting.category;

                return (
                  <TableRow key={setting.key} className="hover:bg-slate-50/70 transition-colors">
                    <TableCell>
                      <div className="space-y-1">
                        <strong className="block text-sm font-semibold text-slate-900">
                          {label}
                        </strong>
                        <p className="text-xs text-slate-500 font-mono">{setting.key}</p>
                        <p className="text-xs text-slate-600 line-clamp-2">{setting.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          setting.category === "SYSTEM"
                            ? "bg-purple-50 text-purple-700 border-purple-200 font-semibold"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }
                      >
                        {categoryLabel}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-base font-bold text-slate-900">
                          {String(setting.value)}
                        </span>
                        {unit && (
                          <span className="text-xs font-semibold text-slate-500">{unit}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-mono">
                        v{setting.version}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                      {setting.updatedAt ? formatDateTime(setting.updatedAt) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setEditingSetting(setting)}
                          className="h-8 px-2.5 text-xs gap-1 border-slate-200"
                          title={ms.edit}
                        >
                          <Pencil className="size-3.5" />
                          <span>{ms.edit}</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setHistoryKey(setting.key)}
                          className="h-8 px-2 text-xs text-slate-600 hover:text-slate-900"
                          title={ms.history}
                        >
                          <History className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      {editingSetting && (
        <EditSettingDialog
          setting={editingSetting}
          onClose={() => setEditingSetting(null)}
          onSave={async (newValue) => {
            try {
              await updateMutation.mutateAsync({
                key: editingSetting.key,
                value: newValue,
                expectedVersion: editingSetting.version,
              } as ConfigureSystemSetting);
              showToast(ms.saveSuccess, "success");
              setEditingSetting(null);
            } catch (err) {
              const errorMessage =
                (axios.isAxiosError(err) &&
                  (err.response?.data?.message || err.response?.data?.error?.message)) ||
                (err instanceof Error ? err.message : ms.saveError);
              showToast(errorMessage, "error");
            }
          }}
          pending={updateMutation.isPending}
        />
      )}

      {/* History Dialog */}
      {historyKey && (
        <SettingHistoryDialog settingKey={historyKey} onClose={() => setHistoryKey(null)} />
      )}
    </div>
  );
}

function EditSettingDialog({
  setting,
  onClose,
  onSave,
  pending,
}: {
  setting: SystemSettingDto;
  onClose: () => void;
  onSave: (value: number) => Promise<void>;
  pending: boolean;
}) {
  const [val, setVal] = useState<number>(Number(setting.value));
  const [error, setError] = useState<string>();

  const label = ms.keyLabels[setting.key as keyof typeof ms.keyLabels] || setting.key;
  const unit = ms.units[setting.unit as keyof typeof ms.units] || "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Number.isNaN(val) || val < 0) {
      setError("Giá trị phải là số nguyên không âm.");
      return;
    }
    if (setting.key === "CLOUDINARY_MAX_UPLOAD_MB" && (val < 1 || val > 50)) {
      setError("Giới hạn dung lượng Cloudinary phải từ 1 đến 50 MB.");
      return;
    }
    if (setting.key === "CHECK_IN_MAX_PHOTOS" && (val < 1 || val > 30)) {
      setError("Số lượng hình ảnh check-in tối đa phải từ 1 đến 30 ảnh.");
      return;
    }
    await onSave(val);
  };

  return (
    <AdminDialog title={ms.editTitle} onClose={onClose}>
      <div className="space-y-4 pt-2">
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
          <p className="font-semibold text-sm text-slate-900">{label}</p>
          <p className="text-xs text-slate-500 font-mono">{setting.key}</p>
          <p className="text-xs text-slate-600">{setting.description}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FieldShell label={ms.newValue} error={error}>
            <div className="relative">
              <Input
                type="number"
                min={
                  setting.key === "CLOUDINARY_MAX_UPLOAD_MB" ||
                  setting.key === "CHECK_IN_MAX_PHOTOS"
                    ? 1
                    : 0
                }
                max={
                  setting.key === "CLOUDINARY_MAX_UPLOAD_MB"
                    ? 50
                    : setting.key === "CHECK_IN_MAX_PHOTOS"
                      ? 30
                      : 2147483647
                }
                value={val}
                onChange={(e) => {
                  setVal(Number(e.target.value));
                  setError(undefined);
                }}
                className="h-10 text-sm font-semibold pr-14"
                required
              />
              {unit && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 pointer-events-none">
                  {unit}
                </span>
              )}
            </div>
          </FieldShell>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span>
              {ms.currentValue}:{" "}
              <strong>
                {String(setting.value)} {unit}
              </strong>
            </span>
            <span>
              {ms.expectedVersion}: <strong>v{setting.version}</strong>
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              {M.cancel}
            </Button>
            <Button type="submit" variant="primary" loading={pending} disabled={pending}>
              {M.save}
            </Button>
          </div>
        </form>
      </div>
    </AdminDialog>
  );
}

function SettingHistoryDialog({
  settingKey,
  onClose,
}: {
  settingKey: SystemSettingKeyValue;
  onClose: () => void;
}) {
  const historyQuery = useSystemSettingHistory(settingKey);
  const items = historyQuery.data ?? [];
  const label = ms.keyLabels[settingKey as keyof typeof ms.keyLabels] || settingKey;

  return (
    <AdminDialog title={ms.historyTitle} onClose={onClose}>
      <div className="space-y-4 pt-1">
        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
          <p className="text-xs text-slate-500 font-mono">{settingKey}</p>
          <p className="font-semibold text-sm text-slate-900">{label}</p>
        </div>

        {historyQuery.isLoading ? (
          <div className="py-8 text-center text-xs text-slate-500">Đang tải lịch sử…</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">{ms.historyEmpty}</div>
        ) : (
          <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
            {items.map((change) => (
              <div
                key={change.id}
                className="p-3 bg-white border border-slate-200 rounded-lg text-xs space-y-1.5 shadow-2xs"
              >
                <div className="flex items-center justify-between font-semibold">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Trước:</span>
                    <Badge variant="outline" className="font-mono">
                      {String(change.before.value)} (v{change.before.version})
                    </Badge>
                    <span className="text-slate-400">→</span>
                    <span className="text-slate-500">Sau:</span>
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-mono font-bold">
                      {String(change.after.value)} (v{change.after.version})
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between text-slate-400 text-[11px] pt-1 border-t border-slate-100">
                  <span>Người sửa: {change.actorId.slice(0, 8)}</span>
                  <span>{formatDateTime(change.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose}>
            {M.close}
          </Button>
        </div>
      </div>
    </AdminDialog>
  );
}
