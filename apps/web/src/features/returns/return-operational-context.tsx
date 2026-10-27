import type { ReturnOperationalContextDto } from "@metastorage/contracts";
import { F3 } from "./integration.messages";
import { f3Panel, money } from "./integration-utils";
export function ReturnOperationalContext({
  context,
  timezone,
}: {
  context: ReturnOperationalContextDto;
  timezone: string;
}) {
  return (
    <section className={f3Panel}>
      <h2 className="font-bold text-lg">{F3.operationalContext}</h2>
      <dl className="grid gap-4 sm:grid-cols-2">
        {[
          [F3.unknownCustomer, context.customer.name ?? F3.unknownCustomer],
          [F3.bookingCode, context.booking.bookingCode ?? F3.unknown],
          [F3.facility, context.facility.name],
          [
            F3.unitLabel,
            `${context.unit.code} · ${context.unit.unitTypeName} · ${context.unit.sizeLabel}`,
          ],
          [
            F3.rentalEnd,
            new Date(context.rental.expectedEndAt).toLocaleString("vi-VN", { timeZone: timezone }),
          ],
          [F3.deposit, money(context.rental.depositSnapshot)],
          [F3.staffLabel, context.assignedStaff?.name ?? F3.unknown],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-slate-600">{label}</dt>
            <dd className="break-words font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      {context.customer.phone && (
        <a
          href={`tel:${context.customer.phone}`}
          className="inline-flex min-h-11 items-center font-semibold text-primary underline"
        >
          {context.customer.phone}
        </a>
      )}
    </section>
  );
}
