# Backend Architecture & Patterns

## Overview

Backend sử dụng **Fastify + Node.js** được tổ chức theo mô hình **Modular Monolith** kết hợp **Feature-based / Vertical Slice Architecture**. 

> [!IMPORTANT]
> Không sử dụng Microservices, Event Sourcing hoặc CQRS đầy đủ trong scope dự án hiện tại.

---

## Core Patterns

### 1. Vertical Slice / Layering: Route → Service → Repository
- **Route / Controller**: Nhận HTTP request, validate input schema (Zod/TypeBox), gọi service tương ứng và trả về HTTP response. Không chứa business logic.
- **Service**: Nơi tập trung toàn bộ business logic và điều phối các workflow.
- **Repository (nhẹ)**: Đóng gói truy vấn database (Drizzle ORM). Không tạo Generic Repository hoặc abstraction nhiều tầng nếu không cần thiết.

### 2. State Machine
- Áp dụng cho các lifecycle phức tạp như **Booking**, **Rental**, **Reservation**.
- State transitions phải explicit và được kiểm tra chặt chẽ, nghiêm cấm việc cập nhật status tùy ý không qua transition logic.

### 3. Strategy Pattern
- Áp dụng cho các thành phần có nhiều provider thay thế, ví dụ: **Payment Gateway** (VNPay, Momo, Stripe, etc.).

### 4. Adapter Pattern
- Đóng gói các 3rd-party/external services (SMS, Mail, Cloud Storage, Push Notification) qua interface/adapter để tách rời khỏi core business logic.

### 5. Transaction Script & Database Transactions
- Sử dụng cho các business workflow.
- Mọi nghiệp vụ yêu cầu tính nhất quán (consistency) cao bắt buộc phải sử dụng **Database Transaction** và **Row-level Locking** (`FOR UPDATE`) khi cần tránh race conditions.

### 6. Idempotency Pattern
- Bắt buộc áp dụng cho webhook từ bên thứ ba (payment webhook) và các critical operations có thể bị gọi lặp lại.

### 7. Lightweight Domain Events & Background Jobs
- Dùng cho gửi notification, xử lý ngầm qua **BullMQ + Redis**.
- Worker chạy tách biệt tại `apps/worker`.

---

## Ví dụ Cấu trúc Thư mục theo Domain (Vertical Slice)

Backend tổ chức theo các module/domain tự chứa (self-contained), mỗi domain quản lý toàn bộ luồng từ route, service đến repository và state machine của chính nó:

```text
apps/api/src/
├── modules/                               # Các Domain / Feature Slices
│   ├── booking/                           # Domain Booking (Lifecycle & State Machine)
│   │   ├── booking.routes.ts              # Đăng ký HTTP endpoints (/api/bookings)
│   │   ├── booking.service.ts             # Business logic: validate dates, tính giá, chuyển trạng thái
│   │   ├── booking.repository.ts          # Truy vấn Drizzle: findById, create, updateWithLock
│   │   ├── booking.state-machine.ts       # Định nghĩa transitions theo policy Booking đã chốt
│   │   ├── booking.schemas.ts             # Zod validation schema cho request body & query
│   │   └── booking.types.ts               # Types nội bộ của module booking
│   │
│   ├── payment/                           # Domain Payment (Strategy & Idempotency)
│   │   ├── strategies/                    # Strategy Pattern cho các cổng thanh toán
│   │   │   ├── payment-strategy.interface.ts # Interface chuẩn (createPayment, verifyWebhook)
│   │   │   ├── vnpay.strategy.ts          # Triển khai cho VNPay
│   │   │   └── momo.strategy.ts           # Triển khai cho Momo
│   │   ├── payment.routes.ts              # Endpoints checkout & webhook callback
│   │   ├── payment.service.ts             # Điều phối: chọn strategy, ghi transaction, trigger job
│   │   ├── payment.repository.ts          # Drizzle query cho bảng transactions, payments
│   │   └── payment.idempotency.ts         # Kiểm tra idempotency key tránh duplicate payment
│   │
│   └── rental/                            # Domain Rental / Space Management
│       ├── rental.routes.ts
│       ├── rental.service.ts
│       ├── rental.repository.ts
│       └── rental.schemas.ts
│
├── common/                                # Shared infrastructure & adapters
│   ├── adapters/                          # Adapter Pattern cho external services
│   │   ├── mailer/                        # Adapter gửi email (Resend, SMTP)
│   │   │   ├── mailer.interface.ts
│   │   │   └── resend.adapter.ts
│   │   └── storage/                       # Adapter upload file (S3, Cloudinary)
│   │       ├── storage.interface.ts
│   │       └── s3.adapter.ts
│   ├── database/                          # Kết nối Drizzle & helper transaction
│   │   ├── db.ts
│   │   └── transaction.ts                 # Helper chạy db.transaction(...) với row lock
│   ├── plugins/                           # Fastify plugins (cors, auth, error-handler)
│   │   ├── auth.plugin.ts
│   │   └── error-handler.plugin.ts
│   └── errors/                            # Domain exceptions (NotFoundError, BadRequestError)
│
├── app.ts                                 # Đăng ký các module routes & global plugins
└── index.ts                               # Khởi động server HTTP Fastify
```

### Minh họa luồng thực thi trong một Domain (Ví dụ: Xác nhận Booking)

Các transition cancellation, reschedule và no-show đã chốt nằm tại [Booking policy](./booking-cancellation-policy.md).

```text
[HTTP Request: POST /api/bookings/:id/confirm]
       │
       ▼
booking.routes.ts        ──> Validate schema (params, body)
       │
       ▼
booking.service.ts       ──> Gọi db.transaction():
       │                       1. booking.repository.ts: Lấy booking + FOR UPDATE
       │                       2. booking.state-machine.ts: Kiểm tra transition hợp lệ
       │                       3. booking.repository.ts: Cập nhật status mới
       │                       4. BullMQ queue: Đẩy job gửi email xác nhận vào worker
       │
       ▼
[HTTP Response: 200 OK]
```
