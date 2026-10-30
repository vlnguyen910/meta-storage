export const LIST_PAGINATION_MESSAGES = {
  navigation: (label: string) => `Phân trang ${label}`,
  range: (start: number, end: number, total: number) => `Hiển thị ${start}–${end} / ${total}`,
  page: (page: number, pages: number) => `Trang ${page}/${pages}`,
  previous: "Trang trước",
  next: "Trang sau",
  jumpPrompt: "Nhập số trang để nhảy tới...",
  jumpTo: "Đi tới",
  jump: "Đi",
  summaryShowing: "Hiển thị",
  summaryOf: "trên tổng số",
  pagePlaceholder: "Trang",
} as const;
