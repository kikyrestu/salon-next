# Database Schema — Salon Next Customization

> All schemas below are NEW additions. Do not rename or restructure existing collections.
> Always check existing models in `/models` before referencing collection names.

---

## Naming Convention

- Collection names: `camelCase` plural (e.g. `customers`, `transactions`)
- Field names: `camelCase`
- Timestamps: always add `createdAt`, `updatedAt` via `{ timestamps: true }`
- References: use `mongoose.Schema.Types.ObjectId` with `ref` to the model name

---

## New / Extended Schemas

### 1. Membership Tier (new collection)

```js
// Collection: membershipTiers
{
  name: String,               // "Regular" | "Silver" | "Gold" | "Platinum"
  minPoints: Number,          // minimum loyalty points to reach this tier
  discountPercent: Number,    // discount applied at POS for this tier
  benefits: [String],         // list of benefit descriptions
  createdAt: Date,
  updatedAt: Date
}
```

---

### 2. Customer (extend existing)

Add these fields to the existing customer model:

```js
// Add to existing Customer schema
{
  membershipTierId: { type: ObjectId, ref: 'MembershipTier' },
  loyaltyPoints: { type: Number, default: 0 },
  referralCode: { type: String, unique: true },  // auto-generated on customer creation
  referredBy: { type: ObjectId, ref: 'Customer' },
  waNotificationEnabled: { type: Boolean, default: true },
  preferences: { type: String },                 // free text notes by staff
  beforeAfterPhotos: [
    {
      url: String,
      type: { type: String, enum: ['before', 'after'] },
      uploadedAt: Date
    }
  ]
}
```

---

### 3. Loyalty Points Log (new collection)

```js
// Collection: loyaltyLogs
{
  customerId: { type: ObjectId, ref: 'Customer', required: true },
  type: { type: String, enum: ['earn', 'redeem', 'referral', 'expire'] },
  points: Number,             // positive = earn, negative = redeem
  referenceId: ObjectId,      // transactionId or referralId
  note: String,
  createdAt: Date,
  updatedAt: Date
}
```

---

### 4. Voucher / Gift Card (new collection)

```js
// Collection: vouchers
{
  code: { type: String, unique: true, uppercase: true },
  discountType: { type: String, enum: ['flat', 'percent'] },
  discountValue: Number,
  minTransaction: { type: Number, default: 0 },
  maxUsage: { type: Number, default: 1 },
  usedCount: { type: Number, default: 0 },
  expiresAt: Date,
  isActive: { type: Boolean, default: true },
  createdAt: Date,
  updatedAt: Date
}
```

---

### 5. Service Bundle (new collection)

```js
// Collection: serviceBundles
{
  name: String,
  description: String,
  imageUrl: String,
  price: Number,
  services: [
    {
      serviceId: { type: ObjectId, ref: 'Service' },
      qty: { type: Number, default: 1 }
    }
  ],
  isActive: { type: Boolean, default: true },
  createdAt: Date,
  updatedAt: Date
}
```

---

### 6. Transaction (extend existing)

Add these fields to the existing transaction/POS model:

```js
// Add to existing Transaction schema
{
  bookingId: { type: ObjectId, ref: 'Booking', default: null }, // linked booking if any
  payments: [
    {
      method: { type: String, enum: ['cash', 'transfer', 'debit', 'credit_card', 'qris', 'xendit', 'saldo'] },
      amount: Number
    }
  ],
  voucherCode: { type: String, default: null },
  voucherDiscount: { type: Number, default: 0 },
  loyaltyPointsRedeemed: { type: Number, default: 0 },
  loyaltyPointsEarned: { type: Number, default: 0 }
}
```

---

### 7. Product Commission Log (new collection)

```js
// Collection: productCommissionLogs
{
  transactionId: { type: ObjectId, ref: 'Transaction' },
  employeeId: { type: ObjectId, ref: 'Employee' },
  productId: { type: ObjectId, ref: 'Product' },
  qty: Number,
  commissionPerUnit: Number,
  totalCommission: Number,
  createdAt: Date,
  updatedAt: Date
}
```

---

### 8. Product (extend existing)

Add these fields to the existing product model:

```js
// Add to existing Product schema
{
  imageUrl: { type: String, default: null },
  commissionType: { type: String, enum: ['flat', 'percent'], default: 'flat' },
  commissionValue: { type: Number, default: 0 },
  lowStockThreshold: { type: Number, default: 5 },
  lowStockNotified: { type: Boolean, default: false } // reset to false when stock is restocked
}
```

---

## Index Recommendations

```js
// For performance on frequent queries
loyaltyLogs: index on { customerId, createdAt }
vouchers: index on { code }
transactions: index on { bookingId }, { createdAt }, { 'payments.method' }
productCommissionLogs: index on { employeeId, createdAt }
```
