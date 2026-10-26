export const AUTH_MESSAGES = {
  resetTitle: "Đặt lại mật khẩu",
  resetNewPassword: "Mật khẩu mới",
  resetHint:
    "Sử dụng mật khẩu từ 8 đến 128 ký tự. Liên kết chỉ dùng một lần và hết hạn sau 60 phút.",
  resetPasswordLength: "Mật khẩu cần từ 8 đến 128 ký tự.",
  resetInvalid: "Liên kết không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới.",
  resetFailed:
    "Chưa thể đặt lại mật khẩu. Kiểm tra kết nối và thử lại; nếu liên kết hết hạn hoặc đã dùng, hãy yêu cầu liên kết mới.",
  resetSubmit: "Lưu mật khẩu mới",
  resetSubmitting: "Đang lưu…",
  resetLoading: "Đang tải…",
  resetSuccessTitle: "Đã đổi mật khẩu",
  resetSuccess:
    "Các phiên đăng nhập cũ đã được kết thúc. Hãy đăng nhập bằng mật khẩu mới trên web hoặc quay lại ứng dụng.",
  resetRequestNew: "Yêu cầu liên kết mới",
  termsRequired: "Vui lòng đồng ý với điều khoản sử dụng và chính sách bảo mật.",
  verificationCheck: "Kiểm tra xác thực email",
  verificationCheckDescription:
    "Mở liên kết trong email để xác thực tài khoản. Nếu đã mở liên kết, hãy đăng nhập để kiểm tra kết quả.",
  verificationEmailHint: "Nhập email đã đăng ký để nhận lại liên kết xác thực.",
  verificationResent:
    "Yêu cầu gửi lại liên kết đã được tiếp nhận. Hãy kiểm tra hộp thư và thư rác.",
  verificationRequestFailed: "Không thể gửi yêu cầu. Vui lòng kiểm tra kết nối và thử lại.",

  // Validation & Auth status
  invalidEmail: "Email chưa đúng định dạng",
  passwordTooShort: "Mật khẩu cần ít nhất 8 ký tự",
  loginEmailNotVerified:
    "Email chưa xác minh. Nếu thông tin đăng nhập đúng, storeX đã gửi lại liên kết xác minh.",
  logoutFailed: "Chưa thể đăng xuất. Vui lòng thử lại.",
  loginFailed: "Không thể đăng nhập. Vui lòng kiểm tra lại email hoặc mật khẩu.",
  loginWelcome: (name: string) => `Chào mừng ${name}`,
  registrationFailed: "Chưa thể tạo tài khoản. Vui lòng thử lại sau.",
  forgotPasswordRequestAccepted:
    "Nếu email tồn tại trong hệ thống, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.",

  // Header & Brand
  brandName: "storeX",
  homeAriaLabel: "StoreX Trang chủ",
  noAccountPrompt: "Bạn chưa có tài khoản?",
  registerNow: "Đăng ký ngay",

  // Login Card
  loginTitle: "Đăng nhập tài khoản storeX",
  loginSubtitle: "Truy cập để quản lý buồng kho, hợp đồng và lịch hẹn bàn giao của bạn",
  emailLabel: "Địa chỉ Email",
  emailPlaceholder: "vidu@gmail.com",
  passwordLabel: "Mật khẩu",
  passwordPlaceholder: "••••••••••••",
  rememberMe: "Ghi nhớ đăng nhập trên thiết bị này",
  forgotPassword: "Quên mật khẩu?",
  showPassword: "Hiện mật khẩu",
  hidePassword: "Ẩn mật khẩu",
  roleNotice:
    "Vai trò tài khoản (Khách hàng, Nhân viên cơ sở, Quản lý) được hệ thống tự động nhận diện theo thông tin đăng ký.",
  loginButton: "Đăng nhập",
  loggingIn: "Đang đăng nhập...",

  // SSO & Alternative Logins
  orContinueWith: "hoặc tiếp tục với",
  googleLogin: "Tiếp tục với Google",
  googleContinue: "Tiếp tục với Google",
  googleConnecting: "Đang kết nối với Google...",
  googleLinking: "Đang chuyển hướng để liên kết Google...",
  googleLinkButton: "Liên kết tài khoản Google",
  googleLinkTitle: "Liên kết tài khoản Google",
  googleLinkDescription:
    "Liên kết tài khoản này với Google để có thể đăng nhập nhanh chóng bằng 1 chạm trong tương lai.",
  googleLinkPromptAfterLogin:
    "Đăng nhập thành công! Bạn có muốn liên kết tài khoản Google này ngay bây giờ để thuận tiện cho các lần đăng nhập tiếp theo không?",
  linkGoogleAction: "Liên kết ngay với Google",
  linkGoogleLater: "Để sau",
  googleLinkSuccess: "Liên kết tài khoản Google thành công!",
  googleLinkFailed: "Không thể hoàn tất liên kết tài khoản Google. Vui lòng thử lại.",
  accountNotLinkedTitle: "Tài khoản chưa được liên kết Google",
  accountNotLinked:
    "Email này đã có tài khoản trên hệ thống nhưng chưa được liên kết với Google. Vui lòng đăng nhập bằng mật khẩu bên dưới, sau đó tiến hành liên kết.",
  googleEmailUnverified:
    "Email Google chưa được xác minh. Vui lòng xác minh trên Google trước khi tiếp tục.",
  googleAccountDisabled:
    "Tài khoản của bạn hiện đang bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.",
  googleLinkSessionRequired:
    "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại trước khi liên kết tài khoản.",
  googleEmailMismatch: "Email tài khoản Google không khớp với email tài khoản hiện tại của bạn.",
  googleAccessDenied:
    "Bạn đã từ chối cấp quyền truy cập từ Google. Vui lòng thử lại nếu muốn đăng nhập.",
  googleStateExpired: "Phiên xác thực đã hết hạn hoặc không hợp lệ. Vui lòng thử lại.",
  googleProviderDisabled: "Phương thức đăng nhập qua Google hiện chưa được kích hoạt.",
  googleAuthFailed: "Đăng nhập bằng Google không thành công. Vui lòng thử lại.",
  qrLogin: "Đăng nhập bằng mã QR qua ứng dụng storeX",
  hotlineLabel: "Hotline hỗ trợ kỹ thuật:",
  hotlineNumber: "1900 6868",

  // Security Micro-indicators
  sslSecurity: "Mã hóa SSL 256-bit chuẩn ngân hàng",
  isoSecurity: "Bảo mật hạ tầng ISO 27001",

  // Registration Card
  registerBadge: "Khách hàng mới",
  registerTitle: "Đăng ký tài khoản thuê kho",
  registerSubtitle:
    "Dành riêng cho khách hàng cá nhân & doanh nghiệp có nhu cầu thuê kho tại hệ thống storeX.",
  fullNameLabel: "Họ và tên",
  fullNamePlaceholder: "Nguyễn Văn A",
  fullNameRequired: "Vui lòng nhập họ và tên",
  phoneLabel: "Số điện thoại di động",
  phonePlaceholder: "0912 345 678",
  phoneRequired: "Vui lòng nhập số điện thoại",
  phoneHint: "Dùng để nhận mã OTP nhận buồng kho & thông báo hợp đồng",
  emailRegisterHint: "Hệ thống sẽ gửi liên kết kích hoạt vào địa chỉ này",
  passwordRegisterHint: "Tối thiểu 8 ký tự, bao gồm chữ hoa, chữ thường và số.",
  confirmPasswordLabel: "Xác nhận lại mật khẩu",
  confirmPasswordPlaceholder: "••••••••",
  confirmPasswordRequired: "Vui lòng xác nhận lại mật khẩu",
  passwordsMatch: "Mật khẩu khớp",
  passwordsDoNotMatch: "Mật khẩu không khớp",
  termsAgreementPrefix: "Tôi đồng ý với",
  termsAgreementAnd: "&",
  termsAgreementSuffix: "của storeX",
  termsOfService: "Quy chế hoạt động",
  privacyPolicy: "Chính sách bảo mật thông tin",
  registerButton: "Tạo tài khoản khách hàng",
  registering: "Đang tạo tài khoản...",
  alreadyHaveAccount: "Đã có tài khoản?",
  loginNow: "Đăng nhập ngay",
  checkEmailTitle: "Kiểm tra hộp thư",
  checkEmailSubtitle: (email: string) =>
    `Chúng tôi đã gửi liên kết xác minh đến ${email}. Hãy xác minh email trước khi đăng nhập.`,
  goToLogin: "Đến trang đăng nhập",
  surveillanceSecurity: "Camera giám sát 24/7",
  topNavFindStorage: "Tìm kho",
  topNavAbout: "Về StoreX",
  topNavGuide: "Hướng dẫn thuê",
  topNavContact: "Liên hệ",
  topNavHotline: "Hỗ trợ trực tuyến",
  topNavLogin: "Đăng nhập",
  topNavRegister: "Đăng ký",

  // Forgot Password Card
  forgotPasswordBadge: "Đảm bảo bảo mật cấp độ cao",
  forgotPasswordTitle: "Khôi phục mật khẩu",
  forgotPasswordSubtitle:
    "Nhập email đã đăng ký để nhận hướng dẫn thiết lập lại mật khẩu tài khoản",
  forgotPasswordEmailLabel: "Địa chỉ Email đăng ký",
  forgotPasswordEmailHint: "Hệ thống sẽ gửi mã bảo mật hoặc liên kết đặt lại mật khẩu về email này",
  forgotPasswordSubmitBtn: "Gửi yêu cầu khôi phục",
  forgotPasswordSubmitting: "Đang gửi yêu cầu...",
  backToLogin: "Quay lại Đăng nhập",
  forgotPasswordSuccessTitle: "Yêu cầu đã được tiếp nhận",
  forgotPasswordSuccessSubtitle:
    "Chúng tôi đã áp dụng các biện pháp bảo mật danh tính tài khoản StoreX.",
  securityNoticeTitle: "Thông báo bảo mật",
  securityNoticeBody:
    "Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi đi. Vì lý do bảo mật, chúng tôi không tiết lộ email có trong hệ thống hay không.",
  didNotReceiveEmailTitle: "Không nhận được email?",
  didNotReceiveEmailBody: "Vui lòng kiểm tra thư mục Spam/Quảng cáo hoặc thử lại sau 60 giây.",
  resendCountdown: (seconds: number) => `Thử lại sau ${seconds}s`,
  resendEmailBtn: "Gửi lại email",
  resendingEmail: "Đang gửi lại...",
  tlsSecurity: "Mã hóa TLS 1.3 End-to-End",
  privacySecurity: "Bảo vệ quyền riêng tư người dùng",
  helpCenter247: "Trung tâm trợ giúp trực tuyến 24/7",

  // Verify Email Page
  verifyEmailBadge: "Bảo mật hạ tầng StoreX",
  verifyEmailTitle: "Xác thực địa chỉ Email",
  verifyEmailSubtitle: "Hệ thống kho lưu trữ tự quản thông minh dành cho doanh nghiệp & cá nhân",
  verifyEmailTagline: "Hệ thống kho lưu trữ tự quản thông minh",
  recipientEmailLabel: "Email nhận thông báo",
  changeAction: "Thay đổi",
  pendingTitle: "Kiểm tra hộp thư đến của bạn",
  pendingDescription:
    "Chúng tôi đã gửi đường dẫn kích hoạt tài khoản đến địa chỉ email trên. Vui lòng kiểm tra hộp thư đến (hoặc thư rác) và bấm vào liên kết xác nhận để hoàn tất đăng ký.",
  resendVerifyEmail: "Gửi lại email xác thực",
  resendReady: "Sẵn sàng",
  checkSpamNote: "Không nhận được mã? Hãy chắc chắn kiểm tra thư mục",
  spamFolder: "Spam / Quảng cáo",
  successBadge: "Xác thực danh tính hợp lệ",
  successTitle: "Xác thực thành công!",
  successDescription:
    "Tài khoản của bạn đã sẵn sàng sử dụng. Kho lưu trữ của bạn đã được kết nối và chuẩn bị bàn giao quyền quản lý.",
  continueToLogin: "Tiếp tục đăng nhập ngay",
  sslTls256Note: "Phiên làm việc được mã hóa SSL/TLS 256-bit",
  expiredBadge: "Mã bảo mật đã hết hạn",
  expiredTitle: "Đường dẫn đã hết hiệu lực",
  expiredDescription:
    "Đường dẫn xác thực đã hết hiệu lực do quá hạn quy định (24 giờ). Bạn có thể yêu cầu gửi một liên kết mới để tiếp tục phiên khởi tạo.",
  resendNewEmail: "Gửi lại email mới",
  backToPending: "Quay lại bước chờ",
  failureBadge: "Mã không hợp lệ",
  failureTitle: "Xác thực không thành công",
  failureDescription:
    "Mã xác thực không hợp lệ hoặc đã qua sử dụng. Để đảm bảo an toàn kho hàng, các thông số bảo mật cũ đã bị hủy bỏ.",
  requestTechSupport: "Yêu cầu hỗ trợ kỹ thuật (1900 6868)",
  retryEnterEmail: "Thử nhập lại email",
  helpCenter: "Trung tâm trợ giúp",
  clusterInfo: "StoreX Cluster: SGN-01 (Ho Chi Minh)",
  sessionPrefix: "Phiên:",
  needHelpNote: "Cần trợ giúp giải phóng kho hàng gấp? Gọi ngay đường dây nóng:",

  // 404 Not Found Page
  notFoundStatusEyebrow: "Mã trạng thái: 404 Not Found",
  notFoundTitle: "Không tìm thấy trang yêu cầu",
  notFoundSubtitle:
    "Địa chỉ bạn vừa truy cập có thể đã thay đổi, bị xóa hoặc không còn tồn tại trên hệ thống",
  notFoundSearchPlaceholder: "Tìm kiếm cơ sở kho hoặc dịch vụ...",
  notFoundSearchBtn: "Tìm kiếm",
  quickNavHeader: "Gợi ý điều hướng nhanh",
  navFacilitiesTitle: "Danh sách cơ sở kho",
  navPricingTitle: "Bảng giá và kích thước kho",
  navGuideTitle: "Hướng dẫn thuê kho & quy trình nhận phòng",
  backToHome: "Về trang chủ",
  goBack: "Quay lại trang trước",
  emergencySupportNote: "Cần hỗ trợ gấp? Gọi tổng đài 24/7:",
  systemOperational: "Hệ thống kho hoạt động bình thường",

  // 403 Forbidden Page
  forbiddenHeaderTag: "403 Forbidden",
  forbiddenProtectAccess: "Bảo vệ quyền truy cập",
  forbiddenBadge: "403 - Quyền truy cập bị từ chối",
  forbiddenTitle: "Bạn không có quyền truy cập khu vực này",
  forbiddenSubtitle:
    "Bạn hiện không có quyền truy cập vào liên kết hoặc tài nguyên được yêu cầu. Vui lòng kiểm tra lại liên kết hoặc quay về khu vực làm việc được cấp quyền của bạn.",
  securityPolicyTitle: "Chính sách an toàn & bảo mật",
  securityPolicyBody:
    "Hệ thống áp dụng cơ chế xác thực đa tầng nhằm bảo vệ tài khoản và dữ liệu cá nhân. Các hành động truy cập ngoài phạm vi ủy quyền sẽ tự động bị từ chối.",
  backToDashboard: "Quay về trang quản lý của bạn",
  forbiddenHelpNote: "Cần thêm trợ giúp hoặc yêu cầu cấp quyền? Vui lòng truy cập",
  storeXHelpCenter: "Trung tâm trợ giúp StoreX",
  submitTicketNote: "để gửi phiếu hỗ trợ.",
  secureSessionFooter: "Phiên đăng nhập an toàn",
  securityGuard: "StoreX Security Guard",

  // Demo Accounts (Mock Mode)
  demoAccountsTitle: "Tài khoản demo (1-Click)",
  demoPasswordLabel: "Mật khẩu mặc định: 12345678",

  // Footer
  footerCopyright: "© 2025 StoreX. All rights reserved. Giấy phép ĐKKD TP.HCM & Hà Nội.",
  navAbout: "Về StoreX",
  navLocationsHcm: "Hệ thống kho TP.HCM",
  navLocationsHn: "Hệ thống kho Hà Nội",
  navPrivacy: "Chính sách bảo mật",
  navTerms: "Điều khoản sử dụng",
  navSupport: "Chăm sóc khách hàng",
} as const;
