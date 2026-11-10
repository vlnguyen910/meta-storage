"use client";

import { Calendar, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { DateCalendarView } from "./date-calendar-view";
import { DATE_PICKER_MESSAGES as M } from "./date-picker.messages";
import {
  type CalendarDay,
  formatDisplayDate,
  getTodayString,
  parseDateString,
  shiftMonths,
} from "./date-utils";

export interface DatePickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  align?: "start" | "end";
  placement?: "auto" | "top" | "bottom";
  ariaLabel?: string;
  id?: string;
  disabled?: boolean;
  allowAll?: boolean;
  allLabel?: string;
}

export function DatePicker({
  value = "",
  onChange,
  placeholder = M.placeholder,
  className,
  triggerClassName,
  align = "start",
  placement = "auto",
  ariaLabel = M.placeholder,
  id: propId,
  disabled = false,
  allowAll = false,
  allLabel = M.allDates,
}: Readonly<DatePickerProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const inputId = propId ?? `date-picker-${reactId}`;

  const isAll = value === "all" || value === "";
  const currentDate = !isAll && value ? (parseDateString(value) ?? new Date()) : new Date();
  const [viewYear, setViewYear] = useState(currentDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(currentDate.getMonth());

  useEffect(() => {
    if (isOpen) {
      if (!isAll && value) {
        const d = parseDateString(value);
        if (d) {
          setViewYear(d.getFullYear());
          setViewMonth(d.getMonth());
        }
      }
    }
  }, [isOpen, value, isAll]);

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
    setOpenUpward(spaceBelow < 340 && spaceAbove > spaceBelow);
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

  const handleSelectDate = (dateStr: string) => {
    onChange(dateStr);
    setIsOpen(false);
  };

  const todayStr = getTodayString();
  const triggerText = isAll ? (allowAll ? allLabel : placeholder) : formatDisplayDate(value);

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-block text-left", isOpen && "z-30", className)}
    >
      {/* Hidden input for test and form binding */}
      <input
        type="text"
        id={inputId}
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
        tabIndex={-1}
      />

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label={triggerText}
        className={cn(
          "flex h-9 min-h-9 cursor-pointer items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-xs transition-all hover:border-slate-300 hover:bg-slate-50/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
          isOpen && "border-primary ring-2 ring-primary/20 bg-white",
          !isAll && "border-primary/50 text-slate-900 font-semibold bg-primary-soft/10",
          triggerClassName,
        )}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <Calendar
            size={14}
            className={cn("shrink-0", !isAll ? "text-primary" : "text-slate-400")}
            aria-hidden="true"
          />
          <span className="truncate">{triggerText}</span>
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
          aria-label={M.chooseDateDialog}
          className={cn(
            "absolute z-50 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150",
            openUpward ? "bottom-full mb-1.5" : "top-full mt-1.5",
            align === "end" ? "right-0 origin-top-right" : "left-0 origin-top-left",
          )}
          style={{ width: "min(300px, 92vw)" }}
        >
          {/* Quick options */}
          <div className="mb-2.5 flex items-center gap-1.5 border-b border-slate-100 pb-2">
            {allowAll && (
              <button
                type="button"
                onClick={() => handleSelectDate("all")}
                className={cn(
                  "cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                  isAll ? "bg-primary text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100",
                )}
              >
                {allLabel}
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSelectDate(todayStr)}
              className={cn(
                "cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                value === todayStr
                  ? "bg-primary text-white"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100",
              )}
            >
              {M.today}
            </button>
          </div>

          {/* Shared Calendar Component */}
          <DateCalendarView
            viewYear={viewYear}
            viewMonth={viewMonth}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            renderDay={(day: CalendarDay) => {
              const isSelected = value === day.dateStr;

              return (
                <div key={day.dateStr} className="flex items-center justify-center p-0">
                  <button
                    type="button"
                    onClick={() => handleSelectDate(day.dateStr)}
                    className={cn(
                      "grid size-8 cursor-pointer place-items-center rounded-lg text-xs transition-colors",
                      !day.isCurrentMonth && "text-slate-300",
                      day.isCurrentMonth && "text-slate-700 hover:bg-slate-100",
                      day.isToday && !isSelected && "font-bold text-primary ring-1 ring-primary/30",
                      isSelected &&
                        "bg-primary text-white font-bold hover:bg-primary-dark shadow-xs",
                    )}
                  >
                    {day.dayNumber}
                  </button>
                </div>
              );
            }}
          />
        </div>
      )}
    </div>
  );
}
