"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import { LIST_PAGINATION_MESSAGES as M } from "./list-pagination.messages";
import type { ListPaginationProps } from "./list-pagination.types";

export function ListPagination({
  label,
  page,
  pageSize,
  total,
  onPageChange,
  pending,
}: ListPaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pages);
  if (!total) return null;
  return (
    <nav
      aria-label={M.navigation(label)}
      className="flex flex-wrap items-center justify-between gap-3 rounded border border-[#bfcac4] bg-white px-4 py-3 text-sm"
    >
      <span className="text-slate-600" role="status">
        {M.range((current - 1) * pageSize + 1, Math.min(current * pageSize, total), total)}
      </span>
      {pages > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending || current === 1}
            onClick={() => onPageChange(current - 1)}
            aria-label={M.previous}
          >
            <ChevronLeft size={16} aria-hidden="true" />
            {M.previous}
          </Button>
          <span className="px-1 font-semibold">{M.page(current, pages)}</span>
          <Button
            type="button"
            variant="outline"
            disabled={pending || current === pages}
            onClick={() => onPageChange(current + 1)}
            aria-label={M.next}
          >
            {M.next}
            <ChevronRight size={16} aria-hidden="true" />
          </Button>
        </div>
      )}
    </nav>
  );
}
