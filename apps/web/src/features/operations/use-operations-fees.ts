"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { OPERATIONS_MESSAGES as M } from "./operations.messages";
import { OperationsFeeDraftSchema } from "./operations.schema";
import type { OperationsFeeDraft } from "./operations.types";

const draftKey = ["operations", "mock-fee-draft"] as const;

export function useOperationsFees() {
  const cache = useQueryClient();
  const [feedback, setFeedback] = useState("");
  const form = useForm<OperationsFeeDraft>({
    resolver: zodResolver(OperationsFeeDraftSchema),
    defaultValues: cache.getQueryData<OperationsFeeDraft>(draftKey) ?? {
      method: "unconfigured",
      value: "",
      extraCharge: "",
      damageCharge: "",
    },
  });

  async function save(values: OperationsFeeDraft) {
    cache.setQueryData(draftKey, values);
    setFeedback(M.saved);
  }

  return { form, save, feedback };
}
