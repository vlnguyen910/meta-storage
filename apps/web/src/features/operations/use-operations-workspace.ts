"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { OPERATIONS_MESSAGES as M } from "./operations.messages";
import { operationsMockData, operationsTypeMetrics } from "./operations.mock";
import { OperationsFacilityDraftSchema, OperationsPriceDraftSchema } from "./operations.schema";
import type {
  OperationsFacility,
  OperationsFacilityDraft,
  OperationsMockData,
  OperationsPrice,
  OperationsPriceDraft,
} from "./operations.types";
import { downloadCsv, filterFacilities, summarizeFacilities, toCsv } from "./operations.utils";

const queryKey = ["operations", "mock-workspace"] as const;

export function useOperationsWorkspace() {
  const cache = useQueryClient();
  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<OperationsMockData> => structuredClone(operationsMockData),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  });
  const [facilityId, setFacilityId] = useState("all");
  const [search, setSearch] = useState("");
  const [unitTypeId, setUnitTypeId] = useState("all");
  const [period, setPeriod] = useState("sample");
  const [editingFacility, setEditingFacility] = useState<OperationsFacility | null>(null);
  const [editingPrice, setEditingPrice] = useState<OperationsPrice | null>(null);
  const [feedback, setFeedback] = useState("");
  const facilityForm = useForm<OperationsFacilityDraft>({
    resolver: zodResolver(OperationsFacilityDraftSchema),
  });
  const priceForm = useForm<OperationsPriceDraft>({
    resolver: zodResolver(OperationsPriceDraftSchema),
  });
  const mutation = useMutation({
    mutationFn: async (data: OperationsMockData) => data,
    onSuccess: (data) => {
      cache.setQueryData(queryKey, data);
      setEditingFacility(null);
      setEditingPrice(null);
      setFeedback(M.saved);
    },
    onError: () => setFeedback(M.error),
  });
  const data = query.data;
  const selectedFacilities = filterFacilities(data?.facilities ?? [], facilityId, search);
  const facilities =
    period !== "sample"
      ? []
      : selectedFacilities.map((facility) => {
          const metrics = operationsTypeMetrics[facility.id]?.[unitTypeId];
          return metrics ? { ...facility, ...metrics } : facility;
        });
  const totals = summarizeFacilities(facilities);

  function editFacility(facility: OperationsFacility) {
    setFeedback("");
    setEditingFacility(facility);
    facilityForm.reset({ name: facility.name, address: facility.address });
  }

  function editPrice(price: OperationsPrice) {
    setFeedback("");
    setEditingPrice(price);
    priceForm.reset({ monthlyPrice: price.monthlyPrice });
  }

  function saveFacility(values: OperationsFacilityDraft) {
    if (!data || !editingFacility) return;
    mutation.mutate({
      ...data,
      facilities: data.facilities.map((item) =>
        item.id === editingFacility.id ? { ...item, ...values } : item,
      ),
    });
  }

  function savePrice(values: OperationsPriceDraft) {
    if (!data || !editingPrice) return;
    mutation.mutate({
      ...data,
      prices: data.prices.map((item) =>
        item.id === editingPrice.id ? { ...item, ...values } : item,
      ),
    });
  }

  function resetFilters() {
    setFacilityId("all");
    setSearch("");
    setUnitTypeId("all");
    setPeriod("sample");
  }

  function exportFacilities() {
    downloadCsv(
      toCsv([
        [
          M.facilityName,
          M.total,
          M.occupied,
          M.available,
          M.reserved,
          M.maintenance,
          M.rent,
          M.deposit,
        ],
        ...facilities.map((item) => [
          item.name,
          item.total,
          item.occupied,
          item.available,
          item.reserved,
          item.maintenance,
          item.rentalCollected,
          item.depositHeld,
        ]),
      ]),
      "storex-operations-mock.csv",
    );
  }

  return {
    query,
    data,
    facilities,
    totals,
    facilityId,
    setFacilityId,
    search,
    setSearch,
    unitTypeId,
    setUnitTypeId,
    period,
    setPeriod,
    resetFilters,
    exportFacilities,
    editFacility,
    editPrice,
    editingFacility,
    editingPrice,
    closeFacility: () => setEditingFacility(null),
    closePrice: () => setEditingPrice(null),
    facilityForm,
    priceForm,
    saveFacility,
    savePrice,
    mutation,
    feedback,
  };
}
