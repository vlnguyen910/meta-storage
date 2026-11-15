import { MailJobKind } from "@metastorage/contracts/mail";
export const AUTH_MAIL_MESSAGES = {
  [MailJobKind.VERIFY_EMAIL]: {
    subject: "Xác minh email metastorage",
    html: (name: string, url: string) =>
      `<p>Xin chào ${name},</p><p>Vui lòng <a href="${url}">xác minh email</a> để hoàn tất đăng ký metastorage.</p>`,
    text: (name: string, url: string) =>
      `Xin chào ${name},\nVui lòng xác minh email để hoàn tất đăng ký metastorage: ${url}`,
  },
  [MailJobKind.RESET_PASSWORD]: {
    subject: "Đặt lại mật khẩu metastorage",
    html: (name: string, url: string) =>
      `<p>Xin chào ${name},</p><p>Vui lòng <a href="${url}">đặt lại mật khẩu</a> cho tài khoản metastorage. Liên kết chỉ dùng một lần và hết hạn sau 60 phút.</p><p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>`,
    text: (name: string, url: string) =>
      `Xin chào ${name},\nĐặt lại mật khẩu: ${url}\nLiên kết chỉ dùng một lần và hết hạn sau 60 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.`,
  },
} as const;
