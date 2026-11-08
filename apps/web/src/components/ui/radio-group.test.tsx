import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { RadioGroup, RadioGroupItem } from "./radio-group";

describe("RadioGroup", () => {
  it("allows selecting options", async () => {
    const user = userEvent.setup();
    render(
      <RadioGroup defaultValue="opt1" aria-label="Choices">
        <label htmlFor="opt1">
          <RadioGroupItem id="opt1" value="opt1" aria-label="Option 1" />
          Option 1
        </label>
        <label htmlFor="opt2">
          <RadioGroupItem id="opt2" value="opt2" aria-label="Option 2" />
          Option 2
        </label>
      </RadioGroup>,
    );

    const opt1 = screen.getByRole("radio", { name: "Option 1" });
    const opt2 = screen.getByRole("radio", { name: "Option 2" });

    expect(opt1).toBeChecked();
    expect(opt2).not.toBeChecked();

    await user.click(opt2);
    expect(opt1).not.toBeChecked();
    expect(opt2).toBeChecked();
  });
});
