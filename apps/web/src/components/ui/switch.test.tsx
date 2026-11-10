import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Switch } from "./switch";

describe("Switch", () => {
  it("renders unchecked by default and toggles on click", async () => {
    const user = userEvent.setup();
    render(<Switch aria-label="Toggle active" />);

    const switchEl = screen.getByRole("switch", { name: "Toggle active" });
    expect(switchEl).not.toBeChecked();

    await user.click(switchEl);
    expect(switchEl).toBeChecked();

    await user.click(switchEl);
    expect(switchEl).not.toBeChecked();
  });

  it("respects disabled state", async () => {
    const user = userEvent.setup();
    render(<Switch aria-label="Disabled switch" disabled />);

    const switchEl = screen.getByRole("switch", { name: "Disabled switch" });
    expect(switchEl).toBeDisabled();

    await user.click(switchEl);
    expect(switchEl).not.toBeChecked();
  });
});
