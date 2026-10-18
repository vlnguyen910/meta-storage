"use client";

import { AlertCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldShell, Input, Select } from "@/components/ui/form-controls";
import { OPERATIONS_MESSAGES as M } from "../operations.messages";

export function OperationsFeesView() {
  return (
    <div className="grid gap-6">
      {/* Notice Banner explaining fees are disabled / TBD */}
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
        <div className="flex items-start gap-3">
          <AlertCircle size={22} className="text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h2 className="text-base font-bold text-amber-900">{M.feesDisabledTitle}</h2>
            <p className="mt-1 text-xs text-amber-800 leading-relaxed">
              {M.feesDisabledExplanation}
            </p>
          </div>
        </div>
      </section>

      {/* Disabled Fees Form */}
      <form
        noValidate
        onSubmit={(e) => e.preventDefault()}
        className="grid gap-6 opacity-70 cursor-not-allowed"
      >
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Deposit policy note */}
          <section className="grid content-start gap-4 rounded-card border border-outline-variant bg-surface-container-lowest p-6 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-ink">{M.depositPolicy}</h3>
              <Lock size={16} className="text-slate-400" />
            </div>
            <p className="text-xs text-slate-500">
              Chính sách cọc chung đã được quản lý tại mục{" "}
              <strong className="text-primary">Quy tắc kinh doanh</strong>. Không nhân bản tại đây.
            </p>
            <FieldShell label={M.depositMethod}>
              <Select disabled value="unconfigured">
                <option value="unconfigured">{M.unconfigured}</option>
              </Select>
            </FieldShell>
            <FieldShell label={M.depositValue}>
              <Input disabled type="number" value="" placeholder="Chưa hỗ trợ" />
            </FieldShell>
          </section>

          {/* Fee Policy */}
          <section className="grid content-start gap-4 rounded-card border border-outline-variant bg-surface-container-lowest p-6 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-ink">{M.feePolicy}</h3>
              <Lock size={16} className="text-slate-400" />
            </div>
            <p className="text-xs text-slate-500">{M.feeHelp}</p>
            <FieldShell label={M.extraCharge}>
              <Input disabled type="number" value="" placeholder="Chưa có API phí" />
            </FieldShell>
            <FieldShell label={M.damageCharge}>
              <Input disabled type="number" value="" placeholder="Chưa có API phí" />
            </FieldShell>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-outline-variant bg-surface-container-lowest p-5">
          <p className="m-0 text-xs text-slate-500">
            Các thao tác lưu bị khóa do chưa có endpoint backend xác thực.
          </p>
          <Button type="button" disabled variant="outline">
            {M.save}
          </Button>
        </div>
      </form>
    </div>
  );
}
