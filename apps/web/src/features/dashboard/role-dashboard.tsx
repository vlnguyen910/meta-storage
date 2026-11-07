"use client";

import type { UserRole } from "@storex/contracts";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowUpRight } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/display";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";

const kpiValueTone = {
  primary: "text-primary",
  accent: "text-accent",
  warning: "text-warning",
  neutral: "text-secondary",
} as const;

export function RoleDashboard({ role }: { role: UserRole }) {
  const query = useQuery({
    queryKey: ["dashboard", role],
    queryFn: () => api.dashboards.get(role),
  });
  if (query.isLoading) return <LoadingState label="Đang tổng hợp dữ liệu vận hành…" />;
  if (query.isError || !query.data) {
    return (
      <ErrorState
        message="Không thể tải dashboard hoặc dữ liệu nằm ngoài phạm vi facility của bạn."
        onRetry={() => query.refetch()}
      />
    );
  }

  const data = query.data;
  return (
    <>
      <PageHeader
        eyebrow={data.facilityName ?? "storeX operations"}
        title={data.title}
        description={data.subtitle}
      />
      <div className="grid grid-cols-4 gap-[18px] max-[1024px]:grid-cols-2 max-[560px]:grid-cols-1">
        {data.kpis.map((kpi) => (
          <article
            className="relative flex min-h-[175px] flex-col rounded-card border border-line bg-white p-5 shadow-soft"
            key={kpi.label}
          >
            <span className="absolute top-[18px] right-[18px] grid size-9 place-items-center rounded-[10px] bg-primary-soft text-primary">
              <ArrowUpRight />
            </span>
            <small className="font-bold text-muted">{kpi.label}</small>
            <strong className={cn("my-4 text-3xl", kpiValueTone[kpi.tone])}>{kpi.value}</strong>
            <p className="mt-auto mb-0 text-xs text-muted">{kpi.helper}</p>
          </article>
        ))}
      </div>
      <Card className="mt-7">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <span className="mb-2.5 inline-block text-xs font-extrabold tracking-[0.13em] text-primary uppercase">
              Cập nhật mới nhất
            </span>
            <h2 className="text-3xl font-bold">Hoạt động gần đây</h2>
          </div>
          <Activity />
        </div>
        <div className="grid">
          {data.activities.map((item) => (
            <div
              className="grid grid-cols-[15px_1fr_auto] items-center gap-3 border-t border-line py-4"
              key={item.id}
            >
              <span className="size-[9px] rounded-full bg-primary" />
              <div>
                <strong>{item.title}</strong>
                <p className="mt-1 mb-0 text-xs text-muted">{item.description}</p>
              </div>
              <time className="text-xs text-muted">{item.time}</time>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
