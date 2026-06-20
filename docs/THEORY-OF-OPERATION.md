# Theory of Operation

This document describes the end-to-end lifecycle of a laundry order — from the customer placing a booking through pickup, washing, delivery, and payment. It is intended as a narrative companion to [STATE-TRANSITIONS.md](./STATE-TRANSITIONS.md), which contains the precise state machine tables and API references.

---

## System Overview

The system has three user roles (stored as the `Role` enum on each `User` record):

| Role | Interfaces | Primary Concern |
|---|---|---|
| **Customer** | `/book`, `/orders`, `/dashboard` | Place orders, pay, track status |
| **Staff** | `/driver`, `/wash`, `/orders` | Pick up and deliver laundry; process loads through the wash pipeline; enter weights |
| **Admin** | `/admin`, all staff pages | Configure pricing, availability, manage orders and users |

Both `staff` and `admin` roles can access the driver and wash pages. Customers are redirected away from those pages.

An **Order** is the top-level record. Each order contains one or more **OrderLoads** (one per bag of laundry). The order and each load carry their own status. Load statuses drive order status through automatic cascade rules described in §5 below.

---

## Phase 1 — Customer Books an Order

### What the customer does

The customer fills out a two-step booking form at `/book`:

1. **Step 1** — Estimated number of bags, pickup date/time, delivery date/time, per-load wash options (scent-free)
2. **Step 2** — Pickup and delivery addresses

### Premium tier detection

As the customer selects dates and time slots, the form silently detects which service tier applies:

| Tier | Condition | Per-pound surcharge |
|---|---|---|
| `standard` | Any other combination | $0.00 |
| `next_morning` | Pickup evening + delivery morning (next day) | +$2.00/lb (configurable) |
| `same_day` | Pickup morning + delivery evening, same date | +$3.00/lb (configurable) |

Time slots are either **morning (8–10 AM)** or **evening (4–7 PM)**. Slot availability per day of week is configured by admin.

### Booking validation

The API blocks booking creation if:
- The customer has any **past-due (unpaid) orders** — returns HTTP 402 and sends a reminder email with payment links for each unpaid order
  - The customer gets routed to a payment page
- The pickup or delivery address is **outside the service area**

### What the system creates

On success, the API creates:
- One **Order** record: `status = scheduled`, `paymentStatus = pending`, `totalCents = 0`
- One **OrderLoad** record per bag: `status = scheduled`
- One **OrderStatusHistory** entry: "Order created"

**Notifications sent:** Email + SMS → `order_created`

---

## Phase 2 — Driver Picks Up the Laundry

### How orders appear on the driver page

The driver page (`/driver`) shows a **Pickups (scheduled)** table of orders with `status = scheduled`. The driver can optionally filter to only show orders whose pickup time window includes the current time.

### Step 1 — Start the route

The driver selects one or more scheduled orders and taps **Start route**. This calls `POST /api/driver/start-pickup`.

**State change:**
- Order: `scheduled → out_for_pickup`
- Loads: unchanged (still `scheduled`) — load counts are not committed until the driver arrives
- An `OrderStatusHistory` entry is recorded: "Pickup route started (driver)"

**Notifications sent:** Email + SMS → `out_for_pickup` ("Our driver is on the way to pick up your laundry.")

The orders move out of the scheduled pickups table and appear in a new **En route to pickup** section on the driver page.

### Step 2 — Confirm pickup at the customer's door

When the driver arrives at a customer's address, they confirm the actual number of bags collected (which may differ from the customer's estimate) and tap **Confirm pickup**. This calls `POST /api/driver/confirm-pickup`.

**State change:**
- Order: `out_for_pickup → picked_up`; `numberOfLoads` updated to the confirmed count
- Loads: created/synced to match confirmed count, all set to `picked_up`
- An `OrderStatusHistory` entry is recorded: "Pickup confirmed (driver) — N load(s)"

**Notifications sent:** Email + SMS → `picked_up`

### After the driver has the bags

While an order is in `picked_up` status, staff can still add or remove loads if a correction is needed:
- **Add a load:** `POST /api/orders/{orderId}/loads` — increments `numberOfLoads`, creates a new `OrderLoad` at `picked_up`
- **Remove the last load:** `DELETE /api/orders/{orderId}/loads` — only allowed while order is `scheduled`, `out_for_pickup`, or `picked_up`; minimum of 1 load must remain

---

## Phase 3 — Driver Drops Off at the Facility

The driver arrives at the facility and hands off the bags. A staff member manually transitions the order from `picked_up` to `ready_for_wash` via `POST /api/orders/{orderId}/status`.

**State change:**
- Order: `picked_up → ready_for_wash`
- All loads: cascade to `ready_for_wash`

At this point the bags physically exist at the facility and are ready to enter the wash pipeline.

---

## Phase 4 — Wash Processing

### How loads appear on the wash page

The wash page (`/wash`) shows all orders where:
- `status ∈ {picked_up, ready_for_wash, in_progress}`, **and**
- `deliveryDate ≤ today`

The "today" filter means only orders due for delivery today (or overdue) appear. Orders are sorted by wash priority and then by pickup date.

### Staff workflow per load

Wash staff work through each load on the wash dashboard. For each `OrderLoad`, they:

1. Assign a **shelf location** (stored as `location` on the load)
2. Advance the load status manually through the wash stages:

```
ready_for_wash → washing → drying → folding → cleaned
```

3. **Enter the weight** (lbs) once the load is folded and in `cleaned` status

When a weight greater than 0 is saved on a `cleaned` load, the system **automatically transitions that load to `ready_for_delivery`**. No manual status change is needed.

### Automatic order status cascades

Every time a load is updated, the system re-evaluates the parent order's status:

| Condition | Order auto-transitions to |
|---|---|
| Any load advances past `ready_for_wash` (enters `washing`, `drying`, `folding`, `cleaned`, or `ready_for_delivery`) | `in_progress` |
| All loads reach `ready_for_delivery` | `ready_for_delivery` |
| All loads revert to `ready_for_wash` (e.g. after a correction) | `ready_for_wash` |

**Notifications sent:** Email + SMS → `in_progress` (first time order enters `in_progress`)

The order reaches `ready_for_delivery` only when **every load has been weighed**. This is the trigger for payment.

---

## Phase 5 — Payment

### Payment becomes available

When the order transitions to `ready_for_delivery`, the system simultaneously sets `paymentStatus = ready_for_payment` and **automatically sends the customer an email and SMS** containing:
- The total amount due (weight × price/lb + bulky items + tax)
- Total weight in lbs
- A **Stripe Checkout payment link**

The customer does not need to be in the app — the payment link arrives in their inbox and text messages.

### How the total is calculated

```
pricePerPound = customer override → order override → default ($1.50/lb)
premiumSurcharge = premiumSurchargePerPoundCents (from booking tier)
effectiveRate = pricePerPound + premiumSurcharge

weightSubtotal = totalLbs × effectiveRate
bulkySubtotal = sum of bulky item charges
subtotal = weightSubtotal + bulkySubtotal
tax = subtotal × NM Gross Receipts Tax % (unless customer/order is tax-exempt)
total = subtotal + tax
```

### Stripe payment flow

1. Customer taps the payment link → creates a Stripe Checkout session (card only)
2. Customer completes payment on Stripe's hosted page
3. Stripe fires `checkout.session.completed` webhook to `/api/webhooks/stripe`
4. The system sets `paymentStatus = paid` and stores the `stripePaymentId`
5. **Email sent** → `payment_received` with a **PDF receipt attached**

Payment can be collected at any point from `ready_for_delivery` through `delivered`. The order continues to progress to delivery regardless of payment status.

### Resending the payment link

Staff can regenerate and resend the payment link at any time via `POST /api/orders/{orderId}/resend-payment-link`. This recalculates the total (in case weights were adjusted), creates a fresh Stripe session, and sends the `ready_for_payment` email/SMS again.

### Credits and waivers

- **Free-load credits** can be applied to individual loads (heaviest first) while the order is in `picked_up`, `in_progress`, or `ready_for_delivery`. Credits decrement from the customer's account.
- If **all loads are credited**, Stripe is skipped entirely: `paymentStatus = credited`, `totalCents = 0`
- **Admin waive:** An admin can waive the balance via `POST /api/orders/{orderId}/waive-payment` → `paymentStatus = waived`

### Payment state machine

```
pending
  → ready_for_payment   [Auto: order reaches ready_for_delivery]
  → paid                [Stripe webhook: checkout.session.completed]
  → waived              [Admin action]
  → credited            [All loads covered by credits — Stripe skipped]
```

---

## Phase 6 — Driver Delivers to the Customer

### How orders appear for delivery

The driver page shows a second table of orders with `status = ready_for_delivery`. The system verifies that **all** loads are `ready_for_delivery` before allowing a delivery run to start.

### Starting a delivery run

The driver selects orders and taps **Start delivery**. This calls `POST /api/driver/run`.

**State change:**
- Order: `ready_for_delivery → out_for_delivery`
- All loads: cascade to `out_for_delivery`
- A `DriverRun` record is created to track the route

**Notifications sent:** Email + SMS → `out_for_delivery`

### Marking an order delivered

When the driver arrives at the customer's address and hands off the bags, they tap **Mark delivered**. This calls `POST /api/orders/{orderId}/status` with `{ status: "delivered" }`.

**State change:**
- Order: `out_for_delivery → delivered` (terminal)
- All loads: cascade to `delivered`

**Notifications sent:** Email + SMS → `delivered`

---

## Phase 7 — Receipt

### After payment

Once Stripe confirms payment, the `payment_received` email is sent automatically. It includes:
- A **PDF receipt** attached directly to the email, generated server-side
- Order number, dates, customer info, pickup/delivery addresses
- Per-load breakdown: load number, weight, options applied, bulky items, credited status
- Subtotal, tax, and total

### Downloading a receipt

Staff or the customer can also download the receipt directly from the order detail page. The PDF is available at `GET /api/orders/{orderId}/receipt` for any order with a `stripePaymentId` (i.e., paid orders).

---

## Notification Summary

| Event | When sent | Channel | Key content |
|---|---|---|---|
| `order_created` | Order placed | Email + SMS | Order number, dates, slot times |
| `out_for_pickup` | Driver starts pickup route | Email + SMS | "Driver is on the way" |
| `picked_up` | Driver confirms pickup at door | Email + SMS | Confirmation bags are collected |
| `in_progress` | First load enters wash | Email + SMS | Wash underway |
| `ready_for_payment` | All loads weighed | Email + SMS | Total, weight, payment link |
| `out_for_delivery` | Driver starts delivery run | Email + SMS | On the way |
| `delivery_update` | Driver location update | Email + SMS | Stops remaining |
| `delivered` | Driver marks delivered | Email + SMS | Order complete |
| `payment_received` | Stripe webhook fires | Email only | PDF receipt attached |
| Past-due reminder | Customer tries to book with unpaid orders | Email only | Table of unpaid orders with payment links |

**Email service:** Resend (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`)<br>
**SMS service:** Twilio (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`)

---

## Full Order Lifecycle at a Glance

```
CUSTOMER BOOKS
  Order: scheduled
  Loads: scheduled
  Payment: pending
        │
        ▼
DRIVER STARTS PICKUP ROUTE
  Order: out_for_pickup
  Loads: unchanged (still scheduled)
  Notifications: out_for_pickup (Email + SMS — "driver is on the way")
        │
        ▼
DRIVER ARRIVES AT CUSTOMER & CONFIRMS PICKUP (with actual bag count)
  Order: picked_up
  Loads: created/synced to confirmed count, all picked_up
  Notifications: picked_up (Email + SMS)
        │
        ▼
STAFF RECEIVES AT FACILITY
  Order: ready_for_wash
  Loads: ready_for_wash
        │
        ▼
WASH STAFF PROCESSES LOADS (independently)
  ready_for_wash → washing → drying → folding → cleaned
                                                    │
                                          staff enters weight
                                                    │
                                                    ▼
                                           load: ready_for_delivery
  When any load is past ready_for_wash:
    Order: in_progress   ← Notifications: in_progress (Email + SMS)
  When ALL loads are ready_for_delivery:
    Order: ready_for_delivery
    Payment: ready_for_payment
    Notifications: ready_for_payment (Email + SMS with payment link) ← AUTOMATIC
        │
        ▼
CUSTOMER PAYS
  Customer clicks link → Stripe Checkout
  Stripe webhook fires → Payment: paid
  Notifications: payment_received (Email with PDF receipt) ← AUTOMATIC
        │
        ▼
DRIVER STARTS DELIVERY RUN
  Order: out_for_delivery
  Loads: out_for_delivery
  Notifications: out_for_delivery (Email + SMS)
        │
        ▼
DRIVER DELIVERS TO CUSTOMER
  Order: delivered  ✅
  Loads: delivered  ✅
  Notifications: delivered (Email + SMS)
```

---

## Related Documents

- [STATE-TRANSITIONS.md](./STATE-TRANSITIONS.md) — Complete state machine tables, API endpoints, guards, and cascade rules
- [TESTING-CHECKLIST.md](./TESTING-CHECKLIST.md) — Manual test checklist for the full lifecycle
