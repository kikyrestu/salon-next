# Modules Specification — Salon Next Customization

> This document is the source of truth for all features to be implemented.
> Each feature has a status tag: `[ ]` = not started, `[~]` = in progress, `[x]` = done.

---

## Module 1 — Appointment

### Features
- [ ] **Booking → POS Flow**: When a booking is opened, there must be a button to continue/carry the booking data directly into a new POS session (pre-fill customer, services)
- [ ] **Auto-complete Booking**: When a POS transaction linked to a booking is marked as payment complete, the booking status automatically changes to `completed`
- [ ] **Completed Booking Color**: Bookings with status `completed` must display in grey on the calendar view
- [ ] **Date Range Filter**: On the appointment list view, add a date range picker (from date → to date) to filter appointments

### Business Logic
- A booking can only be continued to POS once
- Completing the POS should be the only way to mark a booking as completed (not manually)

---

## Module 2 — Reports

### Features
- [ ] **Sortable Columns**: Every column in every report table must be sortable (ascending/descending) by clicking the column header
- [ ] **Payment Method Filter**: Filter report data by payment method — Cash, Transfer, Debit, QRIS — with multi-select support
- [ ] **Export to Excel**: All reports must have an export button that downloads data as `.xlsx`
- [ ] **Custom Date Range**: Sales report must support a custom start date → end date range picker
- [ ] **Top Customer Report**: Rank customers by total spending in a given period
- [ ] **Top Service Report**: Rank services by number of times sold in a given period
- [ ] **Top Employee Report**: Rank employees by number of transactions handled in a given period

### Notes
- Export should reflect current filters (date, payment method, etc.)
- Use a library like `exceljs` or `xlsx` for export

---

## Module 3 — POS

### Features
- [ ] **Image Upload on Items**: Services, products, and packages must support image upload and display in POS item grid
- [ ] **Split Payment**: A single transaction can be paid using multiple methods (e.g. Rp 100k Debit + Rp 50k Cash). UI must allow adding payment portions with running total
- [ ] **New Payment Methods**: Add Debit, Credit Card, Transfer as manual payment methods (cashier confirms manually, no gateway integration needed)
- [ ] **Item Tabs**: Add "Paket" tab (show packages only) and "All" tab (show all items: services, products, packages) alongside existing tabs

### Business Logic
- Split payment total must equal the transaction total before allowing completion
- Manual payment methods do not trigger any gateway — cashier marks as received

---

## Module 4 — Layanan / Service

### Features
- [ ] **Service Bundling**: Create a "bundle" type that groups multiple services into one sellable item with a single combined price
  - Bundle appears in POS as a single line item
  - When a bundle is sold, each included service is recorded individually in reports

---

## Module 5 — Customer

### Features
- [ ] **VIP Membership System**: Define membership tiers (e.g. Regular, Silver, Gold, Platinum) with benefits per tier (discount %, priority booking, etc.)
- [ ] **Loyalty Point Program**: Customers earn points per transaction (configurable rate). Points can be redeemed for discounts
- [ ] **Referral System**: Customer gets points when they refer a new customer who makes their first transaction. Referral tracked by unique referral code per customer
- [ ] **Voucher / Gift Card**: Admin can generate vouchers with unique codes, set discount value (flat or %), expiry date, and usage limit
- [ ] **Customer Dashboard**: Dedicated page per customer showing:
  - Invoice history (by invoice number)
  - Preference notes (free text, editable by staff)
  - Current membership tier
  - Active loyalty points balance
  - Remaining package (paket saldo) balance
  - Before-after photo gallery (images auto-resized on upload, max width 1200px)
- [ ] **WA Notification Opt-in**: Per-customer toggle — if enabled, customer receives WA notifications for appointments, promos, etc. via Fonnte

### Notes
- Voucher codes must be case-insensitive and validated at POS before applying
- Points expiry (if any) should be configurable from admin settings

---

## Module 6 — Product

### Features
- [ ] **Product Commission**: Each product can have a commission value (flat or %). When a product is sold, the selling employee earns that commission, visible in their commission report
- [ ] **Auto Stock Deduction**: When a product is used/sold in a POS transaction, stock quantity is automatically reduced
- [ ] **Low Stock WA Notification**: When a product's stock drops to or below a configurable threshold, a WA message is sent via Fonnte to the admin/owner number

### Business Logic
- Stock deduction happens at the moment the POS transaction is completed, not when item is added to cart
- Low stock notification should only fire once per threshold crossing (not every transaction after that)
