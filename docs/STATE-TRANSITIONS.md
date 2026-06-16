# State Transitions: Orders & Loads

## Order Statuses

Main flow:

```
scheduled → picked_up → ready_for_wash → in_progress → ready_for_delivery → out_for_delivery → delivered
```

| Status | Description |
|---|---|
| `scheduled` | Order created, awaiting pickup |
| `picked_up` | Driver collected the laundry |
| `ready_for_wash` | All loads assigned to shelf locations |
| `in_progress` | At least one load is being washed/dried/folded |
| `ready_for_delivery` | All loads cleaned and weighed; ready to ship |
| `out_for_delivery` | Driver on the way to customer |
| `delivered` | ✅ Terminal |
| `cancelled` | ✅ Terminal |

### Payment status

Payment is tracked separately via a `paymentStatus` field (`PaymentStatus` enum) on the Order model — it is not part of the order status flow.

| Value | Meaning |
|---|---|
| `pending` | No payment action yet (default) |
| `ready_for_payment` | Set automatically when order transitions to `ready_for_delivery` |
| `paid` | Stripe payment confirmed |
| `waived` | Admin waived the balance |
| `credited` | All loads covered by load credits |

Payment can be collected at any point from `ready_for_delivery` through `delivered` without affecting the order status.

---

## Load Statuses

Load statuses mirror the parent order for the early and late stages of the lifecycle. In the middle — while washing is happening — loads move independently.

```
scheduled → picked_up → ready_for_wash → washing → drying → folding → cleaned → ready_for_delivery
                                                                                        ↑
                                                                 (each load gets here independently)

Once ALL loads reach ready_for_delivery → order transitions to ready_for_delivery

Order ready_for_delivery → out_for_delivery → delivered
                ↓                  ↓               ↓
           (all loads)        (all loads)     (all loads) mirror order
```

| Status | Mirrors order? | Description |
|---|---|---|
| `scheduled` | ✅ yes | Load created; order not yet picked up |
| `picked_up` | ✅ yes | Order picked up; load in transit to facility |
| `ready_for_wash` | ✅ yes | Order at facility; all loads moved to facility and ready to wash |
| `washing` | — | In washer |
| `drying` | — | In dryer |
| `folding` | — | Being folded |
| `cleaned` | — | Needs weight — folded but not yet weighed |
| `ready_for_delivery` | — | Weighed; this load is done |
| `out_for_delivery` | ✅ yes | Order dispatched; all loads mirror order |
| `delivered` | ✅ Terminal | ✅ Terminal |

---

## Order Transition Reference

### Manual transitions (via `POST /api/orders/[orderId]/status`)

| From | To | Who | Extra inputs required |
|---|---|---|---|
| `scheduled` | `picked_up` | Staff/admin | — |
| `scheduled` | `cancelled` | Staff/admin | — |
| `picked_up` | `ready_for_wash` | Staff/admin | — |
| `picked_up` | `in_progress` | Staff/admin | — |
| `picked_up` | `cancelled` | Staff/admin | — |
| `ready_for_wash` | `in_progress` | Staff/admin | — |
| `ready_for_wash` | `cancelled` | Staff/admin | — |
| `in_progress` | `ready_for_delivery` | Staff/admin | — |
| `in_progress` | `cancelled` | Staff/admin | — |
| `ready_for_delivery` | `out_for_delivery` | Staff/admin | — |
| `ready_for_delivery` | `cancelled` | Staff/admin | — |
| `out_for_delivery` | `delivered` | Staff/admin | — |

Validation: `VALID_ORDER_TRANSITIONS` map in [src/lib/order-transitions.ts](../src/lib/order-transitions.ts).

### Driver-triggered transitions

| Endpoint | From | To | Guards |
|---|---|---|---|
| `POST /api/driver/start-pickup` | `scheduled` → `picked_up` | Order must be `scheduled` |
| `POST /api/driver/run` | `ready_for_delivery` → `out_for_delivery` | Order must be `ready_for_delivery`; **all** loads must be `ready_for_delivery` |
| `POST /api/driver/complete-delivery` | `out_for_delivery` → `delivered` | Order must be `out_for_delivery` |

### Payment-triggered transitions

Payment does not change order status. It updates `payment_status` and records the payment method. Payment can be accepted once the order is in `ready_for_delivery` or later.

| Trigger | Effect | Guards |
|---|---|---|
| Stripe webhook (`checkout.session.completed`) | Sets `payment_status` to paid; records `stripePaymentId` | No existing `stripePaymentId` |
| `POST /api/orders/[orderId]/waive-payment` | Sets `payment_status` to waived | No existing `stripePaymentId` and not already waived |
| `POST /api/checkout` (all loads credited) | Sets `payment_status` to credited; sets `totalCents` to 0 | No existing `stripePaymentId`; order status in `[ready_for_delivery, out_for_delivery, delivered]` |

### Load-driven auto-transitions (no direct order API call)

These fire automatically whenever a load is updated via `PATCH /api/order-loads/[loadId]`. Logic lives in `getOrderStatusFromLoads()` in [src/lib/order-transitions.ts](../src/lib/order-transitions.ts).

| Current order status | Load condition | Order auto-transitions to |
|---|---|---|
| `ready_for_wash` | Any load advances to `washing` or beyond | `in_progress` |
| `in_progress` | All loads are `ready_for_wash` | `ready_for_wash` |
| `in_progress` | All loads are `ready_for_delivery` | `ready_for_delivery` |
| `out_for_delivery`, `delivered`, `cancelled` | _(never auto-syncs)_ | — |

**Special case:** When a `cleaned` load receives a `weightLbs` value, it auto-transitions to `ready_for_delivery`. If it was the last load, this chains into the order transitioning from `in_progress` → `ready_for_delivery`.

### Adding a load mid-order

| Order status when load added | New load starts at | Side-effect on order |
|---|---|---|
| `scheduled` | `scheduled` | — |
| `picked_up` | `picked_up` | — |
| `ready_for_wash` or `in_progress` | `ready_for_wash` | — |

---

## Load Transition Reference

### Manual transitions (via `PATCH /api/order-loads/[loadId]`)

Once a load is `ready_for_wash`, staff can advance it through the wash stages:

```
ready_for_wash → washing → drying → folding → cleaned → ready_for_delivery
```

Guards:
- Load status can only be set while the order is `ready_for_wash` or `in_progress` (loads are locked once the order reaches `ready_for_delivery` or later).
- Setting `weightLbs` on a `cleaned` load automatically advances it to `ready_for_delivery`.
- A load reaching `ready_for_delivery` does not change the order status on its own — the order only advances when **all** loads are `ready_for_delivery`.

### Bulk transitions (order-level operations cascade to all loads)

| Trigger | All loads transition to |
|---|---|
| Order transitions to `picked_up` (driver pickup) | `picked_up` |
| Order transitions to `ready_for_wash` | `ready_for_wash` |
| Order transitions to `out_for_delivery` (driver delivery run) | `out_for_delivery` |
| Order transitions to `delivered` | `delivered` |

---

## Mutation & Deletion Guards

### Order-level

| Operation | Allowed only when |
|---|---|
| Edit order (dates, loads) | `status === scheduled` |
| Delete order | `status === scheduled` |
| Apply credits to order | `status in [picked_up, in_progress, ready_for_delivery]` |
| Initiate Stripe checkout | `status in [ready_for_delivery, out_for_delivery, delivered]` AND no existing `stripePaymentId` |

### Load-level

| Operation | Allowed only when |
|---|---|
| Add a load to order | Order status **not** in `[cancelled, ready_for_delivery, out_for_delivery, delivered]` |
| Remove the last load | Order status in `[scheduled, picked_up]` AND that load's status in `[scheduled, picked_up]` |
| Edit load status | Order status must be `in_progress` (locked at `ready_for_delivery` and later) |

---

## Notification Events

Sent to the customer when an order transitions via the manual status endpoint:

| New order status | Event | Message |
|---|---|---|
| `scheduled` | `pickup_scheduled` | "Your laundry pickup has been scheduled." |
| `picked_up` | `picked_up` | "Your laundry has been picked up and is on its way to our facility." |
| `in_progress` | `in_progress` | "Your laundry is being washed and folded." |
| `ready_for_delivery` | `out_for_delivery` | "Your laundry is out for delivery." |
| `out_for_delivery` | `out_for_delivery` | "Your laundry is out for delivery." |
| `delivered` | `delivered` | "Your laundry has been delivered. Thank you!" |
| _(payment received)_ | `payment_received` | "We've received your payment. Your order is confirmed." |

---

## Key Source Files

| File | Role |
|---|---|
| [src/lib/order-transitions.ts](../src/lib/order-transitions.ts) | `VALID_ORDER_TRANSITIONS`, `getOrderStatusFromLoads()` |
| [src/lib/order-loads-policy.ts](../src/lib/order-loads-policy.ts) | `canAddOrderLoad()`, `canDeleteLastOrderLoad()`, `initialLoadStatusForOrder()` |
| [src/lib/order-status-derived.ts](../src/lib/order-status-derived.ts) | Client-side display overrides (UI only, not persisted) |
| [src/lib/notify.ts](../src/lib/notify.ts) | Notification event definitions |
| [src/app/api/orders/\[orderId\]/status/route.ts](../src/app/api/orders/[orderId]/status/route.ts) | Manual order status endpoint |
| [src/app/api/order-loads/\[loadId\]/route.ts](../src/app/api/order-loads/[loadId]/route.ts) | Load PATCH + auto-sync trigger |
| [src/app/api/driver/start-pickup/route.ts](../src/app/api/driver/start-pickup/route.ts) | Driver pickup transition |
| [src/app/api/driver/run/route.ts](../src/app/api/driver/run/route.ts) | Driver delivery transition |
| [src/app/api/webhooks/stripe/route.ts](../src/app/api/webhooks/stripe/route.ts) | Stripe payment transition |
| [src/app/api/orders/\[orderId\]/waive-payment/route.ts](../src/app/api/orders/[orderId]/waive-payment/route.ts) | Admin waive-payment transition |
| [src/app/api/checkout/route.ts](../src/app/api/checkout/route.ts) | Credit/Stripe checkout transition |
| [prisma/schema.prisma](../prisma/schema.prisma) | `OrderStatus` and `LoadStatus` enums |
