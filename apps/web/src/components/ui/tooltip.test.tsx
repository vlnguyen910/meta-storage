import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TooltipSimple } from "./tooltip";

describe("Tooltip", () => {
  it("renders trigger and displays tooltip on hover", async () => {
    const user = userEvent.setup();
    render(
      <TooltipSimple content="Chi tiết trợ giúp">
        <button type="button">Hover me</button>
      </TooltipSimple>,
    );

    const button = screen.getByRole("button", { name: "Hover me" });
    expect(button).toBeInTheDocument();

    await user.hover(button);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Chi tiết trợ giúp");
  });
});
