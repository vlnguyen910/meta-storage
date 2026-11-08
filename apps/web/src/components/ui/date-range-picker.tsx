"use client";

import { Calendar, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { DateCalendarView } from "./date-calendar-view";
import { DATE_PICKER_MESSAGES as M } from "./date-picker.messages";
import {
  type CalendarDay,
  formatDisplayDate,
  getMonthPresets,
  parseDateString,
  shiftMonths,
} from "./date-utils";

export interface DateRange {
  from: string;
  to: string;
}

export interface DateRangePickerProps {
  from?: string;
  to?: string;
  onChange: (range: DateRange) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  align?: "start" | "end";
  placement?: "auto" | "top" | "bottom";
  fromAriaLabel?: string;
  toAriaLabel?: string;
  fromId?: string;
  toId?: string;
  disabled?: boolean;
}

export function DateRangePicker({
  from = "",
  to = "",
  onChange,
  onClear,
  placeholder = M.rangePlaceholder,
  className,
  triggerClassName,
  align = "start",
  placement = "auto",
  fromAriaLabel = "Từ ngày",
  toAriaLabel = "Đến ngày",
  fromId,
  toId,
  disabled = false,
}: Readonly<DateRangePickerProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const activeFromId = fromId ?? `date-range-from-${id}`;
  const activeToId = toId ?? `date-range-to-${id}`;

  // Local draft state while popup is open
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Month navigation in calendar
  const initialDate = parseDateString(from) ?? parseDateString(to) ?? new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  // Reset draft whenever the popover opens or the saved props change
  useEffect(() => {
    if (isOpen) {
      setDraftFrom(from);
      setDraftTo(to);
      setHoverDate(null);
      const d = parseDateString(from) ?? parseDateString(to);
      if (d) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [isOpen, from, to]);

  // Position calculation
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    if (placement === "top") {
      setOpenUpward(true);
      return;
    }
    if (placement === "bottom") {
      setOpenUpward(false);
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    setOpenUpward(spaceBelow < 380 && spaceAbove > spaceBelow);
  }, [isOpen, placement]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Escape to close
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const presets = getMonthPresets();

  const handlePrevMonth = () => {
    const next = shiftMonths(viewYear, viewMonth, -1);
    setViewYear(next.year);
    setViewMonth(next.monthIndex);
  };

  const handleNextMonth = () => {
    const next = shiftMonths(viewYear, viewMonth, 1);
    setViewYear(next.year);
    setViewMonth(next.monthIndex);
  };

  const handleDayClick = (dayStr: string) => {
    if (!draftFrom || (draftFrom && draftTo)) {
      setDraftFrom(dayStr);
      setDraftTo("");
    } else {
      if (dayStr < draftFrom) {
        setDraftFrom(dayStr);
        setDraftTo(draftFrom);
      } else {
        setDraftTo(dayStr);
      }
    }
  };

  const handleApply = () => {
    // If user only clicked start date, make it a 1-day range rather than sending an invalid empty "to"
    const finalTo = draftTo || draftFrom;
    onChange({ from: draftFrom, to: finalTo });
    setIsOpen(false);
  };

  const handleClear = () => {
    setDraftFrom("");
    setDraftTo("");
    if (onClear) {
      onClear();
    } else {
      onChange({ from: "", to: "" });
    }
    setIsOpen(false);
  };

  const handlePresetSelect = (presetFrom: string, presetTo: string) => {
    setDraftFrom(presetFrom);
    setDraftTo(presetTo);
    const d = parseDateString(presetFrom);
    if (d) {
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
    onChange({ from: presetFrom, to: presetTo });
    setIsOpen(false);
  };

  // Label text for trigger button
  const triggerLabel = (() => {
    if (from && to) {
      if (from === to) return formatDisplayDate(from);
      return `${formatDisplayDate(from)} → ${formatDisplayDate(to)}`;
    }
    if (from) return `${M.fromPrefix} ${formatDisplayDate(from)}`;
    if (to) return `${M.toPrefix} ${formatDisplayDate(to)}`;
    return placeholder;
  })();

  const effectiveEnd =
    draftTo || (draftFrom && hoverDate && hoverDate >= draftFrom ? hoverDate : "");

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-block text-left", isOpen && "z-30", className)}
    >
      {/* Hidden inputs to preserve full compatibility with react-hook-form and automated tests */}
      <input
        type="text"
        id={activeFromId}
        aria-label={fromAriaLabel}
        value={from}
        onChange={(e) => onChange({ from: e.target.value, to })}
        className="sr-only"
        tabIndex={-1}
      />
      <input
        type="text"
        id={activeToId}
        aria-label={toAriaLabel}
        value={to}
        onChange={(e) => onChange({ from, to: e.target.value })}
        className="sr-only"
        tabIndex={-1}
      />

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label={triggerLabel}
        className={cn(
          "flex h-9 min-h-9 cursor-pointer items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-xs transition-all hover:border-slate-300 hover:bg-slate-50/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
          isOpen && "border-primary ring-2 ring-primary/20 bg-white",
          (from || to) && "border-primary/50 text-slate-900 font-semibold bg-primary-soft/10",
          triggerClassName,
        )}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <Calendar
            size={14}
            className={cn("shrink-0", from || to ? "text-primary" : "text-slate-400")}
            aria-hidden="true"
          />
          <span className="truncate">{triggerLabel}</span>
        </div>

        <ChevronDown
          size={14}
          className={cn(
            "shrink-0 text-slate-400 transition-transform duration-200",
            isOpen && (openUpward ? "-rotate-180 text-primary" : "rotate-180 text-primary"),
          )}
          aria-hidden="true"
        />
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div
          role="dialog"
          aria-label={M.chooseRangeDialog}
          className={cn(
            "absolute z-50 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150",
            openUpward ? "bottom-full mb-1.5" : "top-full mt-1.5",
            align === "end" ? "right-0 origin-top-right" : "left-0 origin-top-left",
          )}
          style={{ width: "min(340px, 94vw)" }}
        >
          {/* Quick Presets row */}
          <div className="mb-3 flex flex-wrap gap-1 border-b border-slate-100 pb-2.5">
            {Object.entries(presets).map(([key, preset]) => {
              const active = draftFrom === preset.from && draftTo === preset.to;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handlePresetSelect(preset.from, preset.to)}
                  className={cn(
                    "cursor-pointer rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors",
                    active
                      ? "bg-primary text-white"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* Shared Calendar Component */}
          <DateCalendarView
            viewYear={viewYear}
            viewMonth={viewMonth}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            renderDay={(day: CalendarDay) => {
              const isStart = draftFrom === day.dateStr;
              const isEnd = effectiveEnd === day.dateStr;
              const inRange = Boolean(
                draftFrom && effectiveEnd && day.dateStr > draftFrom && day.dateStr < effectiveEnd,
              );

              return (
                <div
                  key={day.dateStr}
                  className={cn(
                    "relative flex items-center justify-center p-0",
                    inRange && "bg-primary-soft/40",
                    isStart &&
                      effectiveEnd &&
                      isStart !== isEnd &&
                      "rounded-l-lg bg-primary-soft/40",
                    isEnd && draftFrom && isStart !== isEnd && "rounded-r-lg bg-primary-soft/40",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleDayClick(day.dateStr)}
                    onMouseEnter={() => setHoverDate(day.dateStr)}
                    className={cn(
                      "grid size-8 cursor-pointer place-items-center rounded-lg text-xs transition-colors",
                      !day.isCurrentMonth && "text-slate-300",
                      day.isCurrentMonth && "text-slate-700 hover:bg-slate-100",
                      day.isToday &&
                        !isStart &&
                        !isEnd &&
                        "font-bold text-primary ring-1 ring-primary/30",
                      (isStart || isEnd) &&
                        "bg-primary text-white font-bold hover:bg-primary-dark shadow-xs",
                    )}
                  >
                    {day.dayNumber}
                  </button>
                </div>
              );
            }}
          />

          {/* Footer with summary and action buttons */}
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
            <span className="truncate text-[11px] font-medium text-slate-500">
              {draftFrom
                ? draftTo
                  ? `${formatDisplayDate(draftFrom)} – ${formatDisplayDate(draftTo)}`
                  : `${M.fromPrefix}: ${formatDisplayDate(draftFrom)}`
                : M.noDateSelected}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleClear}
                className="cursor-pointer rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                {M.clear}
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={!draftFrom}
                className="cursor-pointer rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white shadow-xs hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {M.apply}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
