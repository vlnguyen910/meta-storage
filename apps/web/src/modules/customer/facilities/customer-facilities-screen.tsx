import { PageHeader } from "@/components/ui/display";
import { FacilityList } from "@/features/facilities/facility-list";

export function CustomerFacilitiesScreen() {
  return (
    <>
      <PageHeader
        eyebrow="Đặt kho mới"
        title="Chọn cơ sở"
        description="Xem tồn kho hiện tại và bắt đầu reservation."
      />
      <FacilityList protectedMode />
    </>
  );
}
