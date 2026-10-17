---
name: metastorage-backend-endpoint
description: Implement or update Fastify backend endpoints in metastorage using agreed business rules, shared Zod contracts, TDD, and Route → Service → Repository. Use for backend API implementation; keep frontend and API client changes outside scope unless requested.
---

# Phát triển endpoint backend

Trình tự phát triển: **Chốt nghiệp vụ → contract → test → repository → service (map khi cần) → route → kiểm tra.**

Luồng request: **Route → Service → Repository → Database**, sau đó service trả DTO cho route.
Tuân thủ `AGENTS.md` hiện hành và chỉ dẫn người dùng. Skill không cấp quyền deploy,
commit, push, thay đổi dữ liệu thật hoặc mở rộng task.

## 1. Xác định phạm vi và chốt nghiệp vụ

- Kiểm tra working tree; giữ thay đổi có sẵn và đọc lại file nếu có sửa đồng thời.
- Đọc module liên quan, cách đăng ký routes, response/error helpers và một endpoint tương tự.
  Đọc `docs/backend-patterns.md` khi cần chi tiết kiến trúc; chỉ đọc policy của domain liên quan.
- Xem issue được cung cấp, quyết định nghiệp vụ và contracts/callers hiện có để tránh xung đột.
  Nêu phần chưa xác minh nếu thiếu issue/policy cần thiết; không tự nhận đã kiểm tra.
- Tuân thủ quy tắc phân tích ảnh hưởng của repo, trừ khi người dùng đã miễn bước đó.
- Trình bày ngắn: method/path, actor và quyền/phạm vi truy cập, input, output,
  HTTP status, quy tắc nghiệp vụ, lỗi dự kiến và ca test.
- Xác nhận quyết định chưa chốt trước khi triển khai. Dùng lại thông tin/phê duyệt trong phiên,
  không hỏi lại. Ghi quy tắc chưa rõ là `TBD`; chưa triển khai phần phụ thuộc cho đến khi đạt
  ngưỡng hiểu nghiệp vụ theo `AGENTS.md`.

## 2. Contract dùng chung

- Mỗi file domain trong `packages/contracts/src/<domain>.ts` gồm enum của domain,
  schema input, params và query, cùng type suy ra từ các schema đó. Khai báo enum ngay
  trong file contract domain; Drizzle import enum từ contract để database và code dùng
  chung một nguồn giá trị. Không tạo file enum riêng ở `shared` hoặc khai báo lại
  danh sách giá trị trong schema database. Type/interface output đặt ở `<domain>.types.ts`
  và re-export qua file domain. Không thêm schema output vào file domain.
- Chỉ tạo schema Zod cho input (body), params và query trong feature tương ứng ở
  `packages/contracts`; export qua entrypoint hiện có. Suy ra type input bằng `z.infer`.
  Dữ liệu trả về dùng type/interface TypeScript chung; không tạo schema Zod để kiểm tra
  output, không `.parse()` response và không khai báo `schema.response` trên route.
- Input chỉ chứa trường client được phép gửi; không dùng kiểu insert database làm public
  request contract. Schema body xử lý trường ngoài danh sách theo convention của repo;
  không chuyển nguyên body xuống database.
- Tạo type DTO theo mục đích khi đầu ra khác nhau: list item, detail, create result.
  Dùng `Pick`/`Omit` khi phù hợp; không tạo biến thể chưa có endpoint dùng.
  Trường optional chỉ khi thật sự có thể vắng mặt trong loại response đó.
- Phân biệt chuỗi ISO trong JSON với `Date` ở database, `null` với trường bị bỏ qua.
- Type response mô tả envelope thực tế, gồm data/message/timestamp.
  Tái sử dụng helper hiện có. Nếu các package có envelope khác nhau, giải quyết phần cần cho
  endpoint và báo ảnh hưởng; không âm thầm đổi mọi endpoint.
- Thông báo hướng tới client nằm trong `*.messages.ts` của feature, kể cả validation message
  tùy chỉnh. Interface nội bộ nằm trong `*.types.ts`/`*.interface.ts` cạnh feature.

## 3. Test trước implementation

- Dùng framework/test commands đã có. Nếu workspace chưa có runner, chọn giải pháp tối thiểu
  phù hợp repo và bảo đảm test mới được lệnh test workspace/CI chạy.
- Viết test theo ca nghiệp vụ đã thống nhất; chạy để xác nhận lỗi đúng hành vi còn thiếu.
- Chọn ca liên quan: thành công, validation, quyền/phạm vi, not found, conflict hoặc concurrency
  khi nghiệp vụ yêu cầu. Không tạo test theo giả định chưa được chốt.
- Dùng `app.inject()` khi phù hợp để kiểm tra status, envelope, DTO và không trả trường nhạy cảm.
  Mock DB không chứng minh constraint/transaction thật; dùng integration test khi tính đúng đắn
  phụ thuộc chúng.

## 4. Repository: truy vấn

- Tái sử dụng/bổ sung method trong repository của feature; không tạo generic repository.
- Chọn cột cần cho luồng, join/filter tại database. Không tạo method riêng cho mỗi DTO nếu
  truy vấn hiện có đã đáp ứng. Repository trả dữ liệu lưu trữ/projection nội bộ, không public DTO.
  `create`/`update` có thể trả bản ghi đầy đủ cho service dùng nội bộ.
- Áp dụng predicate đúng ID và phạm vi, tránh update toàn bảng. Theo convention timestamp,
  kết quả không tìm thấy và lỗi insert hiện có.
- Database constraint bảo đảm uniqueness khi có request đồng thời; pre-check không thay thế
  constraint. Chuyển conflict đã biết thành lỗi nghiệp vụ, không biến mọi lỗi DB thành conflict.
- Chỉ đổi schema khi endpoint cần. Khi đó đọc `docs/db-diagram.md`, chốt chi tiết còn thiếu,
  cập nhật diagram cùng Drizzle schema rồi chạy `bun run db:generate`. Không sửa migration
  sinh tự động hoặc chạy migration vào database thật ngoài phạm vi được phép.

## 5. Service: nghiệp vụ và DTO

- Service điều phối business rules và repository/adapters. Guard kiểm tra authentication/quyền
  tổng quát; service kiểm tra ownership/facility scope theo policy, không chỉ tin ID client gửi.
- Dùng transaction cho các thao tác cần nhất quán, cùng transaction context ở các repository.
  Row lock/idempotency/state machine chỉ khi luồng yêu cầu.
- Dùng contract chung từ `packages/contracts`; map rõ ràng ngay trong service khi cần:
  allowlist trường, chuyển ngày sang ISO, xử lý nullable theo policy và bổ sung dữ liệu đã lấy/tính.
- Chỉ tách `*.mapper.ts` khi có lợi ích cụ thể, như phép chuyển đổi được dùng lại hoặc đủ phức tạp
  để tách ra giúp service dễ đọc. Không mặc định mỗi module/endpoint phải có mapper riêng.
- Nếu dữ liệu đã khớp DTO và các trường trả về đã được chọn rõ ràng, không thêm bước map
  chỉ để sao chép object. TypeScript không lọc trường runtime; service/repository phải chọn
  trường thực tế, không dựa vào response schema. Mapper tách riêng là hàm thuần; không query DB, gọi dịch vụ ngoài,
  kiểm tra quyền hoặc quyết định nghiệp vụ.
- Không trả database row ra HTTP, spread toàn row vào DTO, hoặc ép kiểu DTO để che sai shape.
  Annotation, `Pick`/`Omit` và `satisfies` không xóa trường runtime.
- Khi thêm trường output: cập nhật type, truy vấn/tính toán, phần tạo DTO và test. Khi bỏ trường:
  cập nhật type/phần tạo DTO và kiểm tra caller bị ảnh hưởng.
- Với create user, đọc policy auth nếu tạo tài khoản đăng nhập. Insert `users` chưa tạo
  credential/session Better Auth. Chốt account, mật khẩu, verification, role/status và side
  effects trước khi chọn luồng tạo; không mặc định đây là public signup.

## 6. Route: kết nối HTTP

- Dùng Zod type provider và validator compiler đã cấu hình cho input.
- Khai báo schema cho params/query/body cần thiết. Không khai báo schema cho dữ liệu trả về;
  kiểm soát output bằng type TypeScript và chọn trường thực tế trong service/repository.
- Route chỉ nhận input đã validate, gọi service, gửi envelope/status đã chốt;
  không chứa truy vấn DB hoặc business logic. Dùng guard/error handler hiện có.
- Đăng ký route trong app nếu chưa được gắn; xác nhận truy cập qua prefix đúng.

## 7. Kiểm tra và bàn giao

- Chạy test liên quan, type-check API/packages bị thay đổi, Biome trên file đã sửa và kiểm tra diff.
  Dùng Bun từ repo root; mở rộng kiểm tra khi thay đổi có ảnh hưởng rộng.
- Xác minh endpoint qua HTTP hoặc `app.inject()` với thành công/lỗi quan trọng;
  kiểm tra response sau serialization, không chỉ giá trị service trả về.
- Nếu backend ảnh hưởng UI hiện có, kiểm tra browser theo `AGENTS.md`; không tự xây UI mới.
  Nêu rõ nếu thiếu môi trường xác minh.
- Báo endpoint, hành vi/contract, kiểm tra đã chạy và giới hạn thực tế
  (ví dụ mock DB, chưa kiểm tra PostgreSQL). Không nhận hoàn thành bước chưa chạy.

## Giữ task gọn

- Task chỉ repository/service: áp dụng bước liên quan, không tự sinh endpoint/DTO mới.
- Không sửa FE/Mobile/API client/mocks cho task chỉ backend. Có thể đọc consumers để kiểm tra
  compatibility và báo việc cần cập nhật ngoài phạm vi.
- Không scaffold CRUD đầy đủ, thêm framework/dependency, tạo abstraction/helper chung hoặc
  refactor module khác nếu endpoint hiện tại không cần.
- Không tạo kế hoạch dài, tài liệu lặp lại hay vòng duyệt bổ sung cho quyết định đã chốt.
