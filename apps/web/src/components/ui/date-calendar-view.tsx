"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { DATE_PICKER_MESSAGES as M } from "./date-picker.messages";
import {
  type CalendarDay,
  formatMonthYearVi,
  getCalendarGrid,
  VIETNAMESE_WEEKDAYS,
} from "./date-utils";

export interface DateCalendarViewProps {
  viewYear: number;
  viewMonth: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  renderDay: (day: CalendarDay) => ReactNode;
}

export function DateCalendarView({
  viewYear,
  viewMonth,
  onPrevMonth,
  onNextMonth,
  renderDay,
}: Readonly<DateCalendarViewProps>) {
  const calendarDays = getCalendarGrid(viewYear, viewMonth);

  return (
    <div>
      {/* Month Navigation */}
      <div className="mb-2 flex items-center justify-between px-1">
        <button
          type="button"
          aria-label={M.prevMonth}
          onClick={onPrevMonth}
          className="grid size-7 cursor-pointer place-items-center rounded-lg text-slate-600 hover:bg-slate-100"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <span className="text-xs font-bold text-slate-800">
          {formatMonthYearVi(viewYear, viewMonth)}
        </span>
        <button
          type="button"
          aria-label={M.nextMonth}
          onClick={onNextMonth}
          className="grid size-7 cursor-pointer place-items-center rounded-lg text-slate-600 hover:bg-slate-100"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="mb-1 grid grid-cols-7 text-center">
        {VIETNAMESE_WEEKDAYS.map((day) => (
          <span key={day} className="py-0.5 text-[11px] font-semibold text-slate-400">
            {day}
          </span>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-y-1">{calendarDays.map((day) => renderDay(day))}</div>
    </div>
  );
}
