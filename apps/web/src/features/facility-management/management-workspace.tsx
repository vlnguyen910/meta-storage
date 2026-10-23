"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  type ApiFacility,
  type ApiFacilityAssignment,
  type ApiUnitType,
  type CreateAssignmentBody,
  type CreateFacilityBody,
  type CreateUnitTypeInput,
  CreateUnitTypeSchema,
  createAssignmentBodySchema,
  createFacilityBodySchema,
} from "@metastorage/contracts";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form-controls";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { isMockMode } from "@/config/api-mode";
import { useAuthStore } from "@/features/auth/auth-store";
import {
  managementError,
  useAssignableAccounts,
  useAssignMember,
  useCreateFacility,
  useCreateType,
  useFacilityOptions,
  useManagedFacility,
  useManagedTypes,
  useMemberships,
  useOfferings,
  useRevokeMember,
  useSetOffering,
  useUpdateFacility,
  useUpdateType,
} from "./hooks";
import { F5 } from "./management.messages";
import type { FacilityPanelProps, ManagementWorkspaceProps } from "./management.types";
import { ManagementDialog, ManagementField, panelClass, textareaClass } from "./management-ui";
import { InventoryPanel } from "./unit-inventory";

const tabLabels = {
  facilities: F5.facilities,
  types: F5.types,
  offerings: F5.offerings,
  memberships: F5.memberships,
  units: F5.inventory,
};

export function FacilityManagementWorkspace({ membershipsOnly = false }: ManagementWorkspaceProps) {
  const scope = useFacilityOptions(true);
  const [tab, setTab] = useState<keyof typeof tabLabels>(
    membershipsOnly ? "memberships" : "facilities",
  );
  const [creating, setCreating] = useState(false);
  if (isMockMode) return <p role="status">{F5.noMock}</p>;
  if (scope.query.isPending) return <LoadingState variant="table" />;
  if (scope.query.isError)
    return <ErrorState message={F5.loadError} onRetry={() => scope.query.refetch()} />;
  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-3xl font-bold">
          {membershipsOnly ? F5.memberships : F5.administration}
        </h1>
      </header>
      {!membershipsOnly && (
        <nav aria-label={F5.title} className="flex flex-wrap gap-2">
          {(Object.keys(tabLabels) as Array<keyof typeof tabLabels>).map((value) => (
            <Button
              type="button"
              key={value}
              variant={tab === value ? "primary" : "outline"}
              aria-pressed={tab === value}
              onClick={() => setTab(value)}
            >
              {tabLabels[value]}
            </Button>
          ))}
        </nav>
      )}
      {tab !== "types" && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <ManagementField label={F5.facility}>
                <Select
                  value={scope.facilityId}
                  onChange={(event) => scope.select(event.target.value)}
                >
                  {scope.query.data.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} · {item.name}
                    </option>
                  ))}
                </Select>
              </ManagementField>
            </div>
            {!membershipsOnly && (
              <Button type="button" onClick={() => setCreating(true)}>
                {F5.newFacility}
              </Button>
            )}
          </div>
          {!scope.facilityId && <p role="status">{F5.empty}</p>}
        </>
      )}
      {tab === "types" ? (
        <TypeCatalog />
      ) : scope.facilityId ? (
        <div key={`${tab}:${scope.facilityId}`}>
          {tab === "facilities" && <FacilityDetails facilityId={scope.facilityId} />}
          {tab === "offerings" && <FacilityOfferings facilityId={scope.facilityId} />}
          {tab === "memberships" && <FacilityMemberships facilityId={scope.facilityId} />}
          {tab === "units" && <InventoryPanel facilityId={scope.facilityId} canEdit={false} />}
        </div>
      ) : null}
      {creating && (
        <FacilityEditor
          onClose={() => setCreating(false)}
          onSaved={(facility) => {
            scope.select(facility.id);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function FacilityDetails({ facilityId }: FacilityPanelProps) {
  const query = useManagedFacility(facilityId);
  const [editing, setEditing] = useState(false);
  if (query.isPending) return <LoadingState variant="detail" />;
  if (query.isError)
    return <ErrorState message={managementError(query.error)} onRetry={() => query.refetch()} />;
  const facility = query.data;
  return (
    <section className={`${panelClass} grid gap-4`}>
      <h2 className="text-xl font-bold">
        {facility.code} · {facility.name}
      </h2>
      <p>{facility.address}</p>
      <p className="whitespace-pre-wrap break-words text-sm">{facility.description}</p>
      <p className="font-semibold">{facility.isActive ? F5.active : F5.inactive}</p>
      <Button type="button" variant="outline" onClick={() => setEditing(true)}>
        {F5.edit}
      </Button>
      {editing && (
        <FacilityEditor
          facility={facility}
          onClose={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      )}
    </section>
  );
}

function FacilityEditor({
  facility,
  onClose,
  onSaved,
}: {
  facility?: ApiFacility;
  onClose: () => void;
  onSaved: (facility: ApiFacility) => void;
}) {
  const create = useCreateFacility();
  const update = useUpdateFacility(facility?.id ?? "");
  const mutation = facility ? update : create;
  const form = useForm<
    Omit<CreateFacilityBody, "isActive"> & { isActive?: boolean },
    unknown,
    CreateFacilityBody
  >({
    resolver: zodResolver(createFacilityBodySchema),
    defaultValues: {
      code: facility?.code ?? "",
      name: facility?.name ?? "",
      address: facility?.address ?? "",
      description: facility?.description ?? "",
      isActive: facility?.isActive ?? true,
    },
  });
  return (
    <ManagementDialog
      title={facility ? F5.editFacility : F5.newFacility}
      onClose={onClose}
      pending={mutation.isPending}
    >
      <form
        noValidate
        className="grid gap-4"
        onSubmit={form.handleSubmit(async (input) => {
          try {
            onSaved(facility ? await update.mutateAsync(input) : await create.mutateAsync(input));
          } catch {
            /* Show backend constraint errors. */
          }
        })}
      >
        <ManagementField label={F5.code} error={form.formState.errors.code?.message}>
          <Input {...form.register("code")} />
        </ManagementField>
        <ManagementField label={F5.name} error={form.formState.errors.name?.message}>
          <Input {...form.register("name")} />
        </ManagementField>
        <ManagementField label={F5.address} error={form.formState.errors.address?.message}>
          <Input {...form.register("address")} />
        </ManagementField>
        <ManagementField
          label={F5.descriptionLabel}
          error={form.formState.errors.description?.message}
        >
          <textarea className={textareaClass} {...form.register("description")} />
        </ManagementField>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" className="size-5" {...form.register("isActive")} />
          {F5.active}
        </label>
        {mutation.isError && (
          <p role="alert" className="text-danger">
            {managementError(mutation.error)}
          </p>
        )}
        <Button type="submit" disabled={mutation.isPending}>
          {F5.save}
        </Button>
      </form>
    </ManagementDialog>
  );
}

function TypeCatalog() {
  const query = useManagedTypes();
  const [editing, setEditing] = useState<ApiUnitType | "new" | null>(null);
  const [toggling, setToggling] = useState<ApiUnitType | null>(null);
  return (
    <div className="grid gap-4">
      <div>
        <Button type="button" onClick={() => setEditing("new")}>
          {F5.newType}
        </Button>
      </div>
      <p className="text-sm text-slate-600">{F5.pricingHint}</p>
      {query.isPending ? (
        <LoadingState variant="table" />
      ) : query.isError ? (
        <ErrorState message={F5.loadError} onRetry={() => query.refetch()} />
      ) : (
        <>
          {!query.data.length && <p>{F5.empty}</p>}
          <ul className="grid gap-3 sm:grid-cols-2">
            {query.data.map((item) => (
              <li key={item.id} className={`${panelClass} grid gap-3`}>
                <h2 className="text-lg font-bold">
                  {item.code} · {item.name}
                </h2>
                <p>
                  {item.sizeLabel} · {item.lengthM} × {item.widthM} × {item.heightM} m
                </p>
                <p className="text-sm">{item.isActive ? F5.active : F5.inactive}</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditing(item)}>
                    {F5.edit}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setToggling(item)}>
                    {item.isActive ? F5.deactivate : F5.activate}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {editing && (
        <TypeEditor
          type={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {toggling && <TypeStatusEditor type={toggling} onClose={() => setToggling(null)} />}
    </div>
  );
}

function TypeEditor({ type, onClose }: { type?: ApiUnitType; onClose: () => void }) {
  const create = useCreateType();
  const update = useUpdateType(type?.id ?? "");
  const mutation = type ? update : create;
  const form = useForm<CreateUnitTypeInput>({
    resolver: zodResolver(CreateUnitTypeSchema),
    defaultValues: {
      code: type?.code ?? "",
      name: type?.name ?? "",
      sizeLabel: type?.sizeLabel ?? "",
      lengthM: type?.lengthM,
      widthM: type?.widthM,
      heightM: type?.heightM,
      monthlyPrice: type?.monthlyPrice,
    },
  });
  return (
    <ManagementDialog
      title={type ? F5.editType : F5.newType}
      onClose={onClose}
      pending={mutation.isPending}
    >
      <form
        noValidate
        className="grid gap-4"
        onSubmit={form.handleSubmit(async (input) => {
          try {
            if (type) {
              const { monthlyPrice: _price, ...metadata } = input;
              await update.mutateAsync(metadata);
            } else await create.mutateAsync(input);
            onClose();
          } catch {
            /* Keep form input for correction. */
          }
        })}
      >
        <ManagementField label={F5.code} error={form.formState.errors.code?.message}>
          <Input {...form.register("code")} />
        </ManagementField>
        <ManagementField label={F5.name} error={form.formState.errors.name?.message}>
          <Input {...form.register("name")} />
        </ManagementField>
        <ManagementField label={F5.sizeLabel} error={form.formState.errors.sizeLabel?.message}>
          <Input {...form.register("sizeLabel")} />
        </ManagementField>
        <div className="grid gap-4 sm:grid-cols-3">
          {(["lengthM", "widthM", "heightM"] as const).map((field, index) => (
            <ManagementField
              key={field}
              label={[F5.length, F5.width, F5.height][index] ?? F5.length}
              error={form.formState.errors[field]?.message}
            >
              <Input
                type="number"
                step="any"
                min="0"
                {...form.register(field, { valueAsNumber: true })}
              />
            </ManagementField>
          ))}
        </div>
        {!type ? (
          <ManagementField
            label={F5.initialPrice}
            error={form.formState.errors.monthlyPrice?.message}
          >
            <Input
              type="number"
              min="0"
              step="1"
              {...form.register("monthlyPrice", { valueAsNumber: true })}
            />
          </ManagementField>
        ) : (
          <p className="text-sm text-slate-600">{F5.pricingHint}</p>
        )}
        {mutation.isError && (
          <p role="alert" className="text-danger">
            {managementError(mutation.error)}
          </p>
        )}
        <Button type="submit" disabled={mutation.isPending}>
          {F5.save}
        </Button>
      </form>
    </ManagementDialog>
  );
}

function TypeStatusEditor({ type, onClose }: { type: ApiUnitType; onClose: () => void }) {
  const mutation = useUpdateType(type.id);
  return (
    <ManagementDialog
      title={F5.confirmType(type.name)}
      onClose={onClose}
      pending={mutation.isPending}
    >
      <div className="grid gap-4">
        {mutation.isError && (
          <p role="alert" className="text-danger">
            {managementError(mutation.error)}
          </p>
        )}
        <Button
          type="button"
          disabled={mutation.isPending}
          onClick={async () => {
            try {
              await mutation.mutateAsync({ isActive: !type.isActive });
              onClose();
            } catch {
              /* Show error in dialog. */
            }
          }}
        >
          {type.isActive ? F5.deactivate : F5.activate}
        </Button>
      </div>
    </ManagementDialog>
  );
}

function FacilityOfferings({ facilityId }: FacilityPanelProps) {
  const types = useManagedTypes();
  const offerings = useOfferings(facilityId);
  const mutation = useSetOffering(facilityId);
  if (types.isPending || offerings.isPending) return <LoadingState variant="table" />;
  if (types.isError || offerings.isError)
    return (
      <ErrorState
        message={F5.loadError}
        onRetry={() => {
          void types.refetch();
          void offerings.refetch();
        }}
      />
    );
  return (
    <section className="grid gap-4">
      <h2 className="text-xl font-bold">{F5.offerings}</h2>
      {mutation.isError && (
        <p role="alert" className="text-danger">
          {managementError(mutation.error)}
        </p>
      )}
      {!types.data.length && <p>{F5.empty}</p>}
      <ul className="grid gap-3">
        {types.data.map((type) => {
          const active = offerings.data.some((row) => row.unitTypeId === type.id && row.isActive);
          return (
            <li
              key={type.id}
              className={`${panelClass} flex flex-wrap items-center justify-between gap-3`}
            >
              <div>
                <h3 className="font-bold">
                  {type.code} · {type.name}
                </h3>
                <p className="text-sm">
                  {type.sizeLabel} · {active ? F5.enabled : F5.disabled}
                  {!type.isActive && ` · ${F5.inactive}`}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={mutation.isPending || (!active && !type.isActive)}
                onClick={() => mutation.mutate({ unitTypeId: type.id, isActive: !active })}
              >
                {active ? F5.disable : F5.enable}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function FacilityMemberships({ facilityId }: FacilityPanelProps) {
  const query = useMemberships(facilityId);
  const isAdmin = useAuthStore((state) => state.session?.user.role === "SYSTEM_ADMIN");
  const accounts = useAssignableAccounts(isAdmin);
  const assign = useAssignMember(facilityId);
  const [revoking, setRevoking] = useState<ApiFacilityAssignment | null>(null);
  const form = useForm<CreateAssignmentBody>({
    resolver: zodResolver(createAssignmentBodySchema),
    defaultValues: { userId: "", role: "FACILITY_STAFF" },
  });
  const role = form.watch("role");
  return (
    <div className="grid gap-5">
      <form
        noValidate
        className={`${panelClass} grid gap-4`}
        onSubmit={form.handleSubmit(async (input) => {
          try {
            await assign.mutateAsync(input);
            form.reset({ userId: "", role: input.role });
          } catch {
            /* Show assignment guard error. */
          }
        })}
      >
        <h2 className="text-xl font-bold">{F5.assignPerson}</h2>
        <ManagementField label={F5.role} error={form.formState.errors.role?.message}>
          <Select {...form.register("role", { onChange: () => form.setValue("userId", "") })}>
            <option value="FACILITY_STAFF">{F5.employee}</option>
            <option value="FACILITY_MANAGER">{F5.manager}</option>
          </Select>
        </ManagementField>
        <ManagementField
          label={isAdmin ? F5.user : F5.userId}
          error={form.formState.errors.userId?.message}
        >
          {isAdmin ? (
            <Select {...form.register("userId")}>
              <option value="">{F5.choose}</option>
              {accounts.data
                ?.filter((item) => item.status === "ACTIVE" && item.role === role)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.email}
                  </option>
                ))}
            </Select>
          ) : (
            <Input {...form.register("userId")} />
          )}
        </ManagementField>
        {!isAdmin && <p className="text-sm text-slate-600">{F5.bomUserHint}</p>}
        {isAdmin && accounts.isError && (
          <ErrorState message={F5.loadError} onRetry={() => accounts.refetch()} />
        )}
        {assign.isError && (
          <p role="alert" className="text-danger">
            {managementError(assign.error)}
          </p>
        )}
        {assign.isSuccess && <p role="status">{F5.saved}</p>}
        <Button
          type="submit"
          disabled={assign.isPending || (isAdmin && (accounts.isPending || accounts.isError))}
        >
          {F5.assignPerson}
        </Button>
      </form>
      {query.isPending ? (
        <LoadingState variant="table" />
      ) : query.isError ? (
        <ErrorState message={F5.loadError} onRetry={() => query.refetch()} />
      ) : (
        <>
          {!query.data.length && <p>{F5.empty}</p>}
          <ul className="grid gap-3">
            {query.data.map((item) => (
              <li
                key={item.id}
                className={`${panelClass} flex flex-wrap items-center justify-between gap-3`}
              >
                <div>
                  <h3 className="font-bold">{item.userName ?? item.userId}</h3>
                  <p className="break-all text-sm">{item.userEmail}</p>
                  <p className="text-sm">
                    {item.role === "FACILITY_MANAGER" ? F5.manager : F5.employee} ·{" "}
                    {item.isActive ? F5.active : F5.inactive}
                  </p>
                </div>
                {item.isActive && (
                  <Button type="button" variant="outline" onClick={() => setRevoking(item)}>
                    {F5.revoke}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {revoking && (
        <MembershipRevoke
          facilityId={facilityId}
          assignment={revoking}
          onClose={() => setRevoking(null)}
        />
      )}
    </div>
  );
}

function MembershipRevoke({
  facilityId,
  assignment,
  onClose,
}: FacilityPanelProps & { assignment: ApiFacilityAssignment; onClose: () => void }) {
  const mutation = useRevokeMember(facilityId);
  return (
    <ManagementDialog
      pending={mutation.isPending}
      title={F5.confirmRevoke(assignment.userName ?? assignment.userId)}
      onClose={onClose}
    >
      <div className="grid gap-4">
        <p className="text-sm">{F5.revokeHint}</p>
        {mutation.isError && (
          <p role="alert" className="text-danger">
            {managementError(mutation.error)}
          </p>
        )}
        <Button
          type="button"
          disabled={mutation.isPending}
          onClick={async () => {
            try {
              await mutation.mutateAsync(assignment.userId);
              onClose();
            } catch {
              /* Show conflict without losing confirmation context. */
            }
          }}
        >
          {F5.revoke}
        </Button>
      </div>
    </ManagementDialog>
  );
}
