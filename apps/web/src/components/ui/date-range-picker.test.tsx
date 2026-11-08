import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DATE_PICKER_MESSAGES as M } from "./date-picker.messages";
import { DateRangePicker } from "./date-range-picker";
import { getMonthPresets, getTodayString } from "./date-utils";

describe("DateRangePicker", () => {
  it("renders trigger with default placeholder and toggles popover on click", () => {
    const handleChange = vi.fn();
    render(<DateRangePicker onChange={handleChange} placeholder="Chọn dải ngày" />);

    const trigger = screen.getByRole("button", { name: "Chọn dải ngày" });
    expect(trigger).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: M.chooseRangeDialog })).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("selects a date range through the calendar day grid and applies it", () => {
    const handleChange = vi.fn();
    render(<DateRangePicker from="2026-11-01" to="2026-11-05" onChange={handleChange} />);

    fireEvent.click(screen.getByRole("button", { name: "01/11/2026 → 05/11/2026" }));

    // Click day 10
    const day10 = screen.getByRole("button", { name: "10" });
    fireEvent.click(day10);

    // Click day 15
    const day15 = screen.getByRole("button", { name: "15" });
    fireEvent.click(day15);

    // Click Apply
    const applyBtn = screen.getByRole("button", { name: M.apply });
    fireEvent.click(applyBtn);

    expect(handleChange).toHaveBeenCalledWith({
      from: "2026-11-10",
      to: "2026-11-15",
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("sends a 1-day range when user clicks only one day and clicks Apply", () => {
    const handleChange = vi.fn();
    render(<DateRangePicker from="2026-11-01" to="2026-11-05" onChange={handleChange} />);

    fireEvent.click(screen.getByRole("button", { name: "01/11/2026 → 05/11/2026" }));

    // Click day 20 (only 1 click)
    const day20 = screen.getByRole("button", { name: "20" });
    fireEvent.click(day20);

    // Click Apply directly
    const applyBtn = screen.getByRole("button", { name: M.apply });
    fireEvent.click(applyBtn);

    expect(handleChange).toHaveBeenCalledWith({
      from: "2026-11-20",
      to: "2026-11-20",
    });
  });

  it("selects preset immediately and closes dialog", () => {
    const handleChange = vi.fn();
    render(<DateRangePicker onChange={handleChange} />);

    fireEvent.click(screen.getByRole("button", { name: M.rangePlaceholder }));

    const preset7Days = screen.getByRole("button", { name: M.last7Days });
    fireEvent.click(preset7Days);

    const expected = getMonthPresets(getTodayString()).last7Days;
    expect(handleChange).toHaveBeenCalledWith({
      from: expected.from,
      to: expected.to,
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls onClear when clear button is clicked", () => {
    const handleChange = vi.fn();
    const handleClear = vi.fn();
    render(
      <DateRangePicker
        from="2026-11-01"
        to="2026-11-05"
        onChange={handleChange}
        onClear={handleClear}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "01/11/2026 → 05/11/2026" }));

    const clearBtn = screen.getByRole("button", { name: M.clear });
    fireEvent.click(clearBtn);

    expect(handleClear).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("resets unapplied draft when closed via Escape", () => {
    const handleChange = vi.fn();
    render(<DateRangePicker from="2026-11-01" to="2026-11-05" onChange={handleChange} />);

    // Open popover
    fireEvent.click(screen.getByRole("button", { name: "01/11/2026 → 05/11/2026" }));

    // Click day 12 (dirty draft)
    fireEvent.click(screen.getByRole("button", { name: "12" }));

    // Press Escape
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(handleChange).not.toHaveBeenCalled();

    // Reopen popover
    fireEvent.click(screen.getByRole("button", { name: "01/11/2026 → 05/11/2026" }));

    // Summary should show the original range, not day 12
    expect(screen.getByText("01/11/2026 – 05/11/2026")).toBeInTheDocument();
  });
});
