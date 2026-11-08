import { CheckCircle2, CircleHelp, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
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
    <div className="space-y-2.5">
      {items.map((item) => {
        const value = results.find((entry) => entry.itemCode === item.code);
        return onChange ? (
          <fieldset
            key={item.code}
            aria-label={item.label}
            disabled={disabled}
            className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs transition-colors"
          >
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <legend className="px-1 text-sm font-semibold text-slate-800">{item.label}</legend>
              <div className="flex items-center gap-2">
                {(["PASS", "FAIL"] as const).map((result) => {
                  const isPass = result === "PASS";
                  const isChecked = value?.result === result;
                  return (
                    <label
                      key={result}
                      className={cn(
                        "flex h-8.5 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-xs sm:text-sm font-semibold transition-all select-none",
                        isChecked
                          ? isPass
                            ? "border-emerald-600 bg-emerald-50 text-emerald-800 shadow-2xs ring-1 ring-emerald-600/30"
                            : "border-rose-600 bg-rose-50 text-rose-800 shadow-2xs ring-1 ring-rose-600/30"
                          : "border-slate-200 bg-slate-50/50 text-slate-600 hover:border-slate-300 hover:bg-slate-100/70",
                      )}
                    >
                      <input
                        type="radio"
                        name={`checklist-${item.code}`}
                        checked={isChecked}
                        onChange={() => onChange(item.code, result)}
                        className="sr-only"
                      />
                      {isPass ? (
                        <CheckCircle2
                          className={cn(
                            "size-4 transition-colors",
                            isChecked ? "text-emerald-700 fill-emerald-100" : "text-slate-400",
                          )}
                        />
                      ) : (
                        <XCircle
                          className={cn(
                            "size-4 transition-colors",
                            isChecked ? "text-rose-700 fill-rose-100" : "text-slate-400",
                          )}
                        />
                      )}
                      <span>{isPass ? FLOW.checklistPass : FLOW.checklistFail}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            {value?.result === "FAIL" && (
              <div className="mt-2.5 space-y-1.5 border-t border-rose-100 pt-2.5">
                <p className="text-xs font-semibold text-rose-700">{FLOW.checklistFailure}</p>
                {onNoteChange && (
                  <label className="block text-xs font-semibold text-slate-700">
                    {FLOW.checklistFailureNote}
                    <textarea
                      className="mt-1 min-h-16 w-full rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 text-xs sm:text-sm text-slate-800 outline-none focus:border-rose-400 focus:bg-white focus:ring-1 focus:ring-rose-400"
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
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {value?.result === "PASS" ? (
                <CheckCircle2 size={17} className="shrink-0 text-emerald-600" />
              ) : value?.result === "FAIL" ? (
                <XCircle size={17} className="shrink-0 text-rose-600" />
              ) : (
                <CircleHelp size={17} className="shrink-0 text-slate-400" />
              )}
              <span className="font-medium text-slate-800 truncate leading-5">{item.label}</span>
            </div>
            <strong
              className={`shrink-0 text-xs font-semibold ${
                value?.result === "PASS"
                  ? "text-emerald-700"
                  : value?.result === "FAIL"
                    ? "text-rose-600"
                    : "text-slate-500"
              }`}
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
