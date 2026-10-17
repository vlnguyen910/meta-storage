"use client";

import { FacilityStatus } from "@metastorage/contracts";
import { Download, RotateCcw } from "lucide-react";
import Link from "next/link";
import { Button, buttonClassName } from "@/components/ui/button";
import { FieldShell, Input, Select } from "@/components/ui/form-controls";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { businessOperationsRoutes as routes } from "@/config/routes";
import { cn } from "@/lib/cn";
import { OPERATIONS_MESSAGES as M } from "./operations.messages";
import type { OperationsWorkspaceProps } from "./operations.types";
import { formatPercentage } from "./operations.utils";
import { OperationsConfiguration } from "./operations-configuration";
import { OperationsDialog, OperationsTable } from "./operations-parts";
import { OperationsReports } from "./operations-reports";
import { useOperationsWorkspace } from "./use-operations-workspace";

export function OperationsWorkspace({ section }: Readonly<OperationsWorkspaceProps>) {
  const workspace = useOperationsWorkspace();
  const {
    query,
    data,
    facilities,
    totals,
    facilityId,
    setFacilityId,
    search,
    setSearch,
    feedback,
    unitTypeId,
    setUnitTypeId,
    period,
    setPeriod,
  } = workspace;
  if (query.isPending) return <LoadingState label={M.loading} />;
  if (query.isError || !data)
    return <ErrorState message={M.error} onRetry={() => void query.refetch()} />;
  const configuration = ["pricing", "fees", "business-rules"].includes(section);
  return (
    <div className="grid min-w-0 gap-6">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold text-slate-600">{M.breadcrumb}</p>
          <h1 className="text-3xl font-bold text-ink sm:text-4xl">{M.titles[section]}</h1>
          <p className="mb-0 mt-3 max-w-3xl text-sm text-slate-600">{M.descriptions[section]}</p>
        </div>
        {(section === "revenue" || section === "utilization") && (
          <Link href={routes.reports} className={buttonClassName("outline")}>
            {M.backReports}
          </Link>
        )}
      </header>
      {!configuration && (
        <section
          className={cn(
            "grid items-end gap-4 rounded-card border border-outline-variant bg-surface-container-lowest p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)] md:grid-cols-2",
            section === "facilities" ? "xl:grid-cols-[1fr_1.2fr_auto]" : "xl:grid-cols-4",
          )}
        >
          <FieldShell label={M.facilityFilter}>
            <Select value={facilityId} onChange={(event) => setFacilityId(event.target.value)}>
              <option value="all">{M.allFacilities}</option>
              {data.facilities.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.name}
                </option>
              ))}
            </Select>
          </FieldShell>
          {section === "facilities" ? (
            <FieldShell label={M.search}>
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </FieldShell>
          ) : (
            <>
              <FieldShell label={M.unitTypeFilter}>
                <Select value={unitTypeId} onChange={(event) => setUnitTypeId(event.target.value)}>
                  <option value="all">{M.allUnitTypes}</option>
                  {data.prices.map((price) => (
                    <option key={price.id} value={price.id}>
                      {price.name}
                    </option>
                  ))}
                </Select>
              </FieldShell>
              <FieldShell label={M.periodLabel}>
                <Select value={period} onChange={(event) => setPeriod(event.target.value)}>
                  <option value="sample">{M.period}</option>
                  <option value="previous">{M.previousPeriod}</option>
                </Select>
              </FieldShell>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              icon={<RotateCcw size={17} aria-hidden="true" />}
              onClick={workspace.resetFilters}
              aria-label={M.reset}
            >
              {M.reset}
            </Button>
            <Button
              type="button"
              icon={<Download size={17} aria-hidden="true" />}
              onClick={workspace.exportFacilities}
            >
              {M.export}
            </Button>
          </div>
        </section>
      )}
      {feedback && (
        <p role="status" className="m-0 rounded-xl bg-primary-soft p-4 text-sm text-primary">
          {feedback}
        </p>
      )}
      {configuration ? (
        <OperationsConfiguration
          section={section}
          prices={data.prices}
          onEditPrice={workspace.editPrice}
        />
      ) : facilities.length === 0 ? (
        <section
          role="status"
          className="rounded-card border border-dashed border-outline-variant bg-surface-container-lowest p-8 text-center"
        >
          <h2 className="text-xl font-bold">{M.empty}</h2>
          <p className="mb-0 mt-3 text-sm text-slate-600">{M.emptyDetail}</p>
        </section>
      ) : section === "facilities" ? (
        <OperationsTable label={M.titles.facilities} headings={M.facilityHeadings}>
          {facilities.map((facility) => (
            <tr key={facility.id}>
              <th scope="row" className="min-w-48 px-5 py-5">
                <span className="mb-2 inline-block rounded-lg bg-primary-soft px-2 py-1 text-xs font-bold text-primary">
                  {facility.id}
                </span>
                <span className="block text-primary">{facility.name}</span>
              </th>
              <td className="min-w-48 px-5 py-5 text-slate-600">{facility.address}</td>
              <td className="px-5 py-5 tabular-nums">{facility.total}</td>
              <td className="whitespace-nowrap px-5 py-5 font-semibold tabular-nums text-primary">
                {formatPercentage((facility.occupied / facility.total) * 100)}
              </td>
              <td className="whitespace-nowrap px-5 py-5">
                <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
                  {facility.status === FacilityStatus.ACTIVE ? M.active : M.inactive}
                </span>
              </td>
              <td className="px-5 py-5">
                <Button
                  type="button"
                  variant="outline"
                  aria-label={M.editFacilityLabel(facility.name)}
                  onClick={() => workspace.editFacility(facility)}
                >
                  {M.edit}
                </Button>
              </td>
            </tr>
          ))}
        </OperationsTable>
      ) : (
        <OperationsReports
          section={section}
          facilities={facilities}
          totals={totals}
          unitTypeId={unitTypeId}
        />
      )}
      <p className="m-0 text-xs text-slate-600">{M.demoNote}</p>
      {workspace.editingFacility && (
        <OperationsDialog title={M.editFacility} onClose={workspace.closeFacility}>
          <form
            noValidate
            className="grid gap-4"
            onSubmit={workspace.facilityForm.handleSubmit(workspace.saveFacility)}
          >
            <FieldShell
              label={M.facilityName}
              error={workspace.facilityForm.formState.errors.name?.message}
            >
              <Input {...workspace.facilityForm.register("name")} autoFocus />
            </FieldShell>
            <FieldShell
              label={M.facilityAddress}
              error={workspace.facilityForm.formState.errors.address?.message}
            >
              <Input {...workspace.facilityForm.register("address")} />
            </FieldShell>
            <div className="mt-2 flex flex-wrap justify-end gap-3">
              <Button type="button" variant="outline" onClick={workspace.closeFacility}>
                {M.cancel}
              </Button>
              <Button type="submit" loading={workspace.mutation.isPending}>
                {M.save}
              </Button>
            </div>
          </form>
        </OperationsDialog>
      )}
      {workspace.editingPrice && (
        <OperationsDialog
          title={M.editPriceLabel(workspace.editingPrice.name)}
          onClose={workspace.closePrice}
        >
          <form
            noValidate
            className="grid gap-4"
            onSubmit={workspace.priceForm.handleSubmit(workspace.savePrice)}
          >
            <FieldShell
              label={M.newPrice}
              error={workspace.priceForm.formState.errors.monthlyPrice?.message}
            >
              <Input
                type="number"
                min={0}
                step="any"
                {...workspace.priceForm.register("monthlyPrice", { valueAsNumber: true })}
                autoFocus
              />
            </FieldShell>
            <div className="mt-2 flex flex-wrap justify-end gap-3">
              <Button type="button" variant="outline" onClick={workspace.closePrice}>
                {M.cancel}
              </Button>
              <Button type="submit" loading={workspace.mutation.isPending}>
                {M.save}
              </Button>
            </div>
          </form>
        </OperationsDialog>
      )}
    </div>
  );
}
