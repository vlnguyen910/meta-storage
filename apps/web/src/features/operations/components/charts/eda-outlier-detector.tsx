"use client";

import type { OperationsOverview } from "@metastorage/contracts";
import { AlertOctagon, AlertTriangle, ArrowRight, CheckCircle2, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { businessOperationsRoutes as routes } from "@/config/routes";
import { formatMoney } from "../../operations.utils";
import { DASHBOARD_MESSAGES as D } from "../../operations-dashboard.messages";

interface EdaOutlierDetectorProps {
  data: OperationsOverview;
}

export function EdaOutlierDetector({ data }: Readonly<EdaOutlierDetectorProps>) {
  const anomalies = useMemo(() => {
    const list: {
      type: "warning" | "danger";
      title: string;
      desc: string;
      metric: string;
      actionUrl?: string;
      actionText?: string;
    }[] = [];

    // 1. Chờ hoàn tiền
    if (data.attention.refunds.count > 0) {
      list.push({
        type: "danger",
        title: "Chờ hoàn tiền",
        desc: `${data.attention.refunds.count} yêu cầu cần duyệt`,
        metric: formatMoney(data.attention.refunds.amount),
        actionUrl: `${routes.reports}?tab=refunds`,
        actionText: "Xử lý",
      });
    }

    // 2. Ô kho còn trống
    if (data.attention.vacantCapacity.count > 0) {
      list.push({
        type: "warning",
        title: "Ô kho còn trống",
        desc: "Sẵn sàng cho thuê mới",
        metric: `${data.attention.vacantCapacity.count} ô`,
        actionUrl: routes.utilization,
        actionText: "Kiểm tra",
      });
    }

    // 3. Kho bảo dưỡng
    if (data.attention.maintenance.count > 0) {
      list.push({
        type: "warning",
        title: "Kho đang bảo trì",
        desc: "Đang sửa chữa kỹ thuật",
        metric: `${data.attention.maintenance.count} ô`,
        actionUrl: routes.utilization,
        actionText: "Xem kho",
      });
    }

    // 4. Cơ sở lấp đầy thấp
    const lowOccupancyFacilities = data.facilities.filter(
      (f) => Number(f.inventory.utilizationPercent || 0) < 50,
    );
    if (lowOccupancyFacilities.length > 0) {
      list.push({
        type: "danger",
        title: "Lấp đầy thấp (<50%)",
        desc: lowOccupancyFacilities.map((f) => f.facility.name).join(", "),
        metric: `${lowOccupancyFacilities.length} cơ sở`,
        actionUrl: routes.revenue,
        actionText: "Xem chi tiết",
      });
    }

    // 5. Cần đối soát giao dịch
    if (data.attention.dataQuality.hasIssues) {
      list.push({
        type: "warning",
        title: "Cần đối soát",
        desc: `${data.attention.dataQuality.unclassifiedCollectedPayments} khoản thu chưa phân loại`,
        metric: "Lệch đối soát",
        actionUrl: `${routes.reports}?tab=reconciliation`,
        actionText: "Đối soát",
      });
    }

    return list;
  }, [data]);

  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-xs">
      <CardHeader className="p-3.5 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-slate-700" />
            <CardTitle className="text-sm font-bold text-slate-900">{D.outliersTitle}</CardTitle>
          </div>
          <Badge
            variant="outline"
            className={
              anomalies.length > 0
                ? "border-rose-200 bg-rose-50 font-semibold text-rose-700"
                : "border-emerald-200 bg-emerald-50 font-semibold text-emerald-700"
            }
          >
            {anomalies.length > 0 ? D.outliersIssuesCount(anomalies.length) : D.outliersAllGood}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-3.5 pt-0">
        {anomalies.length === 0 ? (
          <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50 p-2.5 text-xs text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{D.outliersAllGood}</span>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {anomalies.map((item) => (
              <div
                key={item.title}
                className={`flex items-center justify-between rounded-lg border p-2.5 text-xs transition-colors ${
                  item.type === "danger"
                    ? "border-rose-200 bg-rose-50/40"
                    : "border-amber-200 bg-amber-50/40"
                }`}
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    {item.type === "danger" ? (
                      <AlertOctagon className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                    )}
                    <span className="truncate font-bold text-slate-900">{item.title}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        item.type === "danger"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {item.metric}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-slate-500">{item.desc}</p>
                </div>

                {item.actionUrl && (
                  <Link
                    href={item.actionUrl}
                    className={buttonClassName(
                      "outline",
                      "h-7 min-h-0 shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium inline-flex items-center gap-1",
                    )}
                  >
                    <span>{item.actionText}</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
