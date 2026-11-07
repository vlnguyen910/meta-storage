import { StaffTaskDetailScreen } from "@/modules/facility-staff/staff-task-detail-screen";
export default async function StaffTaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  return <StaffTaskDetailScreen taskId={taskId} />;
}
