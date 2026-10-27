import { PageHeader } from "@/components/ui/display";
import { FacilityList } from "@/features/facilities/facility-list";

export function CustomerFacilitiesScreen() {
  return (
    <>
      <PageHeader
        eyebrow="Tìm kiếm kho"
        title="Chọn cơ sở kho lưu trữ"
        description="Xem danh sách cơ sở kho còn trống và bắt đầu đặt chỗ thuê kho."
      />
      <FacilityList protectedMode />
    </>
  );
}
