export const RESEND_MESSAGES = {
  resetSubject: "Đặt lại mật khẩu metastorage",
  resetHtml: (name: string, url: string) =>
    `<p>Xin chào ${name},</p><p>Vui lòng <a href="${url}">đặt lại mật khẩu</a> cho tài khoản metastorage. Liên kết chỉ dùng một lần và hết hạn sau 60 phút.</p><p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>`,
  resetEmailRejected: "Không thể gửi email đặt lại mật khẩu. Vui lòng thử lại sau.",
  deliveryNotConfigured:
    "Email delivery is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.",
  verificationEmailRejected: (status: number, message: string) =>
    `Resend rejected verification email (${status}): ${message}`,
} as const;
