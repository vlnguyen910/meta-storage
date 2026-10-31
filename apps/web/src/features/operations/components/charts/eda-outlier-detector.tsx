"use client";

import type { OperationsOverview } from "@metastorage/contracts";
import { AlertOctagon, AlertTriangle, ArrowRight, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { businessOperationsRoutes as routes } from "@/config/routes";
import { formatMoney } from "../../operations.utils";

interface EdaOutlierDetectorProps {
  data: OperationsOverview;
}

export function EdaOutlierDetector({ data }: Readonly<EdaOutlierDetectorProps>) {
  // Phát hiện các cơ sở có hiệu suất bất thường (Outliers)
  const anomalies = useMemo(() => {
    const list: {
      type: "warning" | "danger" | "info";
      title: string;
      desc: string;
      metric: string;
      actionUrl?: string;
      actionText?: string;
    }[] = [];

    // 1. Kiểm tra yêu cầu hoàn cọc
    if (data.attention.refunds.count > 0) {
      list.push({
        type: "danger",
        title: "Tồn đọng hoàn cọc (Refund Outliers)",
        desc: `${data.attention.refunds.count} yêu cầu hoàn cọc đang chờ xử lý, gây rủi ro khiếu nại khách hàng`,
        metric: formatMoney(data.attention.refunds.amount),
        actionUrl: `${routes.reports}?tab=refunds`,
        actionText: "Xử lý hoàn cọc",
      });
    }

    // 2. Ô kho trống quá mức quy chuẩn
    if (data.attention.vacantCapacity.count > 0) {
      list.push({
        type: "warning",
        title: "Dư thừa công suất trống (Vacant Outliers)",
        desc: `${data.attention.vacantCapacity.count} ô kho sẵn sàng nhưng chưa có lượt đặt thuê, gây lãng phí diện tích sàn`,
        metric: `${data.attention.vacantCapacity.count} ô trống`,
        actionUrl: routes.utilization,
        actionText: "Xem công suất",
      });
    }

    // 3. Ô kho bảo trì
    if (data.attention.maintenance.count > 0) {
      list.push({
        type: "warning",
        title: "Kho bảo trì kỹ thuật (Maintenance Outliers)",
        desc: `${data.attention.maintenance.count} ô kho đang ngưng hoạt động để bảo dưỡng hoặc xử lý hỏng hóc`,
        metric: `${data.attention.maintenance.count} ô bảo dưỡng`,
        actionUrl: routes.utilization,
        actionText: "Kiểm tra kỹ thuật",
      });
    }

    // 4. Cơ sở có tỷ lệ lấp đầy thấp bất thường (< 50%)
    const lowOccupancyFacilities = data.facilities.filter(
      (f) => Number(f.inventory.utilizationPercent || 0) < 50,
    );

    if (lowOccupancyFacilities.length > 0) {
      const names = lowOccupancyFacilities.map((f) => f.facility.name).join(", ");
      list.push({
        type: "danger",
        title: "Cơ sở sụt giảm lấp đầy nghiêm trọng (<50%)",
        desc: `Phát hiện ${lowOccupancyFacilities.length} cơ sở có tỷ lệ khai thác dưới mức hòa vốn: ${names}`,
        metric: `${lowOccupancyFacilities.length} chi nhánh`,
        actionUrl: routes.revenue,
        actionText: "Xem cơ sở",
      });
    }

    // 5. Lỗi dữ liệu chưa đối soát
    if (data.attention.dataQuality.hasIssues) {
      list.push({
        type: "warning",
        title: "Bất thường đối soát tài chính (Data Quality Outliers)",
        desc: `Có ${data.attention.dataQuality.unclassifiedCollectedPayments} khoản thu chưa phân loại chuẩn xác theo đơn đặt`,
        metric: "Cần đối soát",
        actionUrl: `${routes.reports}?tab=reconciliation`,
        actionText: "Mở đối soát",
      });
    }

    return list;
  }, [data]);

  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-xs">
      <CardHeader className="p-3.5 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-600" />
            <CardTitle className="text-sm font-bold text-slate-900">
              Phát hiện bất thường & Rủi ro vận hành (Outlier & Risk Detection)
            </CardTitle>
          </div>
          <Badge
            variant="outline"
            className={
              anomalies.length > 0
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }
          >
            {anomalies.length > 0
              ? `${anomalies.length} điểm cần xử lý`
              : "Hệ thống hoạt động chuẩn"}
          </Badge>
        </div>
        <p className="text-xs text-slate-500">
          Tự động phát hiện các điểm dị biệt (Outliers) ngoài phân phối chuẩn để cảnh báo BOM can
          thiệp kịp thời
        </p>
      </CardHeader>

      <CardContent className="p-3.5 pt-0">
        {anomalies.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-900">
            <span className="text-base">🎉</span>
            <p>
              Không phát hiện bất thường nghiêm trọng. Các chỉ số về công nợ, ô trống và bảo trì đều
              nằm trong giới hạn kiểm soát chuẩn.
            </p>
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {anomalies.map((item) => (
              <div
                key={item.title}
                className={`flex flex-col justify-between rounded-lg border p-3 text-xs transition-colors ${
                  item.type === "danger"
                    ? "border-rose-200 bg-rose-50/50 hover:bg-rose-50"
                    : "border-amber-200 bg-amber-50/50 hover:bg-amber-50"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 font-bold ${
                        item.type === "danger" ? "text-rose-800" : "text-amber-800"
                      }`}
                    >
                      {item.type === "danger" ? (
                        <AlertOctagon className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                      )}
                      {item.title}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        item.type === "danger"
                          ? "bg-rose-200/60 text-rose-900"
                          : "bg-amber-200/60 text-amber-900"
                      }`}
                    >
                      {item.metric}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-4 text-slate-600">{item.desc}</p>
                </div>

                {item.actionUrl && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex justify-end">
                    <Link
                      href={item.actionUrl}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                    >
                      <span>{item.actionText}</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
