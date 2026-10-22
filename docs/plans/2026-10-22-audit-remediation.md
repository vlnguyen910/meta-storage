# Audit Remediation Implementation Plan

**Goal:** Xử lý sáu phát hiện của audit: worker Docker build, khôi phục mật khẩu, IP sau proxy, điều kiện deploy, integration test trong CI và API unit test.

**Architecture:** Giữ Monorepo + Modular Monolith hiện tại. Dùng Better Auth cho token và thay đổi mật khẩu, Resend adapter hiện có để gửi email, Fastify cho proxy trust, GitHub Actions cho kiểm tra và deploy. Không thêm thư viện, bảng dữ liệu hay hệ thống queue mới.

**Tech Stack:** Bun 1.3.14, TypeScript, Fastify, Better Auth 1.7.5, Next.js, Expo, PostgreSQL/Drizzle, Redis/BullMQ, Vitest/Bun test, Playwright, Docker Compose, GitHub Actions.

---

## Trạng thái và phạm vi

- Đây là kế hoạch đề xuất; chưa sửa ứng dụng, chạy migration hay deploy.
- Số phát hiện #1–#6 giữ nguyên như báo cáo audit. Thứ tự làm: #1 → #6 → #5 → #3 → #4.
- Audit trước đã chạy 40 policy/contract tests, contracts package test và kiểm tra IP bằng Fastify injection; type-check sử dụng cache. Chưa chứng minh Docker build bằng một lần build mới.
- Đã đối chiếu `docs/local-database-tests.md` và `docs/ci-cd-validation-2026-10-19.md`. Kết quả Docker PASS ngày 19/10 thuộc phiên bản cũ, không chứng minh source hiện tại đã build được. Hai lỗi assignment/WebSocket trong tài liệu cũ phải được chạy lại, không mặc định còn lỗi hoặc đã sửa.
- Chưa đối chiếu issue/PR remote. Khi thực thi, rà issue liên quan auth, deployment, booking/payment và testing trước khi sửa; ghi rõ nếu không truy cập được.
- Không đổi nghiệp vụ giá, hoàn tiền, giữ chỗ, kiểm tra kho hay trạng thái thuê. Không sửa generated migration.

## Quyết định cần chốt trước phần phụ thuộc

| Quyết định | Đề xuất | Trạng thái |
| --- | --- | --- |
| Nơi hoàn tất reset password | Một trang web `/reset-password` dùng cho cả yêu cầu từ web và mobile; mobile mở email bằng trình duyệt rồi người dùng quay lại app đăng nhập. Ít code hơn hai màn hình hoàn tất riêng. | Chờ duyệt; nếu bắt buộc native deep link thì bổ sung màn hình Expo và kiểm thử cold/warm start. |
| Chính sách reset | Link một lần, hết hạn 60 phút; password theo quy tắc signup; không tự đăng nhập; thu hồi session cũ sau reset; email không tồn tại vẫn trả thông báo chung. | Đề xuất, chưa coi là nghiệp vụ đã xác nhận. |
| Proxy production | Chỉ tin địa chỉ/CIDR của proxy thực tế; proxy ghi đè header đầu vào. Không dùng `trustProxy: true` cho mọi nguồn. | IP/CIDR và cấu hình reverse proxy: TBD. Docker có thể làm peer IP khác `127.0.0.1`. |

Các phần Docker và CI độc lập có thể làm trước khi chốt các mục trên. Không tự điền IP production hoặc quyết định native/web reset thay người dùng.

## Quy tắc khi thực thi

1. Kiểm tra working tree; giữ nguyên thay đổi người dùng, gồm `.codex/skills/writting-plan/`. Dùng checkout/worktree riêng khi cần để tránh trộn thay đổi.
2. Áp dụng @ponytail:ponytail; phần auth áp dụng @metastorage-backend-endpoint, UI áp dụng @metastorage-frontend-quality và @metastorage-mobile-quality khi phù hợp.
3. Với mỗi symbol cần sửa: chạy GitNexus context/impact upstream trước; báo callers, processes và risk. HIGH/CRITICAL phải thông báo; UNKNOWN phải xác minh thêm bằng text search. Không cần impact cho file kế hoạch thuần văn bản.
4. Với logic mới, viết test hành vi thất bại trước rồi sửa tối thiểu. Với Docker/YAML/scripts, dùng build thực hoặc kiểm tra workflow thay cho test chỉ so chuỗi cấu hình.
5. Messages đặt trong file feature-scoped; interfaces đặt trong file types/interface riêng. Tái sử dụng API client và mail adapter.
6. Trước mỗi commit: review diff, chạy kiểm tra phù hợp và `node .gitnexus/run.cjs detect-changes --scope all --repo .`; kết quả partial/truncated không được coi là kiểm tra sạch. Chỉ stage file thuộc task.

## Task 1 — Sửa worker image (#1)

**Files:** Modify `apps/worker/Dockerfile`; kiểm tra `apps/worker/tsup.config.ts`, `apps/worker/src/index.ts`, `packages/database/package.json`, `packages/shared/package.json`.

1. Chạy `docker build --no-cache -f apps/worker/Dockerfile -t metastorage-worker:audit-before .`; lưu lỗi resolve package nếu tái hiện. Nếu build thành công, tìm nguyên nhân trước khi sửa.
2. Thêm vào build stage, trước lệnh build:

   ```dockerfile
   COPY packages/database ./packages/database
   COPY packages/contracts ./packages/contracts
   ```

3. Chạy `docker build --no-cache -f apps/worker/Dockerfile -t metastorage-worker:audit-fix .`; kỳ vọng exit 0 và bundle đầy đủ workspace imports.
4. Chạy image trên PostgreSQL/Redis test riêng, cấu hình test credentials và queue rỗng. Kiểm tra worker giữ trạng thái running, truy cập DB/Redis được và shutdown sạch; không dùng queue production hoặc gửi email thật.
5. Thêm lệnh build worker image vào CI ở Task 3 để ngăn hồi quy. Commit đề xuất: `fix: include worker workspace sources in Docker build`.

## Task 2 — Đưa API unit tests vào lệnh chuẩn (#6)

**Files:** Modify `apps/api/package.json`; kiểm tra `apps/api/tests/units/**` và import/mocking của `apps/api/tests/integration/**`.

1. Chạy `bun test apps/api/tests/units` riêng để biết baseline; không tự sửa expectation nghiệp vụ nếu có fail.
2. Đổi script test tối thiểu thành:

   ```json
   "test": "bun test tests/units && bun test tests/integration --pass-with-no-tests"
   ```

   Hai process tách biệt tránh mock của unit tests tác động integration. Database suites cần process riêng được chạy trực tiếp ở Task 3.
3. Chạy `bun run --filter api test` với môi trường test đã kiểm tra; kỳ vọng log có unit suites, exit khác 0 nếu unit test fail.
4. Commit đề xuất: `test: include API unit tests in the default test command`.

## Task 3 — CI chạy database tests thật (#5)

**Files:** Modify `.github/workflows/ci.yml`, `apps/api/package.json`, `docs/local-database-tests.md`; Create `apps/api/tests/run-database-tests.ts`, `apps/api/tests/fixtures/test-database.ts`, `apps/api/tests/units/test-database.test.ts`.

**Test gates cần rà/sửa:** `apps/api/tests/integration/booking-payment-start.test.ts`, `booking-tracking.test.ts`, `booking-identity.test.ts`, `booking-email-access.test.ts`, `expire-capacity-holds.test.ts`, `pricing-postgres.test.ts`, `reports-postgres.test.ts`, `rentals-read.test.ts`, `rental-contracts.test.ts`, `returns.integration.test.ts`, `system-settings.integration.test.ts`, cùng `apps/api/tests/fixtures/inspection-fixture.ts`. Rà tiếp mọi `skipIf` và biến opt-in để không bỏ sót suite.

1. Lập danh sách từng suite, biến opt-in, DB guard, fixture/cleanup và mock provider. Đọc `docs/local-database-tests.md` trước mọi lần chạy local: không tạo/reset/reseed DB local dùng chung và không flush Redis.
2. Viết test cho guard dùng chung: chấp nhận DB test loopback có tên rõ ràng; từ chối URL production, URL không khớp biến test, và thiếu URL. Giữ nhánh local đã được cho phép hiện tại; không mở rộng điều kiện đó sang host bất kỳ.
3. Thay các guard hard-code `/metastorage` bằng helper trên, hỗ trợ thêm database CI `metastorage_inspection_test_ci`. Helper được dùng ở nhiều suite nên có lý do tồn tại. Chạy test guard trước và sau thay đổi.
4. Thêm job `database` dùng PostgreSQL/Redis services tạm thời trên GitHub runner. DB chỉ chứa fixture test, được khởi tạo bởi service; chạy migrations, không chạy demo seed. Dùng phiên bản PostgreSQL/Redis tương ứng Compose hiện tại.
5. Khai báo môi trường job từ bộ test credentials hiện có, thêm:

   ```text
   NODE_ENV=test
   DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/metastorage_inspection_test_ci
   BOOKING_TEST_DATABASE_URL=<bằng DATABASE_URL>
   MY_STORAGE_LOCAL_DATABASE_URL=<bằng DATABASE_URL>
   PRICING_TEST_DATABASE_URL=<bằng DATABASE_URL>
   REDIS_URL=redis://127.0.0.1:6379/14
   REDIS_TEST_URL=redis://127.0.0.1:6379/14
   RUN_INSPECTION_DB_TESTS=1
   ```

   Bổ sung biến cụ thể sau rà soát Step 1; không để chuỗi placeholder trong YAML thực thi.
6. Runner `run-database-tests.ts` kiểm tra env trước, chạy từng file opt-in bằng process `bun test <file>`, truyền env đầy đủ, dừng với exit khác 0 khi suite fail. Một số suite đóng Postgres client hoặc dùng module mocks nên không gộp vào một process. Thêm self-check cho fail-fast/missing-env; không chỉ dựa vào tổng exit 0 khi các suite đã skip.
7. Thêm script `test:db` gọi runner. CI chạy trực tiếp `bun run --filter api test:db`, không qua Turbo cache. Nhờ vậy không cần mở rộng Turbo env cho một test task vốn có thể cache DB results.
8. Chạy `bun run db:migrate`, sau đó `bun run --filter api test:db` trên services CI riêng. Kỳ vọng payment/capacity, tracking, pricing, contracts/handover, returns/lifecycle và Redis thực sự chạy; không có suite bắt buộc bị skip. Nếu có suite đòi DB rỗng độc lập, cấp DB riêng cho suite đó trong runner CI, không truncate dữ liệu chung.
9. Chạy lại assignment/WebSocket từng fail trong tài liệu ngày 19/10. Phân biệt lỗi fixture/timeout với lỗi nghiệp vụ; không bỏ test để làm pipeline xanh.
10. Bổ sung build worker Docker từ Task 1 và lưu kết quả test/build trong CI logs. Commit đề xuất: `ci: run database regressions against isolated services`.

## Task 4 — Nhận đúng client IP sau proxy (#3)

**Files:** Modify `apps/api/src/app.ts`, `apps/api/src/config/env.schema.ts`, `apps/api/src/config/env.messages.ts`, `apps/api/.env.example`, `docker/app.env.example`, `README.md`; Create `apps/api/tests/integration/proxy-ip.test.ts`; extend `apps/api/tests/integration/startup-env.test.ts`.

1. Xác nhận peer IP API thực sự thấy trong Docker deployment và proxy có ghi đè `X-Forwarded-For`; ghi lại vào tài liệu. IP/CIDR vẫn TBD cho đến khi xác minh.
2. Viết integration cases: hai clients qua trusted proxy có hai IP; client đi trực tiếp từ untrusted peer không giả IP bằng header; thiếu cấu hình thì không tin proxy.
3. Thêm `TRUSTED_PROXY_CIDRS` tùy chọn, validate địa chỉ/CIDR và chuyển thành danh sách cho Fastify `trustProxy`. Mặc định `false`; không chấp nhận wildcard hay boolean `true` để tin mọi peer.
4. Chạy `bun test apps/api/tests/integration/proxy-ip.test.ts apps/api/tests/integration/startup-env.test.ts`; kỳ vọng các ca trusted/untrusted/default đều pass.
5. Mở rộng test guest access thực: client A hết quota không chặn client B; quota theo booking vẫn dùng chung như trước. Kiểm tra magic-link exchange cũng nhận IP đã xác minh.
6. Cập nhật env example bằng hướng dẫn, không đoán IP gateway. Commit đề xuất: `fix: scope proxy trust for guest access rate limits`.

## Task 5 — Deploy đúng SHA sau tất cả checks (#4)

**Files:** Modify `.github/workflows/ci.yml`, `.github/workflows/deploy-stagging.yml`, `docs/ci-cd-validation-2026-10-19.md` hoặc tạo tài liệu validation mới thay vì sửa kết quả lịch sử.

1. Chọn cách ít thay đổi: chuyển workflow deploy thành reusable workflow `workflow_call`, nhận input `sha` bắt buộc. CI gọi workflow này bằng job `deploy`, `needs: [quality, database]`, chỉ khi `github.event_name == 'push' && github.ref == 'refs/heads/stagging'`.
2. Truyền `sha: ${{ github.sha }}` và chỉ secrets cần dùng. Không để deploy workflow tiếp tục trigger độc lập bằng `push`.
3. SSH action truyền SHA qua biến môi trường, xác minh chuỗi 40 ký tự hex, fetch ref cần thiết rồi `git checkout --detach "$DEPLOY_SHA"`; kiểm tra `git rev-parse HEAD` bằng SHA đó. Không checkout `origin/stagging` thay SHA đã kiểm tra.
4. Giữ thứ tự build → migrate → start → healthcheck hiện có. Thêm kiểm tra worker còn chạy; không chạy production migration trong lúc review workflow.
5. Giữ deploy concurrency riêng, không cancel deploy đang migrate. Điều chỉnh CI concurrency để push mới không hủy workflow có deploy đang chạy; lựa chọn đơn giản là không cancel run trên nhánh staging.
6. Kiểm tra YAML bằng công cụ hiện có và review biểu thức điều kiện. Ca bắt buộc: quality fail không deploy; database fail không deploy; PR không deploy; push staging pass deploy đúng SHA; push mới không làm run cũ checkout head mới.
7. Chạy thử trên môi trường staging được cho phép sau khi diff đã review; lưu SHA checks và SHA server để đối chiếu. Commit đề xuất: `ci: gate staging deployments on checks for the exact commit`.

## Nghiệm thu cuối

- `bun run check`, type-check không dựa vào cache cũ (`bun run check-types -- --force` nếu root script chuyển tiếp đúng cho Turbo), và test suites liên quan đều pass.
- CI chạy unit + DB regressions thực, build được worker Docker; thiếu test env phải fail, không xanh nhờ skip.
- Reset password hoàn tất với API thật trên web/mobile flow đã chọn; không lộ account existence/token; session policy đúng quyết định.
- Proxy trust đã kiểm chứng cả accepted và spoofed headers; quota của hai clients tách biệt.
- Staging chỉ deploy SHA đã qua mọi checks; worker/API khởi động và healthy/running.
- Không thay schema, không sửa dữ liệu demo dùng chung, không dùng production providers cho automated tests.
- Ghi lại các lệnh thực chạy, số pass/skip, screenshots UI và phần chưa kiểm tra. Không coi plan hoặc static review là kết quả nghiệm thu.

## Ước lượng sơ bộ

- Docker + unit test wiring: 0,5 ngày.
- Database CI + xử lý guard/fixture: 1–2 ngày, có thể tăng nếu tái hiện lỗi cũ.
- Proxy: 0,5 ngày sau khi biết topology thực tế.
- Reset password API + web/mobile flow + E2E: 1–2 ngày.
- Deploy gating + nghiệm thu: 0,5–1 ngày.

Tổng khoảng 3,5–6 ngày công, chưa tính thời gian chờ quyết định hoặc quyền truy cập staging. Không cần chia agent hay triển khai song song để hoàn thành kế hoạch.

## Tiến độ thực thi — 22/10/2026

- Task 1–3: đã triển khai và kiểm chứng local, gồm clean worker image build,
  runtime smoke, unit tests và 18 database suites (214 tests, không skip).
- Task 4: code, validation, quota regressions và hướng dẫn Nginx đã hoàn tất.
  User xác nhận Nginx chạy trực tiếp cùng VPS; peer IP thực tế chờ đối chiếu logs.
- Task 5: workflow gating và checkout SHA đã triển khai; actionlint và kiểm tra
  script với Git remote tạm pass. Chưa deploy staging.
- Task reset password không có trong bản implementation plan lúc thực thi;
  chưa triển khai các đề xuất reset còn trong bảng quyết định phía trên.
- Chi tiết thay đổi, kết quả và giới hạn nằm tại
  `docs/audit-remediation-validation-2026-10-22.md`.
