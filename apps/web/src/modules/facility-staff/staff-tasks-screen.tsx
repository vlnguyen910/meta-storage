"use client";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/states";
import { StaffWorkList } from "./staff-work-list";
export function StaffTasksScreen() {
  return (
    <Suspense fallback={<LoadingState variant="table" />}>
      <StaffWorkList />
    </Suspense>
  );
}
