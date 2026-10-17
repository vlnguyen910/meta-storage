"use client";

import {
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Mail,
  Phone,
  RotateCw,
  Search,
  User,
  UserCheck,
  Warehouse,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, Currency, PageHeader, StatusBadge } from "@/components/ui/display";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { formatDate } from "@/lib/format";
import { useStaffTasks } from "./hooks";

interface StaffTasksViewProps {
  facilityId?: string;
  facilityName?: string;
}

export function StaffTasksView({ facilityId, facilityName }: StaffTasksViewProps) {
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const { data: tasks, isLoading, isError, isFetching, refetch } = useStaffTasks(facilityId);

  if (isLoading) return <LoadingState />;
  if (isError)
    return (
      <ErrorState message="Không thể tải danh sách nhiệm vụ được giao." onRetry={() => refetch()} />
    );

  const allTasks = tasks ?? [];
  const confirmedCount = allTasks.filter((t) => t.status === "CONFIRMED").length;
  const checkedInCount = allTasks.filter((t) => t.status === "CHECKED_IN").length;

  const filteredTasks = allTasks.filter((booking) => {
    if (filterStatus === "CONFIRMED" && booking.status !== "CONFIRMED") return false;
    if (filterStatus === "CHECKED_IN" && booking.status !== "CHECKED_IN") return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCode = booking.bookingCode.toLowerCase().includes(q);
      const matchName = booking.contactName.toLowerCase().includes(q);
      const matchPhone = booking.contactPhone.toLowerCase().includes(q);
      const matchUnit = booking.assignedUnit?.physicalUnitCode.toLowerCase().includes(q);
      return matchCode || matchName || matchPhone || matchUnit;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          eyebrow="Nhiệm vụ Nhân viên Cơ sở"
          title="Nhiệm vụ Check-in & Bàn giao"
          description={`Danh sách đơn đặt chỗ bạn được Quản lý phân công phụ trách tại ${facilityName || "cơ sở"}. Vui lòng kiểm tra thông tin ô kho và chuẩn bị đón tiếp khách hàng.`}
        />
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
          className="min-h-9 px-3 text-xs"
        >
          <RotateCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
          {isFetching ? "Đang làm mới..." : "Làm mới"}
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-muted mr-1">
              <Filter className="h-3.5 w-3.5" /> Lọc:
            </span>
            {[
              { id: "ALL", label: "Tất cả nhiệm vụ", count: allTasks.length },
              { id: "CONFIRMED", label: "Chờ đón tiếp (Confirmed)", count: confirmedCount },
              { id: "CHECKED_IN", label: "Đã bàn giao (Checked-in)", count: checkedInCount },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterStatus(tab.id)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                  filterStatus === tab.id
                    ? "bg-primary text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    filterStatus === tab.id
                      ? "bg-white/20 text-white"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder="Tìm theo mã, tên khách, SĐT, ô kho..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full border border-line bg-surface py-1.5 pl-9 pr-4 text-xs text-ink placeholder:text-muted outline-hidden focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
      </Card>

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <UserCheck className="h-12 w-12 text-muted/50 mb-3" />
          <h3 className="text-base font-bold text-ink">Chưa có nhiệm vụ nào được giao</h3>
          <p className="text-xs text-muted mt-1 max-w-sm">
            Hiện tại bạn chưa được phân công phụ trách đơn đặt chỗ nào trong bộ lọc này. Khi Quản lý
            phân công đơn mới, danh sách sẽ tự động cập nhật.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredTasks.map((booking) => (
            <Card
              key={booking.id}
              className="transition-all hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-base font-extrabold text-primary">
                      {booking.bookingCode}
                    </span>
                    <StatusBadge value={booking.status} />
                    {booking.assignedUnit ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" /> Ô kho:{" "}
                        {booking.assignedUnit.physicalUnitCode}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                        <Clock className="h-3 w-3" /> FM chưa gán ô kho
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted mt-1">
                    Cơ sở: <strong className="text-ink">{booking.facilityName}</strong> · Tạo ngày:{" "}
                    {formatDate(booking.createdAt)}
                  </p>
                </div>

                <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                  <UserCheck className="h-3.5 w-3.5" /> Bạn đang phụ trách
                </div>
              </div>

              {/* Booking Details Grid */}
              <div className="mt-4 grid grid-cols-4 gap-4 text-xs max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
                {/* Customer Snapshot */}
                <div className="space-y-1">
                  <span className="font-semibold text-muted flex items-center gap-1">
                    <User className="h-3.5 w-3.5" /> Thông tin khách hàng
                  </span>
                  <p className="font-bold text-ink text-sm">{booking.contactName}</p>
                  <p className="text-muted flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {booking.contactPhone}
                  </p>
                  <p className="text-muted flex items-center gap-1 truncate">
                    <Mail className="h-3 w-3" /> {booking.contactEmail}
                  </p>
                </div>

                {/* Storage Unit Type */}
                <div className="space-y-1">
                  <span className="font-semibold text-muted flex items-center gap-1">
                    <Warehouse className="h-3.5 w-3.5" /> Loại kho đã đặt
                  </span>
                  <p className="font-bold text-ink text-sm">{booking.unitTypeName}</p>
                  <p className="text-muted">Kích thước: {booking.unitTypeSizeLabel}</p>
                  <p className="text-muted">Thời hạn: {booking.requestedMonths} tháng</p>
                </div>

                {/* Rental Period / Check-in */}
                <div className="space-y-1">
                  <span className="font-semibold text-muted flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" /> Lịch Check-in dự kiến
                  </span>
                  <p className="font-semibold text-ink">
                    Bắt đầu: {formatDate(booking.checkInSlotStart)}
                  </p>
                  <p className="text-muted">Kết thúc: {formatDate(booking.rentalEndAt)}</p>
                </div>

                {/* Payment & Location */}
                <div className="space-y-1">
                  <span className="font-semibold text-muted flex items-center gap-1">
                    <Warehouse className="h-3.5 w-3.5" /> Vị trí & Thanh toán
                  </span>
                  <p className="font-bold text-ink text-sm">
                    <Currency value={booking.totalAmount} />
                  </p>
                  <div className="mt-1">
                    {booking.assignedUnit ? (
                      <p className="text-xs text-emerald-700 font-semibold">
                        Sẵn sàng tại ô: {booking.assignedUnit.physicalUnitCode}
                      </p>
                    ) : (
                      <p className="text-xs text-amber-700 font-medium">
                        Chờ FM hoàn tất gán ô kho
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
