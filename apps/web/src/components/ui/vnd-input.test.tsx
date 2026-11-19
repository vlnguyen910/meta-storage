import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { VndInput } from "./form-controls";

function Harness({ onChange }: { onChange: (value: number | undefined) => void }) {
  const [value, setValue] = useState<number | undefined>(3300000);
  return (
    <VndInput
      aria-label="price"
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe("VndInput", () => {
  it("shows thousands separators and the đ unit", () => {
    render(<Harness onChange={() => undefined} />);
    expect((screen.getByLabelText("price") as HTMLInputElement).value).toBe("3.300.000");
    expect(screen.getByText("đ")).toBeTruthy();
  });

  it("parses typed digits into a whole number and ignores other characters", () => {
    const seen: Array<number | undefined> = [];
    render(<Harness onChange={(value) => seen.push(value)} />);
    const input = screen.getByLabelText("price") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "4.300.0000" } });
    expect(seen.at(-1)).toBe(43000000);
    expect(input.value).toBe("43.000.000");
    fireEvent.change(input, { target: { value: "" } });
    expect(seen.at(-1)).toBeUndefined();
  });
});
