# metastorage Web Frontend Style Guide

Tài liệu này là nguồn thống nhất cho UI, styling và cách tổ chức code trong `apps/web`.
Mọi frontend pull request cần tuân theo tài liệu này cùng với `docs/web-patterns.md`.

## 1. Trạng thái UI stack hiện tại

Web hiện sử dụng:

- Next.js App Router và React.
- Tailwind CSS v4 qua `@tailwindcss/postcss`.
- Theme tokens khai báo bằng `@theme` trong `src/app/globals.css`.
- Tailwind utility classes trực tiếp trong JSX.
- Lucide React cho icon.
- React Hook Form + Zod cho form.
- TanStack Query cho server state và Zustand cho client state cần chia sẻ.

Web **chưa sử dụng shadcn/ui**:

- Không có `components.json` của shadcn.
- Không có Radix UI, CVA hoặc `tailwind-merge` trong `apps/web/package.json`.
- UI primitives hiện vẫn là component custom tại `src/components/ui`.

Không tự chạy `shadcn add` trong từng feature. Nếu team quyết định dùng shadcn/ui, cần có một
pull request foundation riêng để thống nhất `components.json`, aliases, variants và ownership.

## 2. Kiến trúc và ownership

```text
src/
├── app/                 # Next.js routes/layouts; chỉ là adapter mỏng
├── modules/             # Screen và orchestration theo actor
├── features/            # Nghiệp vụ dùng chung theo domain
├── components/
│   ├── ui/              # Presentational components dùng chung
│   └── layout/          # App shell, public layout, route guards
├── config/              # Routes, navigation và permissions theo actor
├── lib/                 # API initialization và utility chung
├── mocks/               # Mock core, handlers và seed data theo domain
└── app/globals.css      # Tailwind import, theme tokens và base reset
```

Chiều dependency bắt buộc:

```text
app → modules → features → @metastorage/api-client → @metastorage/contracts
              ↘ components / config / lib
```

Quy tắc ownership:

- `app/**/page.tsx` chỉ lấy route params và render một module screen.
- `modules/<actor>` chỉ chứa UI orchestration riêng của actor đó.
- Logic dùng bởi từ hai actor trở lên phải chuyển vào `features/<domain>`.
- `features` không được import từ `modules`.
- Route import trực tiếp screen file; không tạo barrel `modules/<actor>/index.ts`.
- Navigation, routes, permissions và mock dashboard phải sửa trong file của đúng actor.

## 3. Design tokens

Chỉ sử dụng theme token từ `src/app/globals.css` cho màu và hiệu ứng dùng chung.

| Token | Giá trị | Mục đích |
|---|---:|---|
| `--primary` | `#165F4D` | CTA chính, navigation active, brand |
| `--primary-dark` | `#0F493B` | Hover/pressed của primary |
| `--primary-soft` | `#E8F3EF` | Background nhấn nhẹ |
| `--secondary` | `#64748B` | Nội dung phụ và secondary action |
| `--accent` | `#107012` | Success và trạng thái tích cực |
| `--background` | `#FAFAFA` | Nền ứng dụng |
| `--foreground` | `#0F172A` | Nội dung chính |
| `--card` | `#FFFFFF` | Card, dialog và popover |
| `--border` | `#EEEEEE` | Divider và border nhẹ |
| `--ring` | `#94A3B8` | Focus ring |
| `--destructive` | `#EF4444` | Error và destructive action |
| `--warning` | `#D97706` | Warning và overdue state |
| `--radius` | `15px` | Card/dialog radius chuẩn |
| `--shadow` | `-2px 4px 12px 4px rgb(51 51 51 / 10%)` | Elevated surfaces |

Không hard-code màu mới trong module nếu màu đó mang ý nghĩa semantic. Nếu thiếu token, trao
đổi với người phụ trách UI và thêm token trước khi sử dụng.

## 4. Typography và spacing

- Sans-serif chính: `Inter`; trong lúc chưa bundle font, sử dụng system fallback đã cấu hình.
- Heading dùng font weight `700–850`, tracking âm nhẹ và không viết toàn bộ chữ hoa.
- Body mặc định dùng line-height khoảng `1.6–1.7`.
- Nội dung phụ sử dụng `--muted`; không giảm opacity tùy ý làm mất độ tương phản.
- Spacing ưu tiên các mốc `4, 8, 12, 16, 24, 32, 48, 64px`.
- Khoảng cách giữa các section lớn dùng `64–100px`; card content thường dùng `16–24px`.
- Không tạo giá trị lệch 1–2px nếu token spacing hiện có đã đáp ứng được bố cục.

## 5. Tailwind rules

### Global styles

`src/app/globals.css` chỉ dành cho:

- `@import "tailwindcss"`.
- `@theme` design tokens.
- Reset, base typography và accessibility defaults.

Không thêm component class, actor class hoặc business-specific selector vào `globals.css`.

### Utility classes

Component và screen dùng utilities trực tiếp:

```tsx
export function CheckInScreen() {
  return (
    <section className="grid gap-6 rounded-card border border-line bg-white p-6 shadow-soft">
      ...
    </section>
  );
}
```

- Dùng token utilities như `bg-primary`, `text-muted`, `border-line`, `rounded-card`.
- Tránh arbitrary value nếu Tailwind scale hoặc theme token đã đáp ứng được.
- Class theo điều kiện phải nằm dưới dạng chuỗi tĩnh trong mapping để Tailwind scan được.
- Dùng `cn()` từ `src/lib/cn.ts` để ghép class có điều kiện.
- Không dùng `!important`.
- Responsive utilities đặt cùng component sở hữu layout.
- Breakpoint chuẩn hiện tại: `1024px`, `800px`, `560px`.

## 6. Component rules

Kiểm tra `src/components/ui` trước khi tạo component mới.

- Common component không gọi API và không chứa business rule.
- Component nhận dữ liệu và callback qua props; không đọc Zustand nếu không phải global UI.
- Chỉ đưa component vào `components/ui` khi đã dùng hoặc chắc chắn sẽ dùng ở ít nhất hai nơi.
- Component đặc thù domain đặt trong `features/<domain>`.
- Screen phối hợp nhiều feature đặt trong `modules/<actor>`.

Button variants hiện có:

- `primary`: hành động chính duy nhất của khu vực hiện tại.
- `secondary`: hành động quan trọng cấp hai.
- `outline`: navigation hoặc action ít ưu tiên hơn.
- `ghost`: action phụ, quay lại hoặc toolbar action.
- `danger`: thao tác destructive có confirmation.

Mỗi card hoặc dialog chỉ nên có một primary action rõ ràng.

## 7. Forms và validation

- Form state dùng React Hook Form.
- Schema validation dùng Zod; ưu tiên schema từ `@metastorage/contracts` nếu API cũng dùng nó.
- Error hiển thị ngay dưới field và mô tả cách sửa, không chỉ ghi “Invalid”.
- Disable submit khi mutation đang chạy và hiển thị loading indicator.
- Destructive hoặc irreversible action cần confirmation dialog.
- Không log hoặc persist PAN, CVC, password hay token nhạy cảm.

## 8. Data và UI states

Mọi màn hình lấy dữ liệu phải xử lý đủ:

1. Loading/skeleton.
2. Error với retry phù hợp.
3. Empty state có hướng dẫn hành động tiếp theo.
4. Data state.
5. Success/error feedback sau mutation.

Server state dùng TanStack Query và query key thuộc feature sở hữu dữ liệu. Sau mutation phải
invalidate đúng query key; không tự đồng bộ nhiều bản copy dữ liệu trong Zustand.

## 9. Responsive và accessibility

- Thiết kế và kiểm tra tối thiểu ở `360px`, `768px` và `1280px`.
- Sidebar chuyển thành drawer ở viewport nhỏ; action chính vẫn phải truy cập được.
- Dùng semantic element: `button`, `nav`, `main`, `section`, `label`.
- Button luôn khai báo `type`.
- Interactive element phải dùng được bằng keyboard và có focus ring rõ ràng.
- Icon-only button bắt buộc có `aria-label`.
- Không dùng màu sắc làm tín hiệu trạng thái duy nhất; phải có label hoặc icon đi kèm.
- Text thường cần đạt tương phản WCAG AA.
- Tôn trọng `prefers-reduced-motion`.

## 10. Naming và file conventions

- Component/type: PascalCase.
- Function, variable và hook: camelCase; hook bắt đầu bằng `use`.
- File/folder: kebab-case.
- Screen: `<feature>-screen.tsx`.
- Test: đặt cạnh source với hậu tố `.test.ts` hoặc `.test.tsx`.
- Không tạo CSS Module hoặc stylesheet riêng nếu utility classes xử lý được yêu cầu.
- Không dùng `any`; dùng `unknown` và type guard khi input chưa xác định.
- Không hard-code role, permission, route hoặc status bằng magic string.

## 11. Pull request checklist

- Route page vẫn là thin adapter.
- Code đặt đúng actor module hoặc shared domain feature.
- Không tạo dependency ngược từ feature sang module.
- Không thêm business logic vào component UI.
- Đã dùng design token và component chung trước khi tạo mới.
- Có loading, error, empty và success state phù hợp.
- Kiểm tra keyboard, label, focus và responsive.
- Không chứa dead link hoặc action chưa hoạt động.
- TypeScript strict không có lỗi.
- Biome không có lỗi trên file thay đổi.
- Unit/component tests liên quan đã pass.

Quality gates mặc định từ repository root:

```bash
bun run --filter web check-types
bun run --filter web lint
bun run --filter web test
bun run --filter web build
```

E2E không nằm trong vòng kiểm tra mặc định hằng ngày; chỉ chạy khi được yêu cầu cho release
hoặc thay đổi flow quan trọng.
