import { FLOW } from "./flow.messages";
import type { InspectionChecklistProps } from "./inspection-checklist.types";

export function InspectionChecklist({
  items,
  results,
  disabled,
  onChange,
}: InspectionChecklistProps) {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const value = results.find((entry) => entry.itemCode === item.code);
        return onChange ? (
          <fieldset
            key={item.code}
            disabled={disabled}
            className="rounded-lg border border-[#bfc9c4] p-4"
          >
            <legend className="px-1 text-sm font-semibold">{item.label}</legend>
            <div className="flex flex-wrap gap-3">
              {(["PASS", "FAIL"] as const).map((result) => (
                <label
                  key={result}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded bg-[#f2f3ff] px-4"
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
              <p className="mt-2 text-sm text-[#93000a]">{FLOW.checklistFailure}</p>
            )}
          </fieldset>
        ) : (
          <div
            key={item.code}
            className="flex flex-wrap items-start justify-between gap-2 rounded bg-[#f2f3ff] p-3 text-sm"
          >
            <span>{item.label}</span>
            <strong className={value?.result === "PASS" ? "text-[#306858]" : "text-[#93000a]"}>
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
