"use client";

import { Button } from "@/components/ui/button";
import { FieldShell, Input, Select } from "@/components/ui/form-controls";
import { formatCurrency } from "@/lib/format";
import { OPERATIONS_MESSAGES as M } from "./operations.messages";
import { operationsRules } from "./operations.mock";
import type { OperationsConfigurationProps } from "./operations.types";
import { OperationsTable } from "./operations-parts";
import { useOperationsFees } from "./use-operations-fees";

export function OperationsConfiguration({
  section,
  prices,
  onEditPrice,
}: Readonly<OperationsConfigurationProps>) {
  if (section === "pricing") {
    return (
      <section className="grid gap-5">
        <p className="rounded-card border border-outline-variant bg-surface-container-lowest p-4 text-sm text-slate-600">
          {M.priceScope}
        </p>
        <OperationsTable label={M.titles.pricing} headings={M.priceHeadings}>
          {prices.map((price) => (
            <tr key={price.id}>
              <th scope="row" className="px-5 py-5 text-primary">
                {price.name}
              </th>
              <td className="px-5 py-5 tabular-nums">
                {price.area} {M.areaUnit}
              </td>
              <td className="whitespace-nowrap px-5 py-5 font-semibold tabular-nums">
                {formatCurrency(price.monthlyPrice)}
              </td>
              <td className="px-5 py-5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onEditPrice(price)}
                  aria-label={M.editPriceLabel(price.name)}
                >
                  {M.edit}
                </Button>
              </td>
            </tr>
          ))}
        </OperationsTable>
      </section>
    );
  }
  if (section === "fees") return <OperationsFeesForm />;
  return (
    <section className="grid gap-5">
      <p className="text-sm text-slate-600">{M.rulesHelp}</p>
      <OperationsTable label={M.titles["business-rules"]} headings={M.ruleHeadings}>
        {operationsRules.map((rule) => (
          <tr key={rule.name}>
            <td className="whitespace-nowrap px-5 py-5">{rule.group}</td>
            <th scope="row" className="min-w-40 px-5 py-5">
              {rule.name}
            </th>
            <td className="min-w-64 max-w-xl px-5 py-5 leading-relaxed">{rule.value}</td>
            <td className="whitespace-nowrap px-5 py-5">
              <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
                {rule.confirmed ? M.confirmed : M.tbd}
              </span>
            </td>
          </tr>
        ))}
      </OperationsTable>
    </section>
  );
}

function OperationsFeesForm() {
  const { form, save, feedback } = useOperationsFees();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;
  return (
    <form noValidate onSubmit={handleSubmit(save)} className="grid gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="grid content-start gap-5 rounded-card border border-outline-variant bg-surface-container-lowest p-6 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
          <h2 className="text-xl font-bold text-primary">{M.depositPolicy}</h2>
          <FieldShell label={M.depositMethod} error={errors.method?.message}>
            <Select {...register("method")}>
              <option value="unconfigured">{M.unconfigured}</option>
              <option value="fixed">{M.fixed}</option>
              <option value="percentage">{M.percent}</option>
            </Select>
          </FieldShell>
          <FieldShell label={M.depositValue} error={errors.value?.message}>
            <Input type="number" min={0} step="any" {...register("value")} />
          </FieldShell>
          <p className="text-sm text-slate-600">{M.feeHelp}</p>
        </section>
        <section className="grid content-start gap-5 rounded-card border border-outline-variant bg-surface-container-lowest p-6 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
          <h2 className="text-xl font-bold text-primary">{M.feePolicy}</h2>
          <FieldShell label={M.extraCharge} error={errors.extraCharge?.message}>
            <Input type="number" min={0} step="any" {...register("extraCharge")} />
          </FieldShell>
          <FieldShell label={M.damageCharge} error={errors.damageCharge?.message}>
            <Input type="number" min={0} step="any" {...register("damageCharge")} />
          </FieldShell>
        </section>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)]">
        <p className="m-0 max-w-xl text-sm text-slate-600">{M.demoNote}</p>
        <Button type="submit" loading={isSubmitting}>
          {M.save}
        </Button>
      </div>
      {feedback && (
        <p role="status" className="rounded-xl bg-primary-soft p-4 text-primary">
          {feedback}
        </p>
      )}
    </form>
  );
}
