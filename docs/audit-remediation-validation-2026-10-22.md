# Audit remediation — kiểm chứng ngày 22/10/2026

## Phạm vi thực hiện

Thực hiện 5 task còn trong `docs/plans/2026-10-22-audit-remediation.md` ở thời điểm
bắt đầu triển khai: worker image (#1), API unit tests (#6), database CI (#5),
proxy trust (#3), deploy gating/SHA (#4). Task reset password (#2) đã được bỏ khỏi
phần implementation trong bản kế hoạch người dùng cung cấp, nên chưa triển khai.

Đã đọc AGENTS.md, kế hoạch và các tài liệu local testing/CI trước khi sửa. Đã
đối chiếu GitHub issues #56, #57, #113 và danh sách PR đang mở bằng thao tác đọc.
Không sửa schema, generated migration hoặc nghiệp vụ payment/return.

## Thay đổi

- Worker Dockerfile copy source `packages/database` và `packages/contracts`
  trước khi bundle. Build trước sửa thất bại `Could not resolve
  "@metastorage/database"`; clean build sau sửa thành công.
- Lệnh API test chạy unit và integration trong hai process riêng.
- CI có job PostgreSQL 18/Redis 7 riêng, apply migrations và chạy `test:db`
  trực tiếp, không dùng cache kết quả DB của Turbo.
- Database runner bắt buộc URL test loopback khớp nhau, database có prefix riêng,
  Redis test DB rõ ràng và inspection opt-in. Mỗi suite chạy một process; runner
  kiểm tra JUnit và từ chối zero cases hoặc skip. Pricing chạy trước khi cài
  bốn setting defaults; không chạy demo seed.
- Database guard dùng chung hỗ trợ DB CI riêng, giữ opt-in của DB local cũ.
  Fixture inspections vẫn chấp nhận dedicated DB khi không khai báo biến local.
- Cleanup booking-identity xóa notification outbox thuộc fixture trước Booking.
- Test assignment tạo verification cho đúng booking thắng cuộc tranh ô kho,
  rồi xác minh đổi ô kho làm verification đó mất hiệu lực.
- Test WebSocket đóng các HTTP connections còn lại trước khi đóng Fastify.
  Bun 1.3.14 giữ kết nối upgrade bị từ chối làm cleanup cũ timeout sau 30 giây;
  thay đổi giữ nguyên 30 assertions và timeout, chỉ sửa cleanup.
- `TRUSTED_PROXY_CIDRS` mặc định false, chỉ nhận IP/CIDR cụ thể; từ chối wildcard,
  `/0`, địa chỉ/prefix sai và entry trống. Fastify dùng giá trị đã validate.
- Deploy workflow chuyển sang `workflow_call`; CI gọi sau cả quality/database,
  chỉ trên push staging. SSH validate và checkout đúng SHA đầu vào; kiểm tra API
  và worker sau start. Staging CI không cancel run khi có push mới.
- README/env examples có hướng dẫn Nginx chạy trên host, đối chiếu Docker gateway
  với `remoteAddress`, ghi đè forwarded headers và cập nhật env API container.

## Kết quả kiểm chứng

| Kiểm tra | Kết quả |
| --- | --- |
| Worker Docker clean build trước sửa | FAIL tại resolve database package, đã tái hiện |
| `docker build --no-cache -f apps/worker/Dockerfile -t metastorage-worker:audit-fix .` | PASS |
| Worker runtime từ image trên DB/Redis test rỗng | Running, DB connections tồn tại, log không lỗi; SIGTERM exit 0, không OOM |
| Migrations trên PostgreSQL test mới | 46 migrations PASS |
| DB runner bằng binary Bun 1.3.14 từ worker image | 18 suites, 214 pass, 0 fail, 0 skip |
| API test chuẩn | 51 unit + 81 integration pass; 242 cases opt-in skip ở job thường và được chạy ở DB job |
| Contracts tests | 27 pass |
| Web tests | 103 pass |
| Full `bun run test --force`, PATH trỏ Bun 1.3.14 | 3 workspace tasks PASS, không cache |
| `bun run check-types --force` | 8 tasks PASS, không cache |
| `bun run check` | PASS |
| `bun run build --force` | API, worker, web PASS, không cache |
| Actionlint cho hai workflow | PASS |
| SSH checkout script trên Git remote tạm ở `/tmp` | PASS: checkout checked SHA dù branch head mới hơn; từ chối non-SHA input |
| Guest lookup E2E desktop/mobile | 2 PASS; axe không có violation, không tràn ngang |
| Xem ảnh chụp guest lookup sau E2E | Desktop/mobile không thấy lỗi hiển thị |
| Fixture inspection chạy dedicated DB không có local URL opt-in | PASS |
| GitNexus detect_changes, gồm cả source/test files mới | 32 symbols, risk LOW; partial=false, truncated=false |

18 database suites: pricing, booking drafts/email/identity/payment/tracking,
hold expiry, assignment, WebSocket, Google OAuth, handover, inspections, Redis,
contracts, rental reads, reports, returns và system settings.

Proxy regressions kiểm tra IP khách qua trusted proxy, spoof từ untrusted peer,
chuỗi proxy có untrusted hop và mặc định không tin header. Test guest thật dùng
PostgreSQL/Redis xác minh client A hết quota không chặn B, còn quota theo Booking
vẫn giới hạn chung dù đổi IP.

## Môi trường và giới hạn

- PostgreSQL/Redis kiểm thử dùng container mới `metastorage-audit-postgres`
  (port 15433), `metastorage-audit-redis` (port 16379). Database tên
  `metastorage_inspection_test_*`; không chạy test/reset/seed trên DB demo
  `localhost:5433/metastorage`, không flush Redis local.
- Provider credentials là dữ liệu test. Google/payment/object storage được mock
  theo fixture; worker smoke dùng DB/queue rỗng để không gửi email thật.
- E2E giao diện tra cứu chạy mock mode trên port 3100. Nó kiểm chứng UI/axe,
  không thay thế các kiểm tra proxy/quota trên API thật. Ảnh nằm trong
  `apps/web/test-results/booking-lookup-{chromium,mobile}.png` (gitignored).
- Nginx được người dùng xác nhận chạy trực tiếp trên cùng VPS với API. Peer IP
  staging vẫn **TBD** cho đến khi đối chiếu gateway với API logs trên VPS; không
  tự dùng subnet/IP development. `docker/app.env.example` giữ giá trị trống.
- Chưa chạy workflow trên GitHub, SSH/restart staging hay production migrations.
  Đã kiểm tra cú pháp workflow và checkout script tại local.
- Các commit remediation đã tạo trên branch `fix/audit-remediation-2026-10-22`;
  chưa push. Thay đổi người dùng ở `task.md`, `.codex/skills/writting-plan/`
  được giữ riêng; không thuộc phần sửa ứng dụng này.

## Bước vận hành còn lại

1. Review diff, xác minh peer IP theo README, đặt `TRUSTED_PROXY_CIDRS` trên VPS.
2. Kiểm tra Nginx ghi đè forwarded headers và `nginx -t` pass.
3. Sau khi merge/push staging, đối chiếu SHA của CI với SHA trên VPS và kiểm tra
   API/worker cùng guest access quota qua domain HTTPS thực tế.
