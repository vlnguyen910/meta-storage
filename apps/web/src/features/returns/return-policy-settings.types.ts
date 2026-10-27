export interface ReturnCalendarDraft {
  timezone: string;
  reminderTime: string;
  holidays: string;
  hours: Array<{ active: boolean; openTime: string; closeTime: string }>;
}
