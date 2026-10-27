"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { type FormEvent, useState } from "react";
import { cn } from "@/lib/utils";
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
  className,
  unitLabel = "mục",
}: ListPaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pages);

  const [editingEllipsis, setEditingEllipsis] = useState<"left" | "right" | null>(null);
  const [ellipsisValue, setEllipsisValue] = useState("");
  const [directJumpValue, setDirectJumpValue] = useState("");

  if (!total) return null;

  function handleEllipsisSubmit(e: FormEvent) {
    e.preventDefault();
    const target = Number.parseInt(ellipsisValue, 10);
    if (!Number.isNaN(target) && target >= 1 && target <= pages) {
      onPageChange(target);
    }
    setEditingEllipsis(null);
    setEllipsisValue("");
  }

  function handleDirectJumpSubmit(e: FormEvent) {
    e.preventDefault();
    const target = Number.parseInt(directJumpValue, 10);
    if (!Number.isNaN(target) && target >= 1 && target <= pages) {
      onPageChange(target);
    }
    setDirectJumpValue("");
  }

  // Calculate page items with ellipsis
  const getPageItems = () => {
    if (pages <= 7) {
      return Array.from({ length: pages }, (_, i) => i + 1);
    }

    if (current <= 4) {
      return [1, 2, 3, 4, 5, "ellipsis-right", pages] as const;
    }

    if (current >= pages - 3) {
      return [1, "ellipsis-left", pages - 4, pages - 3, pages - 2, pages - 1, pages] as const;
    }

    return [
      1,
      "ellipsis-left",
      current - 1,
      current,
      current + 1,
      "ellipsis-right",
      pages,
    ] as const;
  };

  const pageItems = getPageItems();

  const startIdx = (current - 1) * pageSize + 1;
  const endIdx = Math.min(current * pageSize, total);

  return (
    <nav
      aria-label={M.navigation(label)}
      className={cn(
        "shrink-0 flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-slate-200/90 bg-white text-xs shadow-2xs",
        className,
      )}
    >
      {/* Left: Summary text */}
      <div className="text-slate-600 font-medium select-none" role="status">
        {M.summaryShowing} <strong className="text-slate-900 font-bold">{startIdx}</strong> –{" "}
        <strong className="text-slate-900 font-bold">{endIdx}</strong> {M.summaryOf}{" "}
        <strong className="text-slate-900 font-bold">{total}</strong> {unitLabel}
      </div>

      {/* Right: Page navigation & Jump */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {/* Previous Button */}
        <Button
          type="button"
          variant="outline"
          disabled={pending || current === 1}
          onClick={() => onPageChange(current - 1)}
          aria-label={M.previous}
          className="min-h-0 h-8 px-2.5 text-xs font-semibold gap-1 border-slate-200 text-slate-700 hover:text-primary hover:border-primary disabled:opacity-40"
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">{M.previous}</span>
        </Button>

        {/* Page Buttons with Interactive Ellipsis */}
        {pageItems.map((item) => {
          if (item === "ellipsis-left" || item === "ellipsis-right") {
            const side = item === "ellipsis-left" ? "left" : "right";
            const isEditing = editingEllipsis === side;

            if (isEditing) {
              return (
                <form
                  key={`ellipsis-form-${side}`}
                  onSubmit={handleEllipsisSubmit}
                  className="inline-flex"
                >
                  <input
                    type="number"
                    min={1}
                    max={pages}
                    ref={(el) => el?.focus()}
                    placeholder={M.pagePlaceholder}
                    value={ellipsisValue}
                    onChange={(e) => setEllipsisValue(e.target.value)}
                    onBlur={() => {
                      if (ellipsisValue) {
                        const target = Number.parseInt(ellipsisValue, 10);
                        if (!Number.isNaN(target) && target >= 1 && target <= pages) {
                          onPageChange(target);
                        }
                      }
                      setEditingEllipsis(null);
                      setEllipsisValue("");
                    }}
                    className="w-12 h-8 text-center text-xs font-bold border-2 border-primary rounded-lg bg-white text-slate-900 focus:outline-none shadow-xs"
                  />
                </form>
              );
            }

            return (
              <button
                key={`ellipsis-btn-${side}`}
                type="button"
                onClick={() => {
                  setEditingEllipsis(side);
                  setEllipsisValue("");
                }}
                title={M.jumpPrompt}
                className="min-w-8 h-8 px-1.5 rounded-lg border border-dashed border-slate-300 hover:border-primary hover:bg-primary-soft/40 hover:text-primary text-slate-500 text-xs font-bold transition-colors cursor-pointer"
              >
                ...
              </button>
            );
          }

          const pageNumber = item as number;
          const isActive = pageNumber === current;

          return (
            <button
              key={pageNumber}
              type="button"
              disabled={pending}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onPageChange(pageNumber)}
              className={cn(
                "min-w-8 h-8 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center",
                isActive
                  ? "bg-primary text-white shadow-xs font-extrabold"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300",
              )}
            >
              {pageNumber}
            </button>
          );
        })}

        {/* Next Button */}
        <Button
          type="button"
          variant="outline"
          disabled={pending || current === pages}
          onClick={() => onPageChange(current + 1)}
          aria-label={M.next}
          className="min-h-0 h-8 px-2.5 text-xs font-semibold gap-1 border-slate-200 text-slate-700 hover:text-primary hover:border-primary disabled:opacity-40"
        >
          <span className="hidden sm:inline">{M.next}</span>
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Button>

        {/* Quick Jump Input */}
        {pages > 1 && (
          <form
            onSubmit={handleDirectJumpSubmit}
            className="hidden md:flex items-center gap-1.5 ml-2 pl-2 border-l border-slate-200"
          >
            <span className="text-[11px] text-slate-500 font-medium">{M.jumpTo}:</span>
            <input
              type="number"
              min={1}
              max={pages}
              placeholder={`${current}`}
              value={directJumpValue}
              onChange={(e) => setDirectJumpValue(e.target.value)}
              className="w-12 h-8 text-center text-xs font-semibold border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-primary focus:outline-none"
            />
            <Button
              type="submit"
              variant="outline"
              disabled={!directJumpValue || pending}
              className="min-h-0 h-8 px-2 text-xs font-semibold"
            >
              {M.jump}
            </Button>
          </form>
        )}
      </div>
    </nav>
  );
}
