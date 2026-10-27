# Kiểm tra CI/CD local — 19/10/2026

Phạm vi: working tree của nhánh `feat/inspect-unit-and-complete-handover-checklist`,
HEAD `7a2447b`, gồm các thay đổi chưa commit. Không phải kết quả GitHub Actions trên remote.
Dùng Bun **1.3.14**, đúng phiên bản trong workflow, qua `npx --yes bun@1.3.14`.

## CI chuẩn

Nguồn: [ci.yml](../.github/workflows/ci.yml) và [AGENTS.md](../AGENTS.md).

| Bước | Lệnh | Kết quả |
| --- | --- | --- |
| Dependencies | `bun install --frozen-lockfile` | PASS |
| Biome | `bun run check` | PASS |
| Type-check | `bun run check-types` | PASS, 8 task/workspace |
| Test | `bun run test` | PASS, 3 task |
| Production build | `bun run build` | PASS, 3 task (API, worker, web) |

Chi tiết test chuẩn: API 61 pass / 162 skip / 0 fail; contracts 27 pass;
web 70 pass. Mobile không có script test/build trong pipeline này; đã qua type-check.
Các test DB/Redis opt-in không tự chạy trong CI hiện tại vì workflow không cấp test URL.

## Kiểm tra bổ sung theo AGENTS.md

E2E chạy bằng `bun x playwright test --config flow2.playwright.config.ts` trong `apps/web`:

- 32 ca Flow 2 UI pass: phân công, đổi kho, scope FM/FS, checklist, lưu nháp,
  reload, khóa biên bản, bàn giao, lỗi API và axe trên desktop/mobile.
- Ca cookie/login/proxy ban đầu fail do form có thể submit trước hydration.
  Đã sửa LoginForm: khóa email/password/nút submit đến khi hydrate; form dùng POST.
- Chạy lại ca login/cookie/proxy và thêm ca chặn JavaScript trước hydration:
  2/2 pass. Tổng cộng 34 ca E2E riêng biệt pass sau sửa.
- Chạy lại 70 test web, type-check và build sau sửa login.
- Kiểm tra trình duyệt local: manager HCM-03 đăng nhập và thấy booking thật;
  không có JavaScript error hay request chứa query parameter `password`.

DB riêng: `metastorage_inspection_test_ci_20261019`; Redis riêng trong container
`storex-redis`, logical DB 14. Không chạy integration vào `storex_local`.
Lệnh cho mỗi suite dùng `RUN_INSPECTION_DB_TESTS=1 NODE_ENV=test`, DATABASE_URL
trỏ DB riêng và REDIS_URL/REDIS_TEST_URL trỏ Redis test.

| Suite | Kết quả |
| --- | --- |
| `inspections.integration.test.ts` | PASS, 50 assertions |
| `handover.integration.test.ts` | PASS, 48 assertions |
| `flow2-assignment.integration.test.ts` | FAIL, chạy lại vẫn fail |
| `flow2-websocket.integration.test.ts` | FAIL, timeout 30 giây, 30 assertions đã chạy |

Lỗi assignment tại `apps/api/tests/integration/flow2-assignment.integration.test.ts:115`:
expected verification `INVALIDATED`, actual `VERIFIED`. Test cho hai booking tranh một ô kho,
nhưng luôn kiểm tra verification của booking fixture gốc bất kể booking nào thắng.
Đây là điểm bất nhất trong cách dựng/assert test cần xử lý; chưa kết luận phải sửa backend.

Test WebSocket chưa hoàn tất trong timeout; cần xác định bước chờ/cleanup kết nối.
Không nhận test này đã pass chỉ vì các assertion trước timeout đã chạy.
Không sửa backend hay hai integration test này trong lần kiểm tra CI/CD.

## CD kiểm tra tại local

Nguồn: [deploy-stagging.yml](../.github/workflows/deploy-stagging.yml).

| Bước | Kết quả |
| --- | --- |
| Validate Compose production, không resolve env thật | PASS |
| Build `apps/api/Dockerfile`, tag `storex-ci-api:local` | PASS |
| Build `apps/worker/Dockerfile`, tag `storex-ci-worker:local` | PASS |
| Build API target `build`, tag `storex-ci-migrations:local` | PASS |
| Chạy đúng lệnh migration container trên DB rỗng riêng | PASS |
| Chạy API image với NODE_ENV=production | PASS, HTTP 200 và `database.status=connected`, Docker healthy |
| Chạy worker image với Redis riêng, queue rỗng | PASS, process running |
| SSH / checkout remote / restart staging | Chưa chạy; không deploy server trong lần kiểm tra local |

DB smoke CD: `storex_ci_cd_smoke_20261019`. Worker dùng logical Redis DB 12,
API smoke dùng DB 13; thông tin mail chỉ là placeholder, không kiểm thử gửi mail.
Không xác minh Resend/SePay thực tế hoặc secrets/network trên VPS.
Các container smoke được dừng sau kiểm tra; frontend 3000 và backend 8080 của người dùng giữ chạy.

Workflow CD hiện kích hoạt độc lập khi push nhánh `stagging`; file workflow không có bước
chờ kết quả workflow CI. Vì vậy CI pass và CD production-ready là hai kết luận riêng.

## Log chi tiết

Log nằm trong `/tmp/storex-ci-*`: `install.log`, `check.log`, `types-final.log`,
`tests.log`, `build-final.log`, `flow2-e2e.log`, `login-fix-e2e.log`,
`login-fix-unit.log`, `flow2-assignment-db.log`, `flow2-assignment-retry.log`,
`flow2-websocket-db.log`, `inspections-db.log`, `handover-db.log`,
`docker-api.log`, `docker-worker.log`, `docker-migrations.log`, `cd-migrate.log`.
