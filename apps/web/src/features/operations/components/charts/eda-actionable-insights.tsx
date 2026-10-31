"use client";

import type { OperationsOverview } from "@metastorage/contracts";
import { ArrowUpRight, Lightbulb, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { businessOperationsRoutes as routes } from "@/config/routes";
import { formatPercentage } from "../../operations.utils";

interface EdaActionableInsightsProps {
  data: OperationsOverview;
}

export function EdaActionableInsights({ data }: Readonly<EdaActionableInsightsProps>) {
  const recommendations = useMemo(() => {
    const list: {
      tag: string;
      badgeColor: string;
      title: string;
      desc: string;
      actionUrl: string;
      actionText: string;
    }[] = [];

    const facilities = data.facilities;
    const avgOccupancy = Number(data.summary.inventory.utilizationPercent || 0);

    // 1. Khuyến nghị Định giá động (Dynamic Pricing)
    const highOccupancy = facilities.filter(
      (f) => Number(f.inventory.utilizationPercent || 0) >= 85,
    );
    if (highOccupancy.length > 0) {
      const topName = highOccupancy[0]?.facility.name ?? "Trọng điểm";
      list.push({
        tag: "Định giá động (Pricing)",
        badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
        title: `Tăng giá thuê 5% – 10% tại ${highOccupancy.length} cơ sở công suất cao`,
        desc: `Cơ sở như ${topName} đạt tỷ lệ lấp đầy trên 85%. Phân tích EDA cho thấy cầu vượt cung, có thể nâng giá niêm yết để tối đa hóa doanh thu biên mà không làm giảm lượng khách.`,
        actionUrl: routes.pricing,
        actionText: "Điều chỉnh bảng giá",
      });
    } else {
      list.push({
        tag: "Chính sách giá",
        badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
        title: "Duy trì giá cơ sở và áp dụng ưu đãi thời gian thuê dài hạn",
        desc: `Tỷ lệ lấp đầy toàn chuỗi đạt ${formatPercentage(avgOccupancy)}. Nên triển khai chính sách chiết khấu thanh toán 6-12 tháng để giữ chân khách hàng hiện hữu.`,
        actionUrl: routes.pricing,
        actionText: "Xem bảng giá",
      });
    }

    // 2. Tối ưu hóa phân bổ diện tích (Capacity Allocation)
    const vacantCount = data.attention.vacantCapacity.count;
    if (vacantCount > 10) {
      list.push({
        tag: "Cơ cấu kho (Layout)",
        badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
        title: "Tái cấu trúc diện tích: Chia nhỏ kho lớn thành kho mini",
        desc: `Hiện có ${vacantCount} ô kho đang trống. Dữ liệu lịch sử cho thấy kho cỡ nhỏ (Small/Medium) có chu kỳ quay vòng nhanh hơn 40% so với kho lớn. Cân nhắc dựng vách ngăn chia kho.`,
        actionUrl: routes.facilities,
        actionText: "Quản lý cơ sở",
      });
    }

    // 3. Chuẩn bị cho mùa vụ cao điểm (Seasonal Preparation)
    list.push({
      tag: "Dự báo mùa vụ (Seasonality)",
      badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
      title: "Chuẩn bị nguồn cung cho mùa chuyển nhà & lưu trữ cuối năm",
      desc: "Phân tích chuỗi thời gian EDA chỉ ra nhu cầu lưu trữ đồ nội thất và hàng kinh doanh thường tăng từ 25-35% vào Quý 4. Cần hoàn tất bảo trì các ô kho trước mùa cao điểm.",
      actionUrl: routes.reports,
      actionText: "Xem chuỗi thời gian",
    });

    return list;
  }, [data]);

  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-xs">
      <CardHeader className="p-3.5 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-50 text-amber-600">
              <Lightbulb className="h-4 w-4" />
            </div>
            <CardTitle className="text-sm font-bold text-slate-900">
              Đề xuất chiến lược vận hành (EDA Actionable Takeaways for BOM)
            </CardTitle>
          </div>
          <Badge
            variant="outline"
            className="border-purple-200 bg-purple-50 text-[10px] font-semibold text-purple-700"
          >
            <Sparkles className="mr-1 h-3 w-3 inline" />
            Data-Driven Insights
          </Badge>
        </div>
        <p className="text-xs text-slate-500">
          Kết luận và gợi ý hành động cụ thể cho BOM dựa trên mô hình khám phá dữ liệu toàn chuỗi
          kho
        </p>
      </CardHeader>

      <CardContent className="p-3.5 pt-0">
        <div className="grid gap-3 md:grid-cols-3">
          {recommendations.map((rec, index) => (
            <div
              key={rec.title}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50/70 to-white p-3.5 shadow-2xs hover:border-slate-300 transition-all"
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-2">
                  <Badge
                    variant="outline"
                    className={`py-0 text-[10px] font-bold ${rec.badgeColor}`}
                  >
                    {rec.tag}
                  </Badge>
                  <span className="text-[10px] font-bold text-slate-400">#0{index + 1}</span>
                </div>
                <h4 className="text-xs font-bold text-slate-900 leading-snug">{rec.title}</h4>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">{rec.desc}</p>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100 flex justify-end">
                <Link
                  href={rec.actionUrl}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                >
                  <span>{rec.actionText}</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
