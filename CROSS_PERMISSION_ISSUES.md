# Cross-Permission Dependency Issues
## Audit Report - 2026-05-13

**Tujuan**: Identifikasi semua kasus di mana halaman frontend fetch API yang butuh permission berbeda dari permission utama halaman tersebut.

**Masalah**: Jika role punya permission untuk Feature A tapi tidak untuk Feature B, dan halaman Feature A fetch data dari API Feature B, maka data tidak akan muncul.

**Contoh yang sudah diperbaiki**: 
- Halaman Appointment (butuh `appointments` permission) fetch `/api/staff?limit=0` (butuh `staff.view`) → **FIXED** dengan endpoint `/api/staff/appointment-list` yang cek `appointments.view`

---

## 🔴 CRITICAL ISSUES (Harus Diperbaiki)

### 1. **POS Page** - Multiple Cross-Permission Dependencies
**File**: `app/[slug]/(frontend)/pos/page.tsx`

**Fetch Calls** (line 502-507):
```javascript
fetch("/api/services?limit=0"),          // Butuh services.view
fetch("/api/products?limit=0"),          // Butuh products.view
fetch("/api/service-packages?active=true"), // Butuh pos.view (OK)
fetch("/api/service-bundles"),           // Butuh pos.view (OK)
fetch("/api/customers?limit=0"),         // Butuh customers.view
fetch("/api/staff/pos-list"),            // Butuh pos.view (OK - sudah benar)
```

**Masalah**:
- Kasir butuh permission `pos.create` untuk transaksi
- Tapi POS page fetch services, products, customers yang butuh permission terpisah
- Jika role kasir tidak punya `services.view`, `products.view`, `customers.view` → dropdown kosong

**Impact**: 
- ❌ Kasir tidak bisa pilih service jika tidak punya `services.view`
- ❌ Kasir tidak bisa pilih product jika tidak punya `products.view`
- ❌ Kasir tidak bisa pilih customer jika tidak punya `customers.view`

**Rekomendasi Fix**:
Buat endpoint khusus POS:
- `/api/services/pos-list` → cek `pos.view`, return minimal data (_id, name, price, duration)
- `/api/products/pos-list` → cek `pos.view`, return minimal data (_id, name, price, stock)
- `/api/customers/pos-list` → cek `pos.view`, return minimal data (_id, name, phone)

---

### 2. **Payroll Page** - Fetch Staff Data
**File**: `app/[slug]/(frontend)/payroll/page.tsx`

**Fetch Call** (line 87):
```javascript
fetch("/api/staff")  // Butuh staff.view
```

**Masalah**:
- Halaman payroll butuh permission `payroll.view` atau `payroll.create`
- Tapi fetch staff list butuh `staff.view`
- Jika role HR punya `payroll` tapi tidak punya `staff.view` → dropdown staff kosong

**Impact**: 
- ❌ HR tidak bisa pilih staff untuk input payroll

**Rekomendasi Fix**:
Buat endpoint `/api/staff/payroll-list` → cek `payroll.view`, return minimal data (_id, name)

---

### 3. **Purchases Create Page** - Fetch Suppliers & Products
**File**: `app/[slug]/(frontend)/purchases/create/page.tsx`

**Fetch Calls** (line 52-53):
```javascript
fetch('/api/suppliers?limit=100'),  // Butuh suppliers.view
fetch('/api/products?limit=100')    // Butuh products.view
```

**Masalah**:
- Halaman purchase butuh permission `purchases.create`
- Tapi fetch suppliers dan products butuh permission terpisah
- Jika role purchasing punya `purchases` tapi tidak punya `suppliers.view` atau `products.view` → dropdown kosong

**Impact**: 
- ❌ Staff purchasing tidak bisa pilih supplier
- ❌ Staff purchasing tidak bisa pilih product untuk purchase order

**Rekomendasi Fix**:
Buat endpoint khusus:
- `/api/suppliers/purchase-list` → cek `purchases.view`, return minimal data (_id, name, contact)
- `/api/products/purchase-list` → cek `purchases.view`, return minimal data (_id, name, stock, unit)

---

### 4. **Usage Logs Page** - Fetch Products & Staff
**File**: `app/[slug]/(frontend)/usage-logs/page.tsx`

**Fetch Calls** (line 38-39):
```javascript
fetch('/api/products?limit=100'),  // Butuh products.view
fetch('/api/staff?limit=100')      // Butuh staff.view
```

**Masalah**:
- Halaman usage logs butuh permission `usageLogs.view` atau `usageLogs.create`
- Tapi fetch products dan staff butuh permission terpisah
- Jika role punya `usageLogs` tapi tidak punya `products.view` atau `staff.view` → dropdown kosong

**Impact**: 
- ❌ Staff tidak bisa pilih product untuk log usage
- ❌ Staff tidak bisa pilih staff yang pakai product

**Rekomendasi Fix**:
Buat endpoint khusus:
- `/api/products/usage-list` → cek `usageLogs.view`, return minimal data (_id, name, stock, unit)
- `/api/staff/usage-list` → cek `usageLogs.view`, return minimal data (_id, name)

---

## 🟡 HIGH PRIORITY ISSUES

### 5. **Packages Page** - Fetch Services & Customers
**File**: `app/[slug]/(frontend)/packages/page.tsx`

**Fetch Calls** (line 97-98):
```javascript
fetch("/api/services?limit=0"),    // Butuh services.view
fetch("/api/customers?limit=0"),   // Butuh customers.view
```

**Masalah**:
- Halaman packages butuh permission `packages.view` atau `packages.create`
- Tapi fetch services dan customers butuh permission terpisah
- Jika role punya `packages` tapi tidak punya `services.view` atau `customers.view` → dropdown kosong

**Impact**: 
- ❌ Staff tidak bisa pilih service untuk package
- ❌ Staff tidak bisa pilih customer untuk assign package

**Rekomendasi Fix**:
Buat endpoint khusus:
- `/api/services/package-list` → cek `packages.view`, return minimal data (_id, name, price, duration)
- `/api/customers/package-list` → cek `packages.view`, return minimal data (_id, name, phone)

---

### 6. **Bundles Page** - Fetch Services
**File**: `app/[slug]/(frontend)/bundles/page.tsx`

**Fetch Call** (line 69):
```javascript
fetch("/api/services?limit=1000")  // Butuh services.view
```

**Masalah**:
- Halaman bundles butuh permission `bundles.view` atau `bundles.create`
- Tapi fetch services butuh `services.view`
- Jika role punya `bundles` tapi tidak punya `services.view` → dropdown service kosong

**Impact**: 
- ❌ Staff tidak bisa pilih service untuk bundle

**Rekomendasi Fix**:
Buat endpoint `/api/services/bundle-list` → cek `bundles.view`, return minimal data (_id, name, price, duration)

---

### 7. **Staff Slots Page** - Fetch Staff
**File**: `app/[slug]/(frontend)/staff-slots/page.tsx`

**Fetch Call** (line 61):
```javascript
fetch("/api/staff?limit=100")  // Butuh staff.view
```

**Masalah**:
- Halaman staff slots butuh permission `staffSlots.view` atau `staffSlots.create`
- Tapi fetch staff butuh `staff.view`
- Jika role punya `staffSlots` tapi tidak punya `staff.view` → dropdown staff kosong

**Impact**: 
- ❌ Staff tidak bisa pilih staff untuk manage slots

**Rekomendasi Fix**:
Buat endpoint `/api/staff/slots-list` → cek `staffSlots.view`, return minimal data (_id, name)

---

### 8. **Membership Page** - Fetch Services, Products, Bundles, Customers
**File**: `app/[slug]/(frontend)/membership/page.tsx`

**Fetch Calls** (line 147-149, 173, 186):
```javascript
fetch("/api/services?limit=0"),           // Butuh services.view
fetch("/api/products?limit=0"),           // Butuh products.view
fetch("/api/service-bundles?limit=0"),    // Butuh pos.view
fetch("/api/customers?search=..."),       // Butuh customers.view
fetch("/api/customers?limit=0&membership=premium"), // Butuh customers.view
```

**Masalah**:
- Halaman membership butuh permission `membership.view` atau `membership.create`
- Tapi fetch services, products, bundles, customers butuh permission terpisah
- Jika role punya `membership` tapi tidak punya permission lain → dropdown kosong

**Impact**: 
- ❌ Staff tidak bisa pilih benefit membership (services/products/bundles)
- ❌ Staff tidak bisa pilih customer untuk assign membership

**Rekomendasi Fix**:
Buat endpoint khusus:
- `/api/services/membership-list` → cek `membership.view`
- `/api/products/membership-list` → cek `membership.view`
- `/api/service-bundles/membership-list` → cek `membership.view`
- `/api/customers/membership-list` → cek `membership.view`

---

### 9. **WA Marketing Page** - Fetch Services
**File**: `app/[slug]/(frontend)/wa-marketing/page.tsx`

**Fetch Call** (line 168):
```javascript
fetch("/api/services?limit=200")  // Butuh services.view
```

**Masalah**:
- Halaman WA marketing butuh permission `customers.view` atau `customers.edit` (untuk campaigns)
- Tapi fetch services butuh `services.view`
- Jika role marketing punya `customers` tapi tidak punya `services.view` → dropdown service kosong untuk filter campaign

**Impact**: 
- ❌ Staff marketing tidak bisa filter campaign berdasarkan service

**Rekomendasi Fix**:
Buat endpoint `/api/services/marketing-list` → cek `customers.view`, return minimal data (_id, name)

---

### 10. **Reports Page** - Fetch Multiple Resources
**File**: `app/[slug]/(frontend)/reports/page.tsx`

**Fetch Calls** (line 90, 93, 129-134):
```javascript
fetch('/api/staff?limit=200'),     // Butuh staff.view
fetch('/api/services?limit=200'),  // Butuh services.view
fetch('/api/invoices?...'),        // Butuh invoices.view
fetch('/api/expenses?...'),        // Butuh expenses.view
fetch('/api/appointments?...'),    // Butuh appointments.view
fetch('/api/customers?limit=0'),   // Butuh customers.view
fetch('/api/products'),            // Butuh products.view
fetch('/api/purchases?...'),       // Butuh purchases.view
```

**Masalah**:
- Halaman reports butuh permission `reports.view`
- Tapi fetch data dari berbagai resource yang butuh permission terpisah
- Jika role punya `reports.view` tapi tidak punya permission resource lain → data tidak muncul

**Impact**: 
- ❌ Staff tidak bisa lihat laporan lengkap karena data dari berbagai resource tidak muncul

**Rekomendasi Fix**:
**SPECIAL CASE**: Reports adalah aggregator data dari berbagai resource. Ada 2 opsi:
1. **Opsi A (Recommended)**: Buat endpoint `/api/reports/data` yang cek `reports.view` dan return semua data yang dibutuhkan untuk reports (staff, services, invoices, expenses, dll)
2. **Opsi B**: Tetap pakai endpoint terpisah, tapi di RBAC logic, jika user punya `reports.view`, otomatis bisa view (read-only) semua resource lain

---

### 11. **Users Create Page** - Fetch Roles
**File**: `app/[slug]/(frontend)/users/new/page.tsx`

**Fetch Call** (line 28):
```javascript
fetch("/api/roles")  // Butuh roles.view
```

**Masalah**:
- Halaman create user butuh permission `users.create`
- Tapi fetch roles butuh `roles.view`
- Jika role punya `users.create` tapi tidak punya `roles.view` → dropdown role kosong

**Impact**: 
- ❌ Staff tidak bisa assign role ke user baru

**Rekomendasi Fix**:
Buat endpoint `/api/roles/user-list` → cek `users.view`, return minimal data (_id, name)

---

## 🟢 MEDIUM PRIORITY ISSUES

### 12. **Wallet Page** - Fetch Customers
**File**: `app/[slug]/(frontend)/wallet/page.tsx`

**Fetch Call** (line 67):
```javascript
fetch("/api/customers?limit=0")  // Butuh customers.view
```

**Masalah**:
- Halaman wallet butuh permission `customers.view` (wallet adalah bagian dari customer)
- Fetch customers juga butuh `customers.view`
- **Ini sebenarnya OK** karena permission-nya sama

**Impact**: ✅ Tidak ada masalah - permission sudah sesuai

---

### 13. **Users Edit Page** - Fetch Roles
**File**: `app/[slug]/(frontend)/users/[id]/page.tsx`

**Fetch Call** (line 31):
```javascript
fetch("/api/roles")  // Butuh roles.view
```

**Masalah**:
- Halaman edit user butuh permission `users.edit`
- Tapi fetch roles butuh `roles.view`
- Jika role punya `users.edit` tapi tidak punya `roles.view` → dropdown role kosong

**Impact**: 
- ❌ Staff tidak bisa ubah role user

**Rekomendasi Fix**:
Sama dengan #11 - gunakan endpoint `/api/roles/user-list` → cek `users.view`

---

### 14. **Invoice Print Page** - Fetch Settings & Deposits
**File**: `app/[slug]/(frontend)/invoices/print/[id]/page.tsx`

**Fetch Calls** (line 24-25):
```javascript
fetch("/api/settings"),              // Public endpoint (OK)
fetch(`/api/deposits?invoiceId=${id}`) // Butuh deposits.view OR pos.view
```

**Masalah**:
- Halaman invoice print butuh permission `invoices.view`
- Fetch deposits butuh `deposits.view` OR `pos.view`
- Jika role punya `invoices.view` tapi tidak punya `deposits.view` atau `pos.view` → data deposit tidak muncul di print

**Impact**: 
- ⚠️ Invoice print tidak menampilkan info deposit/payment

**Rekomendasi Fix**:
Modifikasi `/api/deposits` GET endpoint: jika ada query param `invoiceId`, cek `invoices.view` juga (selain `deposits.view` dan `pos.view`)

---

### 15. **Customers Page** - Fetch Invoices & Deposits (Modal)
**File**: `app/[slug]/(frontend)/customers/page.tsx`

**Fetch Calls** (line 268-269):
```javascript
fetch(`/api/invoices/${invoiceId}`),      // Butuh invoices.view
fetch(`/api/deposits?invoiceId=${invoiceId}`) // Butuh deposits.view OR pos.view
```

**Masalah**:
- Halaman customers butuh permission `customers.view`
- Tapi fetch invoices dan deposits butuh permission terpisah
- Jika role punya `customers.view` tapi tidak punya `invoices.view` atau `deposits.view` → modal invoice tidak muncul

**Impact**: 
- ⚠️ Staff tidak bisa lihat detail invoice customer

**Rekomendasi Fix**:
Ini adalah **read-only view** dari customer history. Bisa:
1. Modifikasi `/api/invoices/[id]` GET: jika dipanggil dari customer context, cek `customers.view` juga
2. Atau buat endpoint `/api/customers/[id]/invoice-detail?invoiceId=...` yang cek `customers.view`

---

## 📊 SUMMARY

### Total Issues Found: **15**

| Priority | Count | Issues |
|----------|-------|--------|
| 🔴 **CRITICAL** | 4 | POS, Payroll, Purchases, Usage Logs |
| 🟡 **HIGH** | 7 | Packages, Bundles, Staff Slots, Membership, WA Marketing, Reports, Users Create |
| 🟢 **MEDIUM** | 4 | Users Edit, Invoice Print, Customers Modal, Wallet (OK) |

### Impact Analysis

**Modules Paling Terdampak**:
1. **POS** - 3 cross-permission dependencies (services, products, customers)
2. **Membership** - 4 cross-permission dependencies (services, products, bundles, customers)
3. **Reports** - 8 cross-permission dependencies (hampir semua resource)
4. **Purchases** - 2 cross-permission dependencies (suppliers, products)

**Pattern yang Sering Muncul**:
- Form/page butuh dropdown selector dari resource lain
- Kasir/staff operasional butuh lihat data tapi tidak butuh full access ke management resource tersebut
- Reports/analytics butuh aggregate data dari berbagai resource

---

## 🛠️ REKOMENDASI SOLUSI

### Strategi 1: Dedicated List Endpoints (Recommended)
Buat endpoint khusus untuk setiap use case yang return minimal data dan cek permission parent feature.

**Pattern**:
```
/api/{resource}/{feature}-list
```

**Contoh**:
- `/api/staff/appointment-list` → cek `appointments.view` ✅ (sudah dibuat)
- `/api/staff/pos-list` → cek `pos.view` ✅ (sudah ada)
- `/api/services/pos-list` → cek `pos.view` (perlu dibuat)
- `/api/products/pos-list` → cek `pos.view` (perlu dibuat)
- `/api/customers/pos-list` → cek `pos.view` (perlu dibuat)

**Keuntungan**:
- ✅ Separation of concerns yang jelas
- ✅ Minimal data exposure (hanya return field yang dibutuhkan)
- ✅ Tidak perlu ubah RBAC logic
- ✅ Mudah di-maintain

**Kerugian**:
- ⚠️ Banyak endpoint baru yang harus dibuat (~20-30 endpoints)
- ⚠️ Code duplication (query logic mirip dengan endpoint utama)

---

### Strategi 2: Query Parameter Permission Override
Tambah query param `?context=feature` yang mengubah permission check.

**Contoh**:
```javascript
// Frontend
fetch("/api/staff?context=pos&limit=0")

// Backend API
if (context === 'pos') {
    permissionError = await checkPermission(request, 'pos', 'view');
} else {
    permissionError = await checkPermission(request, 'staff', 'view');
}
```

**Keuntungan**:
- ✅ Tidak perlu buat endpoint baru
- ✅ Reuse existing query logic

**Kerugian**:
- ⚠️ Lebih complex logic di API
- ⚠️ Bisa membingungkan (satu endpoint, beda permission tergantung context)
- ⚠️ Potential security issue jika tidak hati-hati

---

### Strategi 3: RBAC Auto-Grant untuk Related Resources
Modifikasi RBAC logic: jika user punya permission Feature A, otomatis dapat view (read-only) untuk resource yang dibutuhkan Feature A.

**Contoh**:
```javascript
// lib/rbac.ts
const FEATURE_DEPENDENCIES = {
    'pos': ['services', 'products', 'customers', 'staff'],
    'appointments': ['services', 'customers', 'staff'],
    'payroll': ['staff'],
    'purchases': ['suppliers', 'products'],
    // ...
};

// Di checkPermission function
if (action === 'view') {
    // Check if user has parent feature permission
    for (const [feature, deps] of Object.entries(FEATURE_DEPENDENCIES)) {
        if (deps.includes(resource) && session.user.permissions[feature]?.view) {
            return null; // Allow
        }
    }
}
```

**Keuntungan**:
- ✅ Tidak perlu ubah frontend atau buat endpoint baru
- ✅ Otomatis apply ke semua feature

**Kerugian**:
- ⚠️ Implicit permission grant (kurang transparent)
- ⚠️ Bisa jadi security concern (user dapat akses yang tidak disadari)
- ⚠️ Sulit di-audit

---

## 🎯 REKOMENDASI FINAL

**Gunakan Strategi 1 (Dedicated List Endpoints)** untuk alasan:
1. **Security**: Explicit permission check, tidak ada implicit grant
2. **Maintainability**: Jelas endpoint mana untuk use case apa
3. **Data Minimization**: Hanya return field yang dibutuhkan (privacy & performance)
4. **Consistency**: Sudah ada pattern yang sama (`/api/staff/pos-list`, `/api/staff/appointment-list`)

**Prioritas Implementasi**:

### Phase 1 - Critical (Deploy ASAP)
1. ✅ `/api/staff/appointment-list` (sudah dibuat)
2. `/api/services/pos-list`
3. `/api/products/pos-list`
4. `/api/customers/pos-list`
5. `/api/staff/payroll-list`
6. `/api/suppliers/purchase-list`
7. `/api/products/purchase-list`
8. `/api/products/usage-list`
9. `/api/staff/usage-list`

### Phase 2 - High Priority (This Week)
10. `/api/services/package-list`
11. `/api/customers/package-list`
12. `/api/services/bundle-list`
13. `/api/staff/slots-list`
14. `/api/services/membership-list`
15. `/api/products/membership-list`
16. `/api/service-bundles/membership-list`
17. `/api/customers/membership-list`
18. `/api/services/marketing-list`
19. `/api/roles/user-list`

### Phase 3 - Medium Priority (This Month)
20. `/api/reports/data` (special aggregator endpoint)
21. Modifikasi `/api/deposits` untuk support `invoiceId` context
22. Modifikasi `/api/invoices/[id]` untuk support customer context

---

## 📝 TEMPLATE ENDPOINT

Untuk mempercepat implementasi, gunakan template ini:

```typescript
// app/api/{resource}/{feature}-list/route.ts
import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/rbac";

// Endpoint khusus {FEATURE} — hanya butuh {feature}.view (bukan {resource}.view)
// Hanya return field yang dibutuhkan {FEATURE}: {fields}
// User bisa pilih {resource} untuk {feature} tanpa akses ke data sensitif
export async function GET(request: NextRequest) {
    const tenantSlug = request.headers.get("x-store-slug") || "pusat";
    const { {Model} } = await getTenantModels(tenantSlug);

    try {
        const permissionError = await checkPermission(request, "{feature}", "view");
        if (permissionError) return permissionError;

        const items = await {Model}.find({ isActive: true })
            .select("{fields}")
            .sort({ name: 1 });

        return NextResponse.json({ success: true, data: items });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: "Failed to fetch {resource} list" },
            { status: 500 }
        );
    }
}
```

---

**Report Generated**: 2026-05-13  
**Total Files Audited**: 39 frontend pages  
**Total API Endpoints Checked**: 25+  
**Estimated Fix Time**: 
- Phase 1: 4-6 hours
- Phase 2: 6-8 hours  
- Phase 3: 4-6 hours
- **Total**: ~14-20 hours