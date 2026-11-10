import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DatePicker } from "./date-picker";
import { DATE_PICKER_MESSAGES as M } from "./date-picker.messages";
import { getTodayString } from "./date-utils";

describe("DatePicker", () => {
  it("renders trigger and opens popover on click", () => {
    const handleChange = vi.fn();
    render(<DatePicker onChange={handleChange} placeholder="Chọn ngày làm việc" />);

    const trigger = screen.getByRole("button", { name: "Chọn ngày làm việc" });
    expect(trigger).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: M.chooseDateDialog })).toBeInTheDocument();
  });

  it("selects a day from calendar grid and closes", () => {
    const handleChange = vi.fn();
    render(<DatePicker value="2026-11-01" onChange={handleChange} />);

    fireEvent.click(screen.getByRole("button", { name: "01/11/2026" }));

    // Click day 18
    const day18 = screen.getByRole("button", { name: "18" });
    fireEvent.click(day18);

    expect(handleChange).toHaveBeenCalledWith("2026-11-18");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("selects today from quick preset", () => {
    const handleChange = vi.fn();
    render(<DatePicker onChange={handleChange} />);

    fireEvent.click(screen.getByRole("button", { name: M.placeholder }));

    const todayBtn = screen.getByRole("button", { name: M.today });
    fireEvent.click(todayBtn);

    expect(handleChange).toHaveBeenCalledWith(getTodayString());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("supports selecting 'all' option when allowAll is enabled", () => {
    const handleChange = vi.fn();
    render(
      <DatePicker value="2026-11-01" onChange={handleChange} allowAll allLabel={M.allDates} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "01/11/2026" }));

    const allBtn = screen.getByRole("button", { name: M.allDates });
    fireEvent.click(allBtn);

    expect(handleChange).toHaveBeenCalledWith("all");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
