import { CheckCircle2, CircleHelp, XCircle } from "lucide-react";
import { FLOW } from "./flow.messages";
import type { InspectionChecklistProps } from "./inspection-checklist.types";

export function InspectionChecklist({
  items,
  results,
  disabled,
  onChange,
  onNoteChange,
}: InspectionChecklistProps) {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const value = results.find((entry) => entry.itemCode === item.code);
        return onChange ? (
          <fieldset
            key={item.code}
            disabled={disabled}
            className="rounded-xl border border-slate-200 bg-slate-50/40 p-4"
          >
            <legend className="px-1 text-sm font-semibold">{item.label}</legend>
            <div className="flex flex-wrap gap-3">
              {(["PASS", "FAIL"] as const).map((result) => (
                <label
                  key={result}
                  className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-4 text-sm transition-colors ${value?.result === result ? (result === "PASS" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900") : "border-slate-200 bg-white text-slate-600"}`}
                >
                  <input
                    type="radio"
                    name={`checklist-${item.code}`}
                    checked={value?.result === result}
                    onChange={() => onChange(item.code, result)}
                    className="accent-[#003b2f]"
                  />
                  {result === "PASS" ? FLOW.checklistPass : FLOW.checklistFail}
                </label>
              ))}
            </div>
            {value?.result === "FAIL" && (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-[#93000a]">{FLOW.checklistFailure}</p>
                {onNoteChange && (
                  <label className="block text-xs font-semibold">
                    {FLOW.checklistFailureNote}
                    <textarea
                      className="mt-1 min-h-20 w-full rounded-lg border border-line bg-white p-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-primary"
                      maxLength={1000}
                      value={value.note ?? ""}
                      disabled={disabled}
                      onChange={(event) => onNoteChange(item.code, event.target.value)}
                    />
                  </label>
                )}
              </div>
            )}
          </fieldset>
        ) : (
          <div
            key={item.code}
            className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-sm"
          >
            {value?.result === "PASS" ? (
              <CheckCircle2
                aria-hidden="true"
                size={18}
                className="mt-0.5 shrink-0 text-emerald-700"
              />
            ) : value?.result === "FAIL" ? (
              <XCircle aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-rose-700" />
            ) : (
              <CircleHelp aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-slate-500" />
            )}
            <span className="min-w-0 flex-1 leading-6">{item.label}</span>
            <strong
              className={`shrink-0 pt-0.5 text-xs ${value?.result === "PASS" ? "text-emerald-800" : value?.result === "FAIL" ? "text-rose-700" : "text-slate-500"}`}
            >
              {value?.result === "PASS"
                ? FLOW.checklistPass
                : value?.result === "FAIL"
                  ? FLOW.checklistFail
                  : value
                    ? String(value.result)
                    : FLOW.checklistUnanswered}
            </strong>
          </div>
        );
      })}
    </div>
  );
}
