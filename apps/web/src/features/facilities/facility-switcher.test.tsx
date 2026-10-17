import type { ApiFacilityAssignment } from "@metastorage/contracts";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FACILITY_CONTEXT_MESSAGES } from "./facility-context.messages";
import { FacilitySwitcher } from "./facility-switcher";

const mockAssignment1: ApiFacilityAssignment = {
  id: "assign-1",
  facilityId: "fac-hcm-central",
  userId: "user-1",
  role: "FACILITY_MANAGER",
  assignedAt: "2026-01-01T00:00:00Z",
  endedAt: null,
  isActive: true,
  facilityName: "metastorage Sài Gòn Central",
  facilityCode: "HCM-01",
};

const mockAssignment2: ApiFacilityAssignment = {
  id: "assign-2",
  facilityId: "fac-hn-west",
  userId: "user-1",
  role: "FACILITY_MANAGER",
  assignedAt: "2026-01-01T00:00:00Z",
  endedAt: null,
  isActive: true,
  facilityName: "metastorage Hà Nội West",
  facilityCode: "HN-01",
};

describe("FacilitySwitcher", () => {
  it("renders single-facility badge without dropdown selector for single assigned facility", () => {
    const onSwitch = vi.fn();
    render(
      <FacilitySwitcher
        activeAssignments={[mockAssignment1]}
        currentFacilityId="fac-hcm-central"
        onSwitchFacility={onSwitch}
      />,
    );

    expect(screen.getByText(FACILITY_CONTEXT_MESSAGES.singleFacilityLabel)).toBeInTheDocument();
    expect(screen.getByText("metastorage Sài Gòn Central")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("renders dropdown selector when FM manages multiple facilities", async () => {
    const user = userEvent.setup();
    const onSwitch = vi.fn();
    render(
      <FacilitySwitcher
        activeAssignments={[mockAssignment1, mockAssignment2]}
        currentFacilityId="fac-hcm-central"
        onSwitchFacility={onSwitch}
      />,
    );

    expect(screen.getByText(FACILITY_CONTEXT_MESSAGES.activeFacilityLabel)).toBeInTheDocument();
    const select = screen.getByRole("combobox", {
      name: FACILITY_CONTEXT_MESSAGES.switchFacilityPrompt,
    });
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue("fac-hcm-central");

    await user.selectOptions(select, "fac-hn-west");
    expect(onSwitch).toHaveBeenCalledWith("fac-hn-west");
  });

  it("renders nothing when there are no active assignments", () => {
    const onSwitch = vi.fn();
    const { container } = render(
      <FacilitySwitcher activeAssignments={[]} currentFacilityId="" onSwitchFacility={onSwitch} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
