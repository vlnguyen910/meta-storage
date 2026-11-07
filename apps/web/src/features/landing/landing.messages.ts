export const landingMessages = {
  pageTitle: "MetaStorage | Thêm không gian, thêm an tâm",
  brand: "MetaStorage",
  tagline: "Không gian cho điều bạn cần",
  home: "Trang chủ",
  find: "Tìm kho",
  pricing: "Loại kho & giá thuê",
  process: "Hướng dẫn thuê",
  faq: "Câu hỏi thường gặp",
  login: "Đăng nhập",
  signedIn: "Đã đăng nhập",
  openAccount: (name: string) => `Mở trang quản lý của ${name}`,
  myStorageLookup: "Tra cứu kho của tôi",
  myStorageLookupShort: "Tra cứu kho",
  menu: "Mở menu",
  mainNavigation: "Điều hướng chính",
  mobileNavigation: "Điều hướng trên di động",
  skip: "Đến nội dung chính",
  findNow: "Tìm kho ngay",
  heroTitle: "Thêm không gian.\nThêm an tâm.",
  heroDescription:
    "Một nơi cho đồ đạc, thêm khoảng trống cho cuộc sống. Tìm và đặt kho lưu trữ phù hợp với bạn tại MetaStorage.",
  heroImageAlt: "Lối đi giữa các buồng kho lưu trữ riêng biệt, ảnh minh họa",
  illustration: "Ảnh minh họa không gian lưu trữ",
  imageLabel: "Ảnh minh họa",
  searchTitle: "Bạn cần thêm không gian ở đâu?",
  location: "Cơ sở lưu trữ",
  facilityPlaceholder: "Chọn cơ sở phù hợp",
  need: "Diện tích bạn cần",
  search: "Tìm kho phù hợp",
  needs: [
    { value: "all", label: "Tất cả diện tích" },
    { value: "small", label: "Dưới 3 m²" },
    { value: "medium", label: "Từ 3 đến 6 m²" },
    { value: "large", label: "Trên 6 m²" },
  ],
  searchHints: ["Đặt thuê trực tuyến", "Xem giá theo tháng", "Chọn lịch nhận kho"],
  needsTitle: "Một chỗ riêng cho mọi nhu cầu",
  needsDescription: "Từ vài thùng đồ đến cả căn phòng, bắt đầu từ không gian bạn cần.",
  useCases: [
    {
      title: "Đồ cá nhân & gia đình",
      description: "Cất đồ theo mùa, vali và những món đồ chưa cần dùng đến.",
      image: 4,
    },
    {
      title: "Chuyển nhà & sửa nhà",
      description: "Tìm chỗ cho nội thất, dành không gian cho những thay đổi.",
      image: 6,
    },
    {
      title: "Hàng hóa & tài liệu",
      description: "Sắp xếp hồ sơ, thiết bị và hàng hóa phù hợp với điều kiện lưu kho.",
      image: 7,
    },
  ],
  discover: "Khám phá kho lưu trữ",
  networkTitle: "Tìm một cơ sở thuận tiện cho bạn",
  networkDescription: "Xem địa chỉ, khám phá loại kho và chọn điểm lưu trữ phù hợp.",
  allFacilities: "Xem tất cả cơ sở",
  selectFacility: "Xem kho tại cơ sở",
  noFacilities: "Chưa có cơ sở để hiển thị. Vui lòng quay lại sau.",
  facilityImageAlt: (name: string) => `Cơ sở ${name}`,
  from: "Giá từ",
  sizesTitle: "Chọn vừa diện tích, thuê đúng nhu cầu",
  sizesDescription:
    "Giá thuê theo tháng tại cơ sở đã chọn. Chọn lịch nhận và thời hạn thuê để kiểm tra kho trống.",
  allSizes: "Tất cả",
  personal: "Dưới 3 m²",
  large: "Từ 3 m²",
  filterLabel: "Lọc diện tích kho",
  area: "Diện tích",
  dimensions: "Dài × rộng × cao",
  monthly: "/ tháng",
  book: "Chọn loại kho",
  rentalHint: "Tiền cọc và tổng chi phí hiển thị khi xem đơn thuê.",
  noUnits: "Chưa có loại kho phù hợp với lựa chọn này.",
  loading: "Đang tải thông tin kho…",
  error: "Chưa tải được thông tin kho. Bạn có thể thử lại.",
  retry: "Thử lại",
  whyTitle: "Thuê kho, nhẹ nhàng hơn bạn nghĩ",
  whyDescription: "Thông tin rõ ràng, lựa chọn chủ động, đặt thuê ngay trên website.",
  benefits: [
    {
      title: "Lựa chọn theo nhu cầu",
      description: "So sánh diện tích các loại kho tại từng cơ sở trước khi quyết định.",
    },
    {
      title: "Giá thuê rõ ràng",
      description: "Xem giá tháng, tiền thuê và tiền cọc trước khi thanh toán.",
    },
    {
      title: "Đặt thuê trực tuyến",
      description: "Đăng nhập tài khoản khách hàng để chọn cơ sở và bắt đầu đặt thuê.",
    },
    {
      title: "Chủ động lịch nhận kho",
      description: "Chọn ngày, giờ nhận kho trong lịch hoạt động của cơ sở.",
    },
    {
      title: "Xác nhận qua email",
      description: "Nhận thông tin xác nhận sau khi thanh toán thành công.",
    },
    {
      title: "Tra cứu thuận tiện",
      description: "Theo dõi thông tin đặt thuê qua trang tra cứu kho của bạn.",
    },
  ],
  processTitle: "Bắt đầu thuê kho trong 4 bước",
  processDescription: "Từ tìm không gian phù hợp đến nhận bàn giao tại cơ sở.",
  steps: [
    {
      title: "Chọn cơ sở & loại kho",
      description: "Tìm vị trí thuận tiện, xem diện tích và giá thuê.",
    },
    {
      title: "Đăng ký lịch thuê",
      description: "Chọn lịch nhận kho, thời hạn thuê và điền thông tin liên hệ.",
    },
    {
      title: "Kiểm tra & thanh toán",
      description: "Xem lại đơn thuê, thanh toán tiền thuê và tiền cọc.",
    },
    {
      title: "Đến nhận bàn giao",
      description: "Theo dõi xác nhận lịch hẹn và đến cơ sở để được hướng dẫn nhận kho.",
    },
  ],
  aboutTitle: "Không gian cho những điều tiếp theo",
  aboutDescription:
    "Một lần chuyển nhà, một góc làm việc mới, hay đơn giản là muốn nhà gọn hơn. MetaStorage giúp bạn tìm chỗ lưu trữ để dành không gian cho điều quan trọng.",
  aboutAction: "Khám phá các cơ sở",
  aboutImageAlt: "Không gian tiếp đón tại cơ sở lưu trữ, ảnh minh họa",
  faqDescription: "Một vài điều cần biết trước khi bắt đầu đặt thuê.",
  questions: [
    {
      question: "Tôi có cần đăng nhập để đặt kho không?",
      answer:
        "Bạn cần đăng nhập tài khoản khách hàng để đặt kho. Sau khi đăng nhập, bạn có thể xem các cơ sở và chọn kho phù hợp trong khu vực khách hàng.",
    },
    {
      question: "Làm sao biết loại kho còn trống?",
      answer:
        "Chọn cơ sở, loại kho, lịch nhận và thời hạn thuê ở bước đặt kho. Hệ thống sẽ kiểm tra tình trạng kho theo khoảng thời gian bạn chọn.",
    },
    {
      question: "Giá hiển thị đã bao gồm tiền cọc chưa?",
      answer:
        "Giá loại kho là giá thuê theo tháng. Tiền thuê theo thời hạn, tiền cọc và tổng số tiền cần thanh toán sẽ được hiển thị để bạn kiểm tra trước khi thanh toán.",
    },
    {
      question: "Sau khi thanh toán, tôi nhận kho như thế nào?",
      answer:
        "Theo dõi email và thông tin xác nhận của đơn thuê. Đến cơ sở theo lịch hẹn đã được xác nhận để nhân viên kiểm tra và hướng dẫn bàn giao kho.",
    },
  ],
  finalTitle: "Nhà gọn hơn.\nCuộc sống rộng mở hơn.",
  finalDescription: "Tìm không gian lưu trữ phù hợp và bắt đầu kế hoạch của bạn.",
  footerDescription:
    "Kết nối bạn với không gian lưu trữ phù hợp. Chọn kho, đặt thuê và tra cứu trực tuyến.",
  footerLinks: "Khám phá",
  footerHelp: "Dành cho bạn",
  copyright: "© 2026 MetaStorage. Tất cả quyền được bảo lưu.",
};
