# Engineering Principles

Dưới đây là 20 nguyên tắc kỹ thuật cốt lõi của dự án **storeX**. Mọi thành viên và AI Agent bắt buộc phải tuân thủ nghiêm ngặt.

1. **Ưu tiên đơn giản & dễ maintain**: Giữ kiến trúc đơn giản, tránh cấu trúc rườm rà.
2. **Không overengineer**: Không thiết kế trước cho các nhu cầu chưa tồn tại.
3. **Feature/Domain-driven organization**: Tổ chức code theo feature/domain thay vì chỉ phân chia theo technical layer.
4. **Không để logic trong UI/Route**: Business logic không được nằm trong route, screen hoặc UI component.
5. **Database là Single Source of Truth**: Database là nơi duy nhất giữ chân lý cho dữ liệu nghiệp vụ.
6. **Tách biệt external services**: Dịch vụ bên ngoài phải được bọc qua adapter/interface để độc lập khỏi core business logic.
7. **Explicit state transitions**: Chuyển trạng thái phải rõ ràng qua State Machine, không cho phép update status tùy ý.
8. **Consistency qua Database Transaction**: Mọi workflow cần tính nhất quán cao phải dùng database transaction (và row locking khi cần).
9. **Shared abstraction thực tế**: Chỉ tạo package hoặc abstraction dùng chung khi thực sự có sự tái sử dụng giữa ít nhất 2 nơi.
10. **Không lạm dụng Generic Repository**: Tránh abstraction nhiều tầng gây cản trở và khó debug.
11. **Tách biệt rõ 3 loại state**: Server state, client state và form state phải được quản lý riêng biệt bằng các công cụ phù hợp.
12. **Centralized API Client**: Web và Mobile bắt buộc gọi API thông qua centralized client, không gọi rải rác.
13. **Không expose Database Model**: Tuyệt đối không trả thẳng schema database ra frontend; luôn thông qua API contracts / DTO.
14. **Ưu tiên Composition hơn Inheritance**: Sử dụng component/function composition thay vì kế thừa phức tạp.
15. **Hạn chế thêm thư viện mới**: Không thêm framework, thư viện hoặc infrastructure mới nếu stack hiện tại đã giải quyết được vấn đề.
16. **Không chuyển sang Microservices**: Toàn bộ dự án giữ vững mô hình Monorepo + Modular Monolith trong scope hiện tại.
17. **Tuân thủ kiến trúc định sẵn**: AI Agent tuyệt đối không tự ý phát minh pattern, layer hoặc thư viện mới ngoài kiến trúc quy định.
18. **Giữ `TBD` cho nghiệp vụ chưa rõ**: Các quyết định nghiệp vụ chưa được xác nhận phải đánh dấu là `TBD`, không được tự suy đoán.
19. **Phù hợp với ràng buộc nhóm & thời gian**: Mọi lựa chọn kỹ thuật phải khả thi cho nhóm 4 người phát triển trong 10 tuần.
20. **Readability & Handover first**: Code phải ưu tiên tính dễ đọc, khả năng viết test và khả năng bàn giao hơn là các abstraction phức tạp.
