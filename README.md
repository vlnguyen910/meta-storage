# metastorage Monorepo

Dự án monorepo được quản lý bởi **Turborepo** và **Bun**, sử dụng **TypeScript** từ frontend tới backend.

## 🏗️ Cấu trúc dự án

```text
metastorage/
├── apps/
│   ├── api/                   # Backend Node.js + Fastify + TypeScript
│   │   ├── src/
│   │   │   ├── common/        # Database, lỗi, logger, plugins dùng chung
│   │   │   ├── modules/       # Các feature module (users, ...)
│   │   │   ├── app.ts         # Fastify app factory & plugins
│   │   │   └── index.ts       # Server entry point
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── mobile/                # Mobile React Native + Expo + NativeWind + TypeScript
│   │   ├── App.tsx            # Root component với NativeWind styling
│   │   ├── global.css         # Tailwind & NativeWind CSS
│   │   ├── metro.config.js    # Metro bundler config với NativeWind & Monorepo
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/                   # Frontend React + Next.js (App Router) + TypeScript
│       ├── src/app/           # Next.js App Router (layout, page, css)
│       ├── public/
│       ├── next.config.ts
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   ├── database/              # PostgreSQL + Drizzle ORM (schema, client, migrations)
│   │   ├── src/
│   │   │   ├── schema/        # Table schemas (users, bookings, ...)
│   │   │   ├── client.ts      # Drizzle client kết nối qua postgres.js
│   │   │   └── index.ts       # Export db, client, schemas, operators
│   │   ├── drizzle/           # Thư mục chứa file SQL migration sinh bởi drizzle-kit
│   │   ├── drizzle.config.ts  # Cấu hình drizzle-kit
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── shared/                # Package chia sẻ dùng chung giữa FE và BE
│   │   ├── src/index.ts       # Shared types, models, constants, utilities
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── typescript-config/     # Cấu hình tsconfig dùng chung
│       ├── base.json          # Strict base TypeScript config
│       ├── nextjs.json        # Next.js specific TypeScript config
│       ├── node.json          # Node.js specific TypeScript config
│       └── package.json
├── docker/
│   └── docker-compose.yml      # PostgreSQL và Redis cho local development
├── .husky/
│   └── pre-commit             # Git hook chạy Biome check trước khi commit
├── biome.json                 # Cấu hình linter & formatter (Biome)
├── turbo.json                 # Cấu hình task pipelines cho Turborepo
├── package.json               # Root monorepo configuration
└── README.md
```

---

## 🚀 Công nghệ sử dụng

- **Monorepo Manager**: [Turborepo](https://turbo.build/repo) (v2)
- **Package Manager**: [Bun](https://bun.com)
- **Frontend Web**: [Next.js](https://nextjs.org) 15 (App Router) + [React](https://react.dev) 19 + TypeScript
- **Frontend Mobile**: [Expo](https://expo.dev) (SDK 57) + [React Native](https://reactnative.dev) + [NativeWind](https://nativewind.dev) (v5 / Tailwind CSS v4) + TypeScript
- **Backend**: [Node.js](https://nodejs.org) + [Fastify](https://fastify.dev) + TypeScript (dev với `tsx`, build với `tsup`)
- **Database & ORM**: [PostgreSQL](https://www.postgresql.org) + [Drizzle ORM](https://orm.drizzle.team) + [drizzle-kit](https://orm.drizzle.team/kit-docs/overview)
- **Linter & Formatter**: [Biome](https://biomejs.dev)
- **Git Hooks**: [Husky](https://typicode.github.io/husky)

---

## 🛠️ Hướng dẫn cài đặt & chạy dự án

### 1. Cài đặt dependencies

```bash
bun install
```

### 2. Khởi động PostgreSQL và Redis bằng Docker Compose

Docker Compose cung cấp PostgreSQL local với các thông tin kết nối mặc định:

- **Host**: `localhost`
- **Port**: `5433` (cổng PostgreSQL trong container: `5432`)
- **Database**: `metastorage`
- **User**: `postgres`
- **Password**: `postgres`

Redis local dùng `redis://localhost:6379`, chỉ mở cổng trên loopback. Service có
healthcheck, lưu AOF trong volume `redis_data` và dùng `noeviction` để tránh tự
loại bỏ dữ liệu phiên hoặc BullMQ jobs. Các key tạm thời phải được ghi kèm TTL.

Khởi động database:

```bash
docker compose -f docker/docker-compose.yml up -d
```

Nếu chỉ cần Redis (ví dụ PostgreSQL đang chạy trên cloud):

```bash
docker compose -f docker/docker-compose.yml up -d --wait redis
docker compose -f docker/docker-compose.yml exec redis redis-cli ping
```

Kiểm tra trạng thái:

```bash
docker compose -f docker/docker-compose.yml ps
```

Dừng database nhưng giữ lại dữ liệu:

```bash
docker compose -f docker/docker-compose.yml down
```

Muốn xóa cả volume dữ liệu local:

```bash
docker compose -f docker/docker-compose.yml down -v
```

> Lệnh `down -v` sẽ xóa toàn bộ dữ liệu PostgreSQL và Redis local. Dùng lệnh này nếu volume đã được tạo từ cấu hình database cũ và cần khởi tạo lại.

### 3. Cấu hình biến môi trường

API tự động đọc file `apps/api/.env`. Tạo file từ mẫu nếu chưa có:

```bash
cp apps/api/.env.example apps/api/.env
```

Để chạy với PostgreSQL trong Docker Compose, giữ `DATABASE_URL` như sau:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5433/metastorage
REDIS_URL=redis://localhost:6379
```

API đăng ký Redis trong `common/redis/plugin.ts`; các module dùng `fastify.redis`.
Các thao tác dữ liệu tạm dùng `fastify.redisService` hoặc inject `RedisService`
vào constructor của service/module cần dùng. Client `fastify.redis` dành cho
lệnh nâng cao như Lua/transactions khi feature thực sự cần atomic workflow.

```ts
await fastify.redisService.set("feature:resource:123", "value", 300);
const value = await fastify.redisService.get("feature:resource:123");
const created = await fastify.redisService.setIfAbsent("feature:resource:123", "value", 300);
await fastify.redisService.delete("feature:resource:123");
```

`set` và `setIfAbsent` bắt buộc TTL là số nguyên dương tính bằng giây.
`setIfAbsent` dùng `SET EX NX` nguyên tử; trả `false` nếu key đã tồn tại và giữ
nguyên value/TTL cũ. `exists` trả boolean; `getTtl` trả giây còn lại (`-2`: không
có key, `-1`: key không có expiry). Feature tự quản lý prefix, serialization,
validation và business rules; Redis errors được truyền về caller để xử lý.

API kiểm tra kết nối khi khởi động, từ chối khởi động nếu Redis không kết nối được,
và đóng client khi shutdown. Các lệnh Redis có timeout; không giữ lệnh trong
offline queue khi mất kết nối. Worker tiếp tục dùng kết nối riêng cho BullMQ;
nếu chạy worker local, đặt cùng `REDIS_URL` trong môi trường của worker.

Kiểm chứng plugin với Redis thật bằng database Redis riêng cho test. Test chỉ
tạo và xóa key có prefix/ngẫu nhiên, không chạy `FLUSHDB`:

```bash
REDIS_TEST_URL=redis://localhost:6379/15 bun run --filter api test
```

API mặc định chạy tại port `4000`. Có thể thay đổi port trong `apps/api/.env`.

### 4. Chạy môi trường phát triển (Dev)

Chạy đồng thời cả Frontend và Backend:

```bash
bun run dev
```

- **Web (Next.js)**: [http://localhost:3000](http://localhost:3000)
- **API (Fastify)**: [http://localhost:4000](http://localhost:4000)
- **API health check**: [http://localhost:4000/api/health](http://localhost:4000/api/health)
- **API users**: `/api/users`

Chạy riêng lẻ từng app:

```bash
# Chỉ chạy API Backend
bun run --filter api dev

# Chỉ chạy Web Frontend
bun run --filter web dev

# Chạy Mobile App (Expo)
bun run --filter mobile dev
# Hoặc chạy trực tiếp trên simulator / device
bun run --filter mobile android
bun run --filter mobile ios
```

### 5. Build dự án

```bash
bun run build
```

### 6. Kiểm tra Type & Linter

```bash
# Kiểm tra TypeScript type checking toàn bộ repo
bun run check-types

# Kiểm tra Linter & Formatter với Biome
bun run check

# Tự động sửa lỗi Lint & Format với Biome
bun run check:fix

# Format code với Biome
bun run format
```

### 7. Quản lý Database (Drizzle ORM & PostgreSQL)

```bash
# Tạo migration SQL mới từ schema TypeScript
bun run db:generate

# Đẩy trực tiếp schema lên database (dùng khi prototype / development)
bun run db:push

# Chạy migration lên database PostgreSQL
bun run db:migrate

# Mở Drizzle Studio UI trực quan quản lý dữ liệu trên trình duyệt
bun run db:studio

# Tạo dữ liệu test: 10 facilities TP.HCM, mỗi facility có 8 unit types
bun run db:seed

# Xoá toàn bộ dữ liệu ứng dụng (kể cả tài khoản), giữ schema và migrations
bun run db:clear

# Seed lại sau khi dọn dữ liệu
bun run db:seed
```

Tên, địa chỉ và giá trong seed là dữ liệu giả lập để test. Seed giữ các booking
check-in mẫu tại `HCM-01` và có thể chạy lại mà không tạo bản ghi trùng. Để thay
dataset cũ (bao gồm cơ sở Hà Nội) bằng dataset mới, chạy `db:clear` rồi `db:seed`.
Cả hai lệnh dùng database được cấu hình qua `@metastorage/database/env`.

Kiểm thử vòng đời clear → seed trên **database riêng** có tên kết thúc bằng
`_seed_test` (đã chạy migrations):

```bash
SEED_TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/storex_seed_test \
  bun test packages/database/tests/seed.integration.test.ts
```

---

## 🐶 Git Hooks (Husky + Biome)

Mỗi khi thực hiện `git commit`, Husky sẽ tự động kích hoạt `.husky/pre-commit` để chạy:

```bash
bunx @biomejs/biome check --staged --files-ignore-unknown=true --no-errors-on-unmatched
```

Hook này sẽ kiểm tra linter & format chỉ trên các file được staged (`git add`), đảm bảo code chuẩn chỉ và sạch sẽ trước khi commit.
