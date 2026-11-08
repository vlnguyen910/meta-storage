import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { DropdownSelect } from "./dropdown-select";

describe("DropdownSelect", () => {
  const options = [
    { value: "opt-1", label: "Kho tổng Hà Nội" },
    { value: "opt-2", label: "Kho Tân Bình" },
    { value: "opt-3", label: "Kho Bình Thạnh" },
  ];

  it("renders with supplied id and forwards aria-invalid and aria-describedby", () => {
    render(
      <DropdownSelect
        id="facility-picker"
        value="opt-1"
        onChange={vi.fn()}
        options={options}
        ariaLabel="Chọn cơ sở"
        aria-invalid="true"
        aria-describedby="facility-error"
      />,
    );

    const trigger = screen.getByRole("button", { name: "Chọn cơ sở" });
    expect(trigger).toHaveAttribute("id", "facility-picker");
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    expect(trigger).toHaveAttribute("aria-describedby", "facility-error");
    expect(trigger).toHaveTextContent("Kho tổng Hà Nội");
  });

  it("opens popup on click and selects an option", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <DropdownSelect value="opt-1" onChange={handleChange} options={options} ariaLabel="Cơ sở" />,
    );

    const trigger = screen.getByRole("button", { name: "Cơ sở" });
    await user.click(trigger);

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    const option = screen.getByRole("option", { name: "Kho Tân Bình" });
    await user.click(option);

    expect(handleChange).toHaveBeenCalledWith("opt-2");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("supports keyboard navigation with Arrow keys and Enter", async () => {
    const user = userEvent.setup();
    function Interactive() {
      const [val, setVal] = useState("opt-1");
      return (
        <DropdownSelect
          id="keyboard-test"
          value={val}
          onChange={setVal}
          options={options}
          ariaLabel="Cơ sở"
        />
      );
    }

    render(<Interactive />);
    const trigger = screen.getByRole("button", { name: "Cơ sở" });
    trigger.focus();

    // ArrowDown opens dropdown
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    // ArrowDown navigates to next option
    await user.keyboard("{ArrowDown}");
    // Enter selects option
    await user.keyboard("{Enter}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveTextContent("Kho Tân Bình");
  });

  it("closes on Escape and keeps focus on trigger", async () => {
    const user = userEvent.setup();
    render(
      <DropdownSelect
        id="escape-test"
        value="opt-1"
        onChange={vi.fn()}
        options={options}
        ariaLabel="Cơ sở"
      />,
    );

    const trigger = screen.getByRole("button", { name: "Cơ sở" });
    await user.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
