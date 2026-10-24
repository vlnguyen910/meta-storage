# Customer booking read API

Both endpoints require an active authenticated account with role `CUSTOMER`. Ownership is checked against the session `userId` and `bookings.user_id`; contact email is never used to claim a booking. Guest bookings with `user_id = NULL` stay on the existing guest tracking access path.

## List bookings

`GET /api/bookings/mine`

Optional query parameters:

| Parameter | Default | Meaning |
| --- | --- | --- |
| `limit` | `20` | Page size from 1 to 100 |
| `status` | all non-DRAFT statuses | `CONFIRMED`, `CANCELLED`, `NO_SHOW`, or `CHECKED_IN` |
| `afterCreatedAt` | — | Timestamp from `nextCursor` |
| `afterId` | — | Booking ID from `nextCursor` |

Results sort by `createdAt DESC, id DESC`. Send both cursor values from the previous response to get the next page. The timestamp in the cursor preserves PostgreSQL precision; clients should pass it through without parsing or formatting it.

The response data has this shape:

```json
{
  "items": [
    {
      "id": "uuid",
      "bookingCode": "SX-EXAMPLE",
      "status": "CONFIRMED",
      "facility": { "id": "uuid", "name": "Facility", "address": "Address" },
      "unitType": { "id": "uuid", "name": "Small storage", "sizeLabel": "S" },
      "checkInSlotStart": "2031-02-01T02:00:00.000Z",
      "checkInSlotEnd": "2031-02-01T05:00:00.000Z",
      "rentalEndAt": "2031-04-01T02:00:00.000Z",
      "durationMonths": 2,
      "pricing": {
        "monthlyRateSnapshot": "900000.00",
        "rentalFeeAmount": "1800000.00",
        "depositAmount": "900000.00",
        "totalAmount": "2700000.00",
        "currency": "VND"
      },
      "paymentStatus": "SUCCEEDED",
      "paidAt": "2031-01-01T00:00:00.000Z",
      "assignedUnit": { "code": "HCM-01-002", "assignedAt": "2031-01-01T00:00:00.000Z" },
      "handoverStage": "WAITING_CUSTOMER",
      "createdAt": "2031-01-01T00:00:00.000Z"
    }
  ],
  "nextCursor": null
}
```

`paymentStatus` is the newest payment attempt by `createdAt DESC, id DESC`; it is `NOT_STARTED` when no attempt exists. This is a current status indicator, not payment history. `assignedUnit` is `null` before a physical unit is assigned.

## Booking detail

`GET /api/bookings/mine/:id`

Returns the same customer-safe booking DTO for a non-DRAFT booking owned by the signed-in customer. A DRAFT booking, a booking with no matching `user_id`, or a booking owned by another account returns `404`.

These endpoints do not expose contact details, access token hashes, QR token hashes, payment provider references, or staff contact details. Existing `GET /api/bookings/:id` remains an operational endpoint with facility assignment checks for facility staff and managers.

## Web migration handoff

The Web reservations dashboard/list/detail still use `api.reservations.mine` and `api.reservations.get`. A follow-up UI change should use `api.bookings.mine` and `api.bookings.getMine`, consume the `items`/`nextCursor` page, and handle the booking DTO above. This issue adds the API/client methods only; it does not migrate Web or Mobile screens.
