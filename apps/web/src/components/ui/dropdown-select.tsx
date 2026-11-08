"use client";

import { Check, ChevronDown, ChevronUp, MoreHorizontal, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { DROPDOWN_SELECT_MESSAGES as M } from "./dropdown-select.messages";
import type { DropdownSelectProps } from "./dropdown-select.types";

export function DropdownSelect({
  id: propId,
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
  "aria-label": ariaLabelProp,
  "aria-invalid": ariaInvalidProp,
  "aria-describedby": ariaDescribedbyProp,
  ariaInvalid,
  ariaDescribedby,
  placement = "auto",
  align = "start",
}: Readonly<DropdownSelectProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const generatedId = useId();
  const triggerId = propId ?? `dropdown-trigger-${generatedId}`;

  const selectedOption = options.find((o) => o.value === value);
  const selectedIndex = options.findIndex((o) => o.value === value);

  // Auto-flip upward if near the bottom of viewport
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    if (placement === "top") {
      setOpenUpward(true);
      return;
    }
    if (placement === "bottom") {
      setOpenUpward(false);
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelowViewport = window.innerHeight - rect.bottom;
    const spaceAboveViewport = rect.top;

    if (spaceBelowViewport < 220 && spaceAboveViewport > spaceBelowViewport) {
      setOpenUpward(true);
    } else {
      setOpenUpward(false);
    }
  }, [isOpen, placement]);

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

  // Reset or initialize highlighted index when opening or filtering
  useEffect(() => {
    if (isOpen) {
      const idx = visibleOptions.findIndex((o) => o.value === value);
      setHighlightedIndex(idx >= 0 ? idx : 0);
    } else {
      setHighlightedIndex(-1);
    }
  }, [isOpen, value, visibleOptions]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || highlightedIndex < 0) return;
    const itemEl = document.getElementById(`${triggerId}-opt-${highlightedIndex}`);
    if (itemEl && typeof itemEl.scrollIntoView === "function") {
      itemEl.scrollIntoView({ block: "nearest" });
    }
  }, [isOpen, highlightedIndex, triggerId]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery("");
    triggerRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();
        setIsOpen(true);
      } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const char = event.key.toLowerCase();
        const match = options.find((o) => o.label.toLowerCase().startsWith(char));
        if (match) {
          event.preventDefault();
          onChange(match.value);
        }
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (visibleOptions.length > 0) {
        setHighlightedIndex((prev) => (prev + 1) % visibleOptions.length);
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (visibleOptions.length > 0) {
        setHighlightedIndex((prev) => (prev <= 0 ? visibleOptions.length - 1 : prev - 1));
      }
    } else if (event.key === "Home") {
      event.preventDefault();
      setHighlightedIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setHighlightedIndex(visibleOptions.length - 1);
    } else if (
      event.key === "Enter" ||
      (event.key === " " && document.activeElement !== searchInputRef.current)
    ) {
      event.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < visibleOptions.length) {
        const selected = visibleOptions[highlightedIndex];
        if (selected) {
          handleSelect(selected.value);
        }
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      setSearchQuery("");
      triggerRef.current?.focus();
    } else if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      document.activeElement !== searchInputRef.current
    ) {
      const char = event.key.toLowerCase();
      const matchIdx = visibleOptions.findIndex((o) => o.label.toLowerCase().startsWith(char));
      if (matchIdx >= 0) {
        event.preventDefault();
        setHighlightedIndex(matchIdx);
      }
    }
  };

  const isUpward = placement === "top" || (placement !== "bottom" && openUpward);

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-block text-left", isOpen && "z-30", className)}
    >
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        id={triggerId}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-invalid={ariaInvalid ?? ariaInvalidProp}
        aria-describedby={ariaDescribedby ?? ariaDescribedbyProp}
        aria-label={ariaLabel ?? ariaLabelProp ?? placeholder ?? selectedOption?.label}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex h-9 min-h-9 cursor-pointer items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-800 shadow-xs transition-all hover:border-slate-300 hover:bg-slate-50/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
          isOpen && "border-primary ring-2 ring-primary/20 bg-white",
          triggerClassName,
        )}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          {icon && <span className="shrink-0 text-slate-400">{icon}</span>}
          <span className="truncate">
            {selectedOption ? selectedOption.label : (placeholder ?? options[0]?.label)}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200",
            isOpen && (isUpward ? "-rotate-180 text-primary" : "rotate-180 text-primary"),
          )}
          aria-hidden="true"
        />
      </button>

      {/* Floating Popover Menu */}
      {isOpen && (
        <div
          role="listbox"
          tabIndex={-1}
          id={`${triggerId}-listbox`}
          aria-labelledby={triggerId}
          aria-activedescendant={
            highlightedIndex >= 0 ? `${triggerId}-opt-${highlightedIndex}` : undefined
          }
          onKeyDown={handleKeyDown}
          className={cn(
            "absolute z-50 min-w-[200px] min-w-full w-max max-w-[340px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in-0 zoom-in-95 duration-100",
            isUpward ? "bottom-full mb-1.5" : "top-full mt-1.5",
            align === "end" ? "right-0 origin-top-right" : "left-0 origin-top-left",
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
              visibleOptions.map((opt, index) => {
                const isSelected = opt.value === value;
                const isHighlighted = highlightedIndex === index;
                return (
                  <button
                    key={opt.value}
                    id={`${triggerId}-opt-${index}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt.value)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={cn(
                      "flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs sm:text-sm transition-colors",
                      isSelected
                        ? "bg-primary/10 font-semibold text-primary"
                        : isHighlighted
                          ? "bg-slate-100 font-medium text-slate-900"
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
