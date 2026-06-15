# Testing Checklist

Use this checklist before releasing new versions of the site. Each section covers a distinct feature area. Items marked **(Admin)**, **(Staff)**, or **(Driver)** require the appropriate role.

---

## Authentication & Accounts

### Sign Up
- [ ] Create a new account with email and password
- [ ] Verify that a verification email is sent
- [ ] Confirm that login is blocked until email is verified
- [ ] Click the verification link and confirm the account is activated
- [ ] Attempt to sign up with an already-registered email — expect an error
- [ ] Sign up with an invalid email format — expect a validation error

### Sign In
- [ ] Log in with valid credentials
- [ ] Log in with wrong password — expect an error
- [ ] Log in with an unverified email — expect a clear message and "resend verification" option
- [ ] Resend verification email and confirm delivery

### Forgot / Reset Password
- [ ] Request a password reset for a valid email
- [ ] Confirm reset email is delivered
- [ ] Click the reset link and successfully set a new password
- [ ] Log in with the new password
- [ ] Confirm the old password no longer works
- [ ] Use an expired or already-used reset link — expect a rejection

### Role-Based Redirects
- [ ] Customer logs in → redirected to `/dashboard`
- [ ] Staff/admin logs in → redirected to `/wash`
- [ ] Logged-in user visits `/login` or `/signup` → redirected to their dashboard

---

## Booking a New Order (Customer)

### Step 1 — Loads & Options
- [ ] Select 1 load and confirm the form shows only 1 load panel
- [ ] Select 10 loads (max) and confirm the form shows 10 load panels
- [ ] Toggle all per-load options (hot water, bleach, hypoallergenic, delicate cycle, scent-free, cold water only) and confirm they save
- [ ] Add a bulky item (comforter, pillows, sheets, blanket) to a load
- [ ] Confirm default load options (set in account) are pre-checked

### Step 2 — Dates & Times
- [ ] Verify that only admin-enabled days/slots are selectable for pickup
- [ ] Verify that only admin-enabled days/slots are selectable for delivery
- [ ] Confirm that delivery date cannot be before pickup date
- [ ] Select a next-morning slot and confirm a premium surcharge appears in the price preview
- [ ] Select a same-day slot and confirm the higher same-day surcharge appears
- [ ] Select a standard slot and confirm no surcharge is added

### Step 3 — Address & Notes
- [ ] Add a new address with Google autocomplete and confirm it is accepted
- [ ] Enter an address outside the service area and confirm it is rejected with a clear message
- [ ] Set different pickup and delivery addresses
- [ ] Use a saved default address
- [ ] Enter special notes and confirm they are stored on the order

### Price Preview
- [ ] Confirm price preview reflects: base rate × estimated pounds (or bulky item pricing) + surcharge + tax
- [ ] Confirm NMGRT tax is shown as a line item
- [ ] Confirm price updates when options or load count change

### Submission
- [ ] Submit a valid booking and confirm a new order appears in the dashboard
- [ ] Confirm an order confirmation email is sent

### Past-Due Block
- [ ] Attempt to book with a past-due unpaid order on the account — expect a block message

---

## Customer Dashboard & Order Management

### Dashboard
- [ ] All orders are listed with correct status badges
- [ ] Credited loads count is displayed
- [ ] Redeem a valid promo code and confirm credited loads increase
- [ ] Redeem the same promo code a second time — expect rejection
- [ ] Enter an invalid promo code — expect an error

### Order Detail Page
- [ ] Order number, status, pickup/delivery dates, addresses, and load count are all correct
- [ ] Per-load options are shown correctly for each load
- [ ] Status history shows correct timestamps and notes

### Editing a Scheduled Order
- [ ] Edit a scheduled order — confirm all fields are pre-filled
- [ ] Change number of loads, options, dates, and address, then save
- [ ] Confirm changes are reflected on the order detail page
- [ ] Attempt to edit an order that is no longer in `scheduled` status — edit option should not be available

### Deleting an Order
- [ ] Delete a scheduled order — confirm it is removed from the dashboard
- [ ] Confirm that orders past `scheduled` status cannot be deleted by the customer

---

## Payment & Billing

### Paying for an Order
- [ ] When an order reaches `waiting_for_payment`, a Pay button appears
- [ ] Clicking Pay opens a Stripe checkout flow
- [ ] Complete payment with a test card and confirm order status updates
- [ ] Confirm a receipt download link appears after payment

### Receipt
- [ ] Download the receipt PDF
- [ ] Confirm the receipt shows: order number, load details, weight, price per pound, surcharge, tax, and total

### Resend Payment Link
- [ ] Use the "Resend payment link" button and confirm an email is delivered with a working payment link

### Credited Loads
- [ ] Apply a credited load to an unpaid order and confirm the load count or price is adjusted
- [ ] Confirm the credited loads balance decreases after use

### Waive Payment **(Admin)**
- [ ] Waive payment on a delivered or out-for-delivery order
- [ ] Confirm order status updates appropriately and no payment is required

---

## Account Settings (Customer)

### Profile
- [ ] Update name and confirm it is saved
- [ ] Confirm email field is read-only
- [ ] Add a phone number with SMS consent checked and confirm it is saved
- [ ] Remove the phone number and confirm SMS consent is also cleared
- [ ] Attempt to add a phone number without checking SMS consent — expect a block

### Default Load Options
- [ ] Set default options and confirm they are pre-selected when booking a new order

### Addresses
- [ ] Add a new address with a valid address inside the service area
- [ ] Attempt to add an address outside the service area — expect rejection
- [ ] Edit an existing address
- [ ] Set an address as default and confirm it is pre-selected when booking
- [ ] Delete an address that is not attached to any order
- [ ] Attempt to delete an address that is attached to an existing order — expect a block

---

## Wash Dashboard (Staff)

- [ ] Dashboard shows orders with today's pickup date
- [ ] Toggle "due today" / "all" filter and confirm results change
- [ ] Advance a load through all status stages: `ready_for_pickup` → `incoming` → `ready_for_wash` → `washing` → `drying` → `folding` → `cleaned` → `ready_for_delivery`
- [ ] Assign a location to a load and confirm it is saved
- [ ] Enter a weight for a load
- [ ] Confirm that weight is required before a load can advance to `ready_for_delivery`
- [ ] Add a load to an order and confirm load count increases
- [ ] Remove a load from an order and confirm load count decreases
- [ ] Print load tags for a load — confirm PDF is generated with QR code and order info
- [ ] Confirm the page auto-refreshes with live updates (within ~15 seconds)

---

## Driver Dashboard (Staff/Driver)

### Pickups
- [ ] Available orders for pickup are listed
- [ ] Select multiple orders and start a pickup route
- [ ] Confirm selected orders transition to `picked_up` status

### Deliveries
- [ ] Orders with `ready_for_delivery` status appear in the delivery section
- [ ] Select orders and use "Optimize route" — confirm the stop sequence is reordered
- [ ] Start a delivery run and confirm a run is created
- [ ] Confirm customers receive a notification email/SMS when the driver is 2–3 stops away
- [ ] Mark an order as delivered and confirm status updates to `delivered`
- [ ] Add or remove loads from an order during a run

### Location Sharing
- [ ] Toggle location sharing on — confirm coordinates update in the admin panel
- [ ] Toggle location sharing off — confirm the driver no longer appears in the admin driver map

---

## Admin Panel

### User Management
- [ ] View all users with their roles listed
- [ ] Change a user's role (e.g., customer → staff) and confirm the change takes effect on their next login

### Customer Management
- [ ] Search for a customer by email
- [ ] Search for a customer by name
- [ ] Set a custom price per pound for a customer and confirm it is used when pricing their next order
- [ ] Toggle NMGRT exemption and confirm tax is excluded from their receipt
- [ ] Set customer type and confirm it appears in analytics
- [ ] Manually set credited loads and confirm the balance appears on the customer's dashboard

### Pricing Configuration
- [ ] Update base price per pound and confirm it reflects on the booking price preview
- [ ] Update next-morning premium surcharge and confirm it adds to orders with that slot
- [ ] Update same-day premium surcharge and confirm it adds to orders with that slot
- [ ] Update bulky item prices (comforter, pillows, sheets, blanket) and confirm they update in booking
- [ ] Update NMGRT percentage and confirm it reflects on new receipts

### Booking Availability
- [ ] Disable a day/time slot and confirm customers can no longer select it when booking
- [ ] Re-enable a slot and confirm it becomes selectable again

### Load Locations
- [ ] Create a new load location
- [ ] Confirm it appears in the wash dashboard location dropdown
- [ ] Edit a load location name
- [ ] Delete a load location and confirm it is removed from the dropdown

### Past Due Grace Period
- [ ] Change the grace period and confirm that an account with an unpaid order within the new period is not blocked from booking

### Promo Codes
- [ ] Generate a promo code for N free loads
- [ ] Redeem the code on a customer account and confirm credited loads increase by N
- [ ] Confirm the code cannot be redeemed a second time by the same customer

### Company Info & Service Area
- [ ] Update the company name and address
- [ ] Update the max service distance and confirm that booking an address beyond it is rejected

### Analytics
- [ ] Customer type breakdown chart loads with data for a selected date range
- [ ] Revenue by month chart loads and shows correct month/year labels
- [ ] Loads by day of week chart shows AM/PM split

### Driver Locations
- [ ] With a driver actively sharing location, confirm their coordinates appear in the admin panel
- [ ] "View on map" opens Google Maps to the correct coordinates

---

## Notifications

### Email
- [ ] Order confirmation email is sent on booking
- [ ] Payment link email is sent and the link works
- [ ] Resent payment link email is delivered and the link works
- [ ] Delivery approach email is sent when driver is 2–3 stops away
- [ ] Password reset email is delivered and the link works
- [ ] Email verification email is delivered and the link works

### SMS
- [ ] Customer with a verified phone number receives SMS on delivery approach
- [ ] Customer without a phone number does not cause an error
- [ ] Customer who revoked SMS consent does not receive SMS

---

## Address Verification

- [ ] Valid address inside service area is accepted and standardized
- [ ] Misspelled address triggers a correction suggestion
- [ ] Address outside the service area is rejected during booking
- [ ] Address outside the service area is rejected when saving to account

---

## Legal Pages

- [ ] `/legal/terms` loads without errors
- [ ] `/legal/privacy` loads without errors
- [ ] `/legal/sms` loads without errors
- [ ] Links to legal pages from signup/account pages work

---

## Edge Cases & Error States

- [ ] Booking with 0 loads is not allowed
- [ ] Booking with more than 10 loads is not allowed
- [ ] An order cannot be edited after it has been picked up
- [ ] An address in use by an order cannot be deleted
- [ ] Navigating to an order that belongs to another customer returns a 404 or redirect
- [ ] A customer cannot access `/admin`, `/wash`, or `/driver` — expect a redirect or 403
- [ ] A staff member cannot access `/admin` — expect a redirect or 403
- [ ] Accessing a protected page while logged out redirects to `/login`
- [ ] Stripe webhook fires correctly on test payment and updates order status

---

*Last updated: 2026-06-15*
