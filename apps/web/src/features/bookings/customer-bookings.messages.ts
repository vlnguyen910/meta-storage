export const CUSTOMER_BOOKINGS_MESSAGES = {
  vat: (rate: number) => `VAT (${rate}%)`,
  cancelSuccess: "Đã hủy đơn đặt kho thành công.",
  cancelConfirm: "Bạn có chắc chắn muốn hủy đơn đặt kho này theo chính sách hiện hành?",
  cancelAction: "Hủy đơn đặt kho",
} as const;
