"use client";

import { Check, ChevronDown, ChevronUp, MoreHorizontal, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { DROPDOWN_SELECT_MESSAGES as M } from "./dropdown-select.messages";
import type { DropdownSelectProps } from "./dropdown-select.types";

export function DropdownSelect({
  value,
  onChange,
  options,
  placeholder,
  icon,
  maxVisibleItems = 6,
  className,
  triggerClassName,
  dropdownClassName,
  disabled = false,
  ariaLabel,
}: Readonly<DropdownSelectProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  const selectedOption = options.find((o) => o.value === value);
  const selectedIndex = options.findIndex((o) => o.value === value);

  // Auto-expand if the currently active option is past the threshold
  useEffect(() => {
    if (selectedIndex >= maxVisibleItems) {
      setIsExpanded(true);
    }
  }, [selectedIndex, maxVisibleItems]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        setSearchQuery("");
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Focus search input on open if present
  useEffect(() => {
    if (isOpen && options.length >= 8 && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, options.length]);

  const filteredOptions = searchQuery.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : options;

  // Decide how many items to display
  const shouldLimit =
    !isExpanded && !searchQuery.trim() && filteredOptions.length > maxVisibleItems;
  const visibleOptions = shouldLimit ? filteredOptions.slice(0, maxVisibleItems) : filteredOptions;
  const remainingCount = filteredOptions.length - maxVisibleItems;

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div ref={containerRef} className={cn("relative inline-block text-left", className)}>
      {/* Trigger Button */}
      <button
        type="button"
        id={`dropdown-trigger-${id}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel ?? placeholder ?? selectedOption?.label}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "flex h-7 min-h-0 cursor-pointer items-center justify-between gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800 shadow-2xs transition-all hover:bg-slate-100 hover:border-slate-300 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50",
          isOpen && "border-primary ring-1 ring-primary bg-white",
          triggerClassName,
        )}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          {icon && <span className="shrink-0 text-slate-500">{icon}</span>}
          <span className="truncate">
            {selectedOption ? selectedOption.label : (placeholder ?? options[0]?.label)}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200",
            isOpen && "rotate-180 text-primary",
          )}
          aria-hidden="true"
        />
      </button>

      {/* Floating Popover Menu */}
      {isOpen && (
        <div
          role="listbox"
          aria-labelledby={`dropdown-trigger-${id}`}
          className={cn(
            "absolute left-0 top-full z-50 mt-1 min-w-[200px] min-w-full w-max max-w-[340px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in-0 zoom-in-95 duration-100",
            dropdownClassName,
          )}
        >
          {/* Search Input for many items */}
          {options.length >= 8 && (
            <div className="mb-1.5 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-1 text-xs">
              <Search className="h-3 w-3 text-slate-400 shrink-0" aria-hidden="true" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                placeholder={M.searchPlaceholder}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent p-0 text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
              />
            </div>
          )}

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto space-y-0.5 pr-0.5">
            {visibleOptions.length === 0 ? (
              <p className="py-3 text-center text-xs text-slate-500">{M.noOptionsFound}</p>
            ) : (
              visibleOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      "flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors",
                      isSelected
                        ? "bg-primary/10 font-semibold text-primary"
                        : "font-medium text-slate-700 hover:bg-slate-100/80 hover:text-slate-900",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-1.5">
                      {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                      <span className="truncate">{opt.label}</span>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {opt.badge && (
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Expand Button: "... Xem thêm (N lựa chọn khác)" */}
          {shouldLimit && remainingCount > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(true);
              }}
              className="mt-1 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary/30 bg-primary/5 px-2 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{M.moreItems(remainingCount)}</span>
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            </button>
          )}

          {/* Collapse Button when expanded */}
          {isExpanded && !searchQuery.trim() && options.length > maxVisibleItems && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(false);
              }}
              className="mt-1 flex w-full cursor-pointer items-center justify-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <ChevronUp className="h-3 w-3" aria-hidden="true" />
              <span>{M.collapse}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
