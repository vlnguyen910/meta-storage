# Customer Support API

Support is an immutable, one-way customer request. The backend exposes booking
and payment context discovery plus ticket create, list, and detail endpoints.
There are no reply, chat, attachment, or image endpoints.

All routes are under `/api/support` and require an authenticated CUSTOMER.
Responses use `{ success: true, data, timestamp }`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/contexts?category=PAYMENT\|UNIT\|LOCK\|ACCESS_CODE\|STORED_ITEMS` | List the customer's eligible bookings |
| GET | `/contexts/:bookingId/payments` | List payment attempts for an owned booking |
| POST | `/tickets` | Create an immutable request |
| GET | `/tickets` | List the customer's requests |
| GET | `/tickets/:ticketId` | Read the request and its description |

Create body:

```json
{
  "bookingId": "<uuid>",
  "category": "PAYMENT",
  "paymentId": "<optional uuid>",
  "subject": "Payment not recorded",
  "content": "Please check my transaction.",
  "idempotencyKey": "customer-request-001"
}
```

The initial `content` is persisted as `support_tickets.description`. A unique
`(owner_user_id, idempotency_key)` constraint makes retries safe. Repeating the
same key with the same booking, category, payment, subject, and content returns
the original ticket. Reusing it with changed request data returns 409.

Warehouse requests require a checked-in booking with an active rental. Payment
requests may be submitted before handover; an optional payment must belong to
the booking. Ticket creation and its customer receipt outbox event commit in one
transaction.

The ticket response retains compatibility fields for existing clients while the
request is immutable; its message list is always empty. Frontend and mobile
chat/upload screens and API-client methods require a separate cleanup.
