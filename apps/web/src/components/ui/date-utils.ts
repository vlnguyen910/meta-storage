/**
 * Date utility helpers for StoreX custom DatePicker and DateRangePicker components.
 * Formats dates according to Vietnam locale (Asia/Ho_Chi_Minh) and calculates standard ranges.
 */

export function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateString(value: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function formatDisplayDate(value: string): string {
  if (!value) return "";
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

export function getTodayString(): string {
  return toDateString(new Date());
}

export function shiftDays(dateStr: string, days: number): string {
  const date = parseDateString(dateStr) ?? new Date();
  date.setDate(date.getDate() + days);
  return toDateString(date);
}

export function shiftMonths(
  year: number,
  monthIndex: number,
  amount: number,
): { year: number; monthIndex: number } {
  const date = new Date(year, monthIndex + amount, 1);
  return {
    year: date.getFullYear(),
    monthIndex: date.getMonth(),
  };
}

export function getMonthPresets(todayStr = getTodayString()) {
  const today = parseDateString(todayStr) ?? new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  // Start & end of this month
  const startThisMonth = new Date(year, month, 1);
  const endThisMonth = new Date(year, month + 1, 0);

  // Start & end of last month
  const startLastMonth = new Date(year, month - 1, 1);
  const endLastMonth = new Date(year, month, 0);

  return {
    today: {
      label: "Hôm nay",
      from: todayStr,
      to: todayStr,
    },
    last7Days: {
      label: "7 ngày qua",
      from: shiftDays(todayStr, -6),
      to: todayStr,
    },
    last30Days: {
      label: "30 ngày qua",
      from: shiftDays(todayStr, -29),
      to: todayStr,
    },
    thisMonth: {
      label: "Tháng này",
      from: toDateString(startThisMonth),
      to: toDateString(endThisMonth),
    },
    lastMonth: {
      label: "Tháng trước",
      from: toDateString(startLastMonth),
      to: toDateString(endLastMonth),
    },
  };
}

export interface CalendarDay {
  dateStr: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

/**
 * Returns a 35 or 42 item array of days representing a month grid (Monday to Sunday).
 */
export function getCalendarGrid(year: number, monthIndex: number): CalendarDay[] {
  const todayStr = getTodayString();
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const prevMonthDays = new Date(year, monthIndex, 0).getDate();

  // In JS getDay(): 0 is Sunday, 1 is Monday...
  // For Monday as start of week: 0=Mon, 1=Tue, ..., 6=Sun
  const startOffset = (firstDay.getDay() + 6) % 7;

  const days: CalendarDay[] = [];

  // Previous month trailing days
  for (let i = startOffset - 1; i >= 0; i--) {
    const dayNumber = prevMonthDays - i;
    const prevDate = new Date(year, monthIndex - 1, dayNumber);
    const dateStr = toDateString(prevDate);
    days.push({
      dateStr,
      dayNumber,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
    });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const currentDate = new Date(year, monthIndex, i);
    const dateStr = toDateString(currentDate);
    days.push({
      dateStr,
      dayNumber: i,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
    });
  }

  // Next month leading days to fill up to complete weeks (multiple of 7)
  const remaining = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const nextDate = new Date(year, monthIndex + 1, i);
    const dateStr = toDateString(nextDate);
    days.push({
      dateStr,
      dayNumber: i,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
    });
  }

  return days;
}

export const VIETNAMESE_WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"] as const;

export function formatMonthYearVi(year: number, monthIndex: number): string {
  const monthNames = [
    "Tháng 1",
    "Tháng 2",
    "Tháng 3",
    "Tháng 4",
    "Tháng 5",
    "Tháng 6",
    "Tháng 7",
    "Tháng 8",
    "Tháng 9",
    "Tháng 10",
    "Tháng 11",
    "Tháng 12",
  ];
  return `${monthNames[monthIndex]}, ${year}`;
}
