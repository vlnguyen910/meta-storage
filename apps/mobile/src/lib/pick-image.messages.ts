export const PICK_IMAGE = {
  denied: "Vui lòng cấp quyền truy cập ảnh hoặc camera để thêm minh chứng.",
  invalidData: "Không thể đọc dữ liệu ảnh. Vui lòng chọn lại hoặc chụp ảnh mới.",
  unsupported: "Định dạng ảnh chưa được hỗ trợ. Vui lòng chọn ảnh JPEG, PNG hoặc WebP.",
  tooLarge: (maxBytes: number) =>
    `Ảnh sau xử lý vượt quá ${maxBytes / (1024 * 1024)} MiB. Vui lòng chọn ảnh nhỏ hơn.`,
};
