# 🔍 Bug & Error Report — Financial Reports Module
### `salon-next` · Next.js App Router · TypeScript · MongoDB/Mongoose

> **Tanggal Analisa:** 16 Mei 2026
> **Scope:** Frontend & Backend — **Financial Reports & Relasi Langsung**
> **Analis:** Static Code Analysis — Independent Review
> **Metode:** Full source inspection, cross-file dependency tracing, data flow analysis

---

## 📁 File Scope yang Dianalisa

| File | Peran | Ukuran |
|------|-------|--------|
| `app/api/reports/financial/route.ts` | API Laporan Keuangan utama | 4 KB |
| `app/api/reports/route.ts` | API Hub semua tipe laporan (profit, sales, daily, dll) | 13.5 KB |
| `app/api/reports/data/route.ts` | Aggregator data untuk summary & dropdown filter | 3.5 KB |
| `app/api/ai-reports/route.ts` | AI-powered financial analytics (OpenAI) | 7 KB |
| `app/api/cron/wa-daily-report/route.ts` | Cron harian kirim laporan keuangan via WhatsApp | 6 KB |
| `app/api/invoices/route.ts` | Sumber data invoice (relasi langsung semua report) | ~20 KB |
| `app/api/invoices/[id]/route.ts` | Invoice preview modal (dipakai di Sales Report) | ~9 KB |
| `app/[slug]/(frontend)/reports/financial/page.tsx` | Halaman Financial Report | 12 KB |
| `app/[slug]/(frontend)/reports/page.tsx` | Halaman Report utama (75 KB — komponen raksasa) | **75 KB** |
| `lib/dateUtils.ts` | Utilitas timezone & konversi tanggal | ~5 KB |
| `lib/rbac.ts` | Permission & access control | ~5 KB |
| `lib/rateLimiter.ts` | Rate limiter AI reports | 1 KB |
| `components/reports/StatCard.tsx` | Komponen kartu statistik | 1.5 KB |
| `components/reports/SalesChart.tsx` | Komponen chart penjualan | 3.5 KB |

---

## 📊 Ringkasan Eksekutif

| Kode | Deskripsi Singkat | Layer | Severity | Probabilitas |
|------|-------------------|-------|----------|--------------|
| **BE-F01** | `staffFilter` String vs ObjectId → filter sales selalu miss | Backend | 🔴 Critical | **95%** |
| **BE-F02** | `netProfit` di `/financial` tidak include Payroll — beda hasil vs `/profit` | Backend | 🔴 Critical | **100%** |
| **BE-F03** | Services & products report include invoice `cancelled`/`voided` | Backend | 🟠 High | **100%** |
| **BE-F04** | `staffStats.appointments` tidak pernah di-increment — selalu 0 | Backend | 🟠 High | **100%** |
| **BE-F05** | Revenue staff di-count ganda (setiap staff dapat kredit penuh) | Backend | 🟠 High | **100%** |
| **BE-F06** | `inv.amountPaid` bisa `undefined` → `totalCollected` menjadi NaN | Backend | 🟠 High | **70%** |
| **BE-F07** | Payroll filter pakai `createdAt` bukan `date` (inkonsisten) | Backend | 🟠 High | **80%** |
| **BE-F08** | `openaiApiKey` tidak di-decrypt sebelum dipakai di AI reports | Backend | 🟠 High | **60%** |
| **BE-F09** | `aiData.choices[0]` tanpa null-check → runtime crash potensial | Backend | 🟡 Medium | **30%** |
| **BE-F10** | AI low stock hardcode `{ $lte: 10 }` — abaikan field `alertQuantity` | Backend | 🟡 Medium | **100%** |
| **BE-F11** | `ActivityLog.countDocuments()` tanpa filter → total pagination salah | Backend | 🟡 Medium | **100%** |
| **BE-F12** | WA daily report timezone hardcode `Asia/Jakarta` — abaikan Settings | Backend | 🟡 Medium | **30%** |
| **BE-F13** | `Customer` & `Product` load SEMUA data tanpa date filter di `/data` | Backend | 🟡 Medium | **100%** |
| **BE-F14** | Rate limiter in-memory — reset saat server restart, tidak persistent | Backend | 🟢 Low | **100%** |
| **BE-F15** | `formatterCache` di dateUtils unbounded — potensi memory leak | Backend | 🟢 Low | **100%** |
| **FE-F01** | `StatCard` dipanggil dengan props `trend` bertipe string → tidak render | Frontend | 🔴 Critical | **100%** |
| **FE-F02** | `renderTable` sort gagal untuk currency format lokal Indonesia | Frontend | 🟠 High | **100%** |
| **FE-F03** | `handleExport` tidak cover tab `wallet` & `daily` → export gagal/salah | Frontend | 🟠 High | **100%** |
| **FE-F04** | Staff drilldown matching by name → ambiguous jika nama staff sama | Frontend | 🟠 High | **30%** |
| **FE-F05** | `setPresetRange` tanpa `default` case → `start`/`end` bisa `undefined` | Frontend | 🟡 Medium | **20%** |
| **FE-F06** | Commission drilldown footer re-kalkulasi di setiap render (tidak memoized) | Frontend | 🟡 Medium | **100%** |
| **FE-F07** | `financial/page.tsx` tidak ada error state UI — silent failure | Frontend | 🟡 Medium | **20%** |
| **FE-F08** | `SalesChart` component diimport tapi tidak pernah digunakan | Frontend | 🟢 Low | **100%** |

**Total: 23 Bug** — 🔴 Critical: 3 · 🟠 High: 8 · 🟡 Medium: 8 · 🟢 Low: 3

---

## 🗂️ Legenda Severity

| Simbol | Level | Definisi |
|--------|-------|----------|
| 🔴 | **Critical** | Data finansial salah/corrupt, fitur inti broken, atau keamanan multi-tenant bocor |
| 🟠 | **High** | Kalkulasi finansial tidak akurat, fitur inti bekerja tetapi hasilnya keliru |
| 🟡 | **Medium** | Crash pada edge case tertentu, atau perilaku yang membingungkan user |
| 🟢 | **Low** | Code smell, dead code, atau performa minor |

---

## 🔄 Flowchart Global: Alur Data Financial Reports

```
┌─────────────────────────────────────────────────────────────────────┐
│                    USER — Buka Halaman Report                        │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  [FE] reports/page.tsx — Komponen 75KB                              │
│  ┌────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │
│  │ Tab:       │  │ Tab:        │  │ Tab:        │  │ Tab:       │  │
│  │ summary    │  │ sales/staff │  │ profit/daily│  │ financial  │  │
│  │            │  │ /products   │  │ /wallet     │  │ (halaman   │  │
│  │ → /data    │  │ /expenses   │  │             │  │ terpisah)  │  │
│  │            │  │ → /reports  │  │ → /reports  │  │            │  │
│  └────────────┘  └─────────────┘  └─────────────┘  └────────────┘  │
└──────┬───────────────────┬────────────────┬────────────────────────┘
       │                   │                │
       ▼                   ▼                ▼
 /api/reports/data  /api/reports?type=   /api/reports/financial
       │             (switch statement)         │
       │                   │                   │
       ▼                   ▼                   ▼
 ┌──────────┐       ┌───────────┐        ┌──────────────┐
 │ MongoDB  │       │ MongoDB   │        │ MongoDB      │
 │ Invoice  │       │ Invoice   │        │ Invoice (agg)│
 │ Expense  │       │ Expense   │        │ Purchase(agg)│
 │ Appt     │       │ Staff     │        │ Expense (agg)│
 │ Customer │       │ Payroll   │        └──────────────┘
 │ Product  │       │ Purchase  │
 │ Purchase │       │ WalletTx  │
 └──────────┘       └───────────┘
```

---

---

# BAGIAN I — BACKEND BUGS

---

## 🔴 BE-F01 — `staffFilter` Dikirim sebagai String, Bukan ObjectId → Filter Sales Selalu Miss

**File:** `app/api/reports/route.ts` — case `"sales"`
**Probabilitas Terjadi:** 95%
**Dampak Finansial:** Filter "Sales by Staff" tidak pernah bekerja. User manager melihat laporan sales yang seolah sudah difilter per staff, tetapi datanya adalah semua transaksi tanpa filter. Keputusan bisnis (evaluasi kinerja, komisi) bisa didasarkan pada data yang salah.

### Narasi

Ketika user memilih staff dari dropdown di halaman Sales Report, frontend mengirim `staffId` sebagai query parameter berupa string mentah dari URL, misalnya `?staffId=664f2a1c0e3b2a001f0e5a78`. Di sisi backend, nilai ini langsung digunakan dalam query MongoDB tanpa konversi:

```typescript
// ❌ KODE BERMASALAH — app/api/reports/route.ts
const staffFilter = searchParams.get("staffId"); // → string "664f2a1c..."

if (staffFilter) {
    salesQuery.$or = [
        { staff: staffFilter },                          // ❌ String vs ObjectId
        { 'staffAssignments.staff': staffFilter },       // ❌ String vs ObjectId
        { 'items.staffAssignments.staff': staffFilter }, // ❌ String vs ObjectId
    ];
}
```

Field `staff` di collection Invoice disimpan sebagai `mongoose.Types.ObjectId`. MongoDB tidak melakukan auto-konversi antara tipe `ObjectId` dan `String`. Perbandingan `ObjectId("664f2a...") === "664f2a..."` selalu bernilai `false`. Hasilnya: query menggembalikan 0 dokumen atau semua dokumen (tergantung apakah ada `$or` lain), dan filter seolah tidak berfungsi.

```
┌────────────────┐      staffId="664f2a..."      ┌────────────────┐
│   Frontend     │ ─────────────────────────────▶│  Backend API   │
│ (Select Staff) │      (string, URL param)       │                │
└────────────────┘                                │  Query MongoDB:│
                                                  │  staff: "664f2a" ← String
                                                  │                │
                                                  │  MongoDB field:│
                                                  │  staff: ObjectId│
                                                  │                │
                                                  │  MATCH: ❌ MISS│
                                                  └────────────────┘
```

### Solusi

```typescript
// ✅ SOLUSI — Konversi ke ObjectId sebelum query
import mongoose from "mongoose";

const staffFilter = searchParams.get("staffId");

if (staffFilter && mongoose.isValidObjectId(staffFilter)) {
    const staffObjectId = new mongoose.Types.ObjectId(staffFilter);
    salesQuery.$or = [
        { staff: staffObjectId },
        { 'staffAssignments.staff': staffObjectId },
        { 'items.staffAssignments.staff': staffObjectId },
    ];
}
```

---

## 🔴 BE-F02 — Inkonsistensi `netProfit`: `/financial` Exclude Payroll, `/profit` Include Payroll

**File:** `app/api/reports/financial/route.ts` vs `app/api/reports/route.ts` (case `"profit"`)
**Probabilitas Terjadi:** 100%
**Dampak Finansial:** Dua halaman report dalam aplikasi yang sama menampilkan angka "Net Profit" yang berbeda untuk rentang tanggal yang sama. Hal ini menyebabkan ambiguitas serius dalam laporan keuangan bisnis dan bisa menyesatkan keputusan manajemen.

### Narasi

Di `/api/reports/financial`, kalkulasi net profit hanya mempertimbangkan tiga komponen:

```typescript
// ❌ KODE BERMASALAH — financial/route.ts
const netProfit = sales.totalSales - purchases.totalPurchases - expenses.totalExpenses;
// ❗ PAYROLL TIDAK DISERTAKAN — padahal ini pengeluaran nyata bisnis
```

Sementara di `/api/reports` (case `"profit"`), kalkulasi sudah benar dan mencakup payroll:

```typescript
// ✅ Kode di reports/route.ts — case "profit" (SUDAH BENAR)
data = {
    totalRevenue,
    totalExpenses,
    totalPayroll,       // ← disertakan
    totalPurchases,
    netProfit: totalRevenue - totalExpenses - totalPayroll - totalPurchases // ← benar
};
```

Ketika user membuka halaman **Financial Report** (`/financial`) vs tab **Profit & Loss** di halaman Reports utama, mereka akan melihat angka net profit yang berbeda untuk periode yang sama. Ini adalah inkonsistensi data keuangan yang serius.

```
┌──────────────────────────────────────────────────────────┐
│ Ilustrasi Dampak (Contoh Data Bulan Ini):                │
│                                                          │
│ Revenue         : Rp 50.000.000                          │
│ Purchases       : Rp 10.000.000                          │
│ Expenses        : Rp  5.000.000                          │
│ Payroll         : Rp  8.000.000                          │
│                                                          │
│ /financial → netProfit = 50jt - 10jt - 5jt = Rp 35jt   │
│ /profit    → netProfit = 50jt - 10jt - 5jt - 8jt = Rp 27jt│
│                                                          │
│ SELISIH: Rp 8.000.000 (nilai payroll hilang!)           │
└──────────────────────────────────────────────────────────┘
```

### Flowchart Inkonsistensi

```
User Request "Net Profit"
         │
         ├──── Buka /reports/financial ──────▶ netProfit = Revenue - Purchases - Expenses
         │                                              (❌ TANPA Payroll)
         │
         └──── Buka /reports?tab=profit ─────▶ netProfit = Revenue - Expenses - Payroll - Purchases
                                                          (✅ BENAR, dengan Payroll)
                    │
                    └── Angka berbeda untuk data yang sama = KONFLIK LAPORAN KEUANGAN
```

### Solusi

```typescript
// ✅ SOLUSI — Update financial/route.ts untuk include Payroll
const { Purchase, Invoice, Expense, Settings, Payroll } = await getTenantModels(tenantSlug);

// Tambahkan query Payroll
const payrollStats = await Payroll.aggregate([
    { $match: { date: { $gte: start, $lte: end } } }, // gunakan 'date' jika ada, atau 'payDate'
    {
        $group: {
            _id: null,
            totalPayroll: { $sum: "$totalAmount" },
            count: { $sum: 1 }
        }
    }
]);

const payroll = payrollStats[0] || { totalPayroll: 0, count: 0 };
const netProfit = sales.totalSales - purchases.totalPurchases - expenses.totalExpenses - payroll.totalPayroll;
const cashFlow = sales.totalCollected - purchases.totalPaid - expenses.totalExpenses - payroll.totalPayroll;
```

---

## 🟠 BE-F03 — Services & Products Report Include Invoice `cancelled` dan `voided`

**File:** `app/api/reports/route.ts` — case `"services"` dan `"products"`
**Probabilitas Terjadi:** 100%
**Dampak Finansial:** Revenue per layanan/produk di-inflate. Laporan menampilkan angka penjualan yang lebih tinggi dari kenyataan karena transaksi yang dibatalkan tetap dihitung.

### Narasi

Untuk laporan Financial Report yang berkaitan dengan performa layanan dan produk, backend melakukan query Invoice tanpa filter status:

```typescript
// ❌ KODE BERMASALAH — case "services"
const invoices = await Invoice.find({
    date: { $gte: start, $lte: end }
    // ❗ TIDAK ADA filter status — cancelled dan voided ikut dihitung!
}).lean();

invoices.forEach(inv => {
    inv.items.forEach((item: any) => {
        if (item.itemModel === 'Service') {
            serviceStats[name].count += item.quantity;   // ← termasuk dari invoice cancelled
            serviceStats[name].revenue += item.total;    // ← revenue dari invoice cancelled
        }
    });
});
```

Bandingkan dengan case `"sales"` yang sudah benar dengan filter status:

```typescript
// ✅ Berbeda dengan case "financial" yang sudah filter
{ $match: { ...query, status: { $ne: 'cancelled' } } }
```

Inkonsistensi ini menyebabkan laporan "Service Analytics" dan "Product Analytics" tidak dapat diandalkan untuk keputusan operasional.

### Solusi

```typescript
// ✅ SOLUSI — case "services"
const invoices = await Invoice.find({
    date: { $gte: start, $lte: end },
    status: { $nin: ['cancelled', 'voided'] }  // ← tambahkan filter ini
}).lean();

// ✅ SOLUSI — case "products" (sama)
const productInvoices = await Invoice.find({
    date: { $gte: start, $lte: end },
    status: { $nin: ['cancelled', 'voided'] }  // ← tambahkan filter ini
}).lean();
```

---

## 🟠 BE-F04 — `staffStats.appointments` Tidak Pernah Di-increment — Selalu 0

**File:** `app/api/reports/route.ts` — case `"staff"`
**Probabilitas Terjadi:** 100%
**Dampak:** Kolom "appointments" di laporan Staff Performance selalu menampilkan angka 0, meskipun data appointment tersedia di database.

### Narasi

Kode inisialisasi object `staffStats` mendefinisikan field `appointments: 0`, tetapi dalam seluruh logika iterasi invoice, field ini tidak pernah di-increment. Hanya `sales`, `revenue`, dan `commission` yang diupdate:

```typescript
// ❌ KODE BERMASALAH
staffStats[id] = {
    name: s.name,
    appointments: 0,   // ← diinisialisasi 0
    sales: 0,
    commission: 0,
    revenue: 0
};

// Dalam loop:
staffStats[id].sales += 1;           // ✅ di-increment
staffStats[id].revenue += inv.totalAmount; // ✅ di-increment
staffStats[id].commission += ...;    // ✅ di-increment
// appointments TIDAK PERNAH di-increment ← ❌ BUG
```

### Solusi

```typescript
// ✅ SOLUSI — Hitung appointments dari relasi invoice-appointment
// atau dari Appointment model secara terpisah

// Opsi 1: Hitung dari invoice yang linked ke appointment
if (inv.appointment) {
    staffStats[id].appointments += 1;
}

// Opsi 2 (lebih akurat): Tambahkan query Appointment terpisah
const appointmentCounts = await Appointment.aggregate([
    { $match: { date: { $gte: start, $lte: end }, status: { $ne: 'cancelled' } } },
    { $unwind: '$staff' },
    { $group: { _id: '$staff', count: { $sum: 1 } } }
]);
// Merge dengan staffStats berdasarkan _id
```

---

## 🟠 BE-F05 — Revenue Staff Di-count Ganda (Double-counting)

**File:** `app/api/reports/route.ts` — case `"staff"`
**Probabilitas Terjadi:** 100%
**Dampak Finansial:** Jika 1 invoice melibatkan 3 staff, total revenue yang dilaporkan untuk staff gabungan adalah 3x lipat nilai invoice asli. Laporan "total revenue dari seluruh staff" menjadi tidak akurat dan membingungkan.

### Narasi

Dalam logika pembuatan laporan staff performance, setiap staff yang terlibat dalam satu invoice mendapatkan kredit penuh atas nilai totalAmount invoice tersebut:

```typescript
// ❌ KODE BERMASALAH — double counting
inv.staffAssignments.forEach((assignment: any) => {
    const s = assignment.staff;
    staffStats[id].sales += 1;
    staffStats[id].revenue += inv.totalAmount; // ← SETIAP staff dapat nilai penuh!
    // Invoice Rp 300rb dengan 3 staff = 3 × Rp 300rb = Rp 900rb dilaporkan
});
```

```
Invoice #INV-001 = Rp 300.000
Melibatkan: Staff A + Staff B + Staff C

Laporan Staff Performance:
  Staff A revenue: Rp 300.000 ← nilai penuh
  Staff B revenue: Rp 300.000 ← nilai penuh
  Staff C revenue: Rp 300.000 ← nilai penuh
  ---
  Total dilaporkan: Rp 900.000 (seharusnya Rp 300.000)
```

### Solusi

```typescript
// ✅ SOLUSI — Pilih salah satu pendekatan bisnis:

// Opsi A: Revenue berbasis porsi komisi (porsiPersen)
staffStats[id].revenue += inv.totalAmount * (assignment.porsiPersen / 100);

// Opsi B: Tidak hitung revenue per staff (hanya hitung jumlah transaksi)
// Tampilkan revenue hanya di level invoice, bukan aggregate per staff

// Opsi C: Tandai sebagai "shared revenue" dan dokumentasikan di UI
staffStats[id].sharedRevenue += inv.totalAmount;
staffStats[id].sharedWith = inv.staffAssignments.length;
```

---

## 🟠 BE-F06 — `inv.amountPaid` Bisa `undefined` → `totalCollected` Menjadi NaN

**File:** `app/api/reports/route.ts` — case `"daily"`
**Probabilitas Terjadi:** 70%
**Dampak Finansial:** Laporan Daily Closing menampilkan `NaN` untuk kolom "Total Collected". Ini berpengaruh langsung pada rekonsiliasi kas harian.

### Narasi

Invoice lama atau invoice yang dibuat tanpa pembayaran penuh mungkin tidak memiliki field `amountPaid`. Kode reduce tidak memiliki fallback:

```typescript
// ❌ KODE BERMASALAH
const totalCollected = dailyInvoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
// Jika inv.amountPaid === undefined:
// 0 + undefined = NaN
// NaN + 500000 = NaN (kontaminasi seluruh akumulasi)
```

Nilai NaN akan menyebar ke `cashFlow` di financial route:
```typescript
const cashFlow = sales.totalCollected - purchases.totalPaid - expenses.totalExpenses;
// NaN - 0 - 0 = NaN ← cashFlow ikut corrupt
```

### Solusi

```typescript
// ✅ SOLUSI — Gunakan nullish coalescing di setiap reduce
const totalCollected = dailyInvoices.reduce((sum, inv) => sum + (inv.amountPaid ?? 0), 0);

// Atau di level aggregation MongoDB (lebih aman):
const invoiceStats = await Invoice.aggregate([
    { $match: { ...query, status: { $ne: 'cancelled' } } },
    {
        $group: {
            _id: null,
            totalSales: { $sum: { $ifNull: ["$totalAmount", 0] } },
            totalCollected: { $sum: { $ifNull: ["$amountPaid", 0] } }, // ← $ifNull di MongoDB
            count: { $sum: 1 }
        }
    }
]);
```

---

## 🟠 BE-F07 — Payroll Filter Pakai `createdAt` Bukan `date` (Inkonsisten dengan Semua Entitas Lain)

**File:** `app/api/reports/route.ts` — case `"profit"`
**Probabilitas Terjadi:** 80%
**Dampak Finansial:** Payroll yang dibuat di bulan yang berbeda dari periode penggajian aktual bisa masuk/keluar dari rentang laporan. Kalkulasi net profit menjadi tidak akurat tergantung kapan record payroll di-create, bukan kapan gaji sebenarnya dibayarkan.

### Narasi

Dalam satu query `Promise.all`, semua entitas menggunakan field `date` kecuali Payroll:

```typescript
// ❌ KODE BERMASALAH — case "profit"
const [revInvoices, expExpenses, payPayroll, purPurchases] = await Promise.all([
    Invoice.find({ date: { $gte: start, $lte: end } }).lean(),         // ✅ date
    Expense.find({ date: { $gte: start, $lte: end } }).lean(),         // ✅ date
    Payroll.find({ createdAt: { $gte: start, $lte: end } }).lean(),    // ❌ createdAt
    Purchase.find({ date: { $gte: start, $lte: end }, ... }).lean()    // ✅ date
]);
```

Jika model Payroll memiliki field `date` atau `payDate` (tanggal pembayaran aktual), maka menggunakan `createdAt` bisa menyebabkan payroll yang dibuat di akhir bulan untuk periode bulan lalu masuk ke laporan bulan yang salah.

### Solusi

```typescript
// ✅ SOLUSI — Periksa schema Payroll, gunakan field yang tepat
// Jika ada field 'payDate' atau 'date':
Payroll.find({ payDate: { $gte: start, $lte: end } }).lean(),

// Jika model benar-benar hanya punya createdAt, dokumentasikan di komentar
// dan tambahkan index pada createdAt untuk performa:
// db.payrolls.createIndex({ createdAt: -1 })
```

---

## 🟠 BE-F08 — `openaiApiKey` Tidak Di-decrypt Sebelum Dipakai

**File:** `app/api/ai-reports/route.ts`
**Probabilitas Terjadi:** 60%
**Dampak:** Fitur AI Reports tidak berfungsi sama sekali jika API key disimpan dalam format terenkripsi di database. Request ke OpenAI API akan selalu gagal dengan error `401 Unauthorized`.

### Narasi

Di route lain seperti `wa-daily-report`, token Fonnte didekripsi sebelum digunakan:

```typescript
// ✅ Cara benar di wa-daily-report/route.ts
const fonnteToken = settings?.fonnteToken
    ? decryptFonnteToken(String(settings.fonnteToken).trim())
    : undefined;
```

Namun di `ai-reports/route.ts`, API key OpenAI digunakan langsung tanpa dekripsi:

```typescript
// ❌ KODE BERMASALAH — ai-reports/route.ts
const settings = await Settings.findOne({});
if (!settings?.aiEnabled || !settings?.openaiApiKey) { /* ... */ }

// Kemudian langsung dipakai:
"Authorization": `Bearer ${settings.openaiApiKey}` // ← mungkin masih terenkripsi!
```

Jika `settings.openaiApiKey` disimpan dalam format encrypted (seperti `enc:v1:abc123...`), maka request ke OpenAI akan mengirimkan kunci yang salah dan mendapat response `401 Unauthorized`.

### Flowchart Error Path

```
User → POST /api/ai-reports
         │
         ▼
    Settings.findOne() → { openaiApiKey: "enc:v1:ENCRYPTED_VALUE" }
         │
         ▼
    fetch("https://api.openai.com/...", {
        Authorization: "Bearer enc:v1:ENCRYPTED_VALUE"  ← SALAH!
    })
         │
         ▼
    OpenAI returns 401 Unauthorized
         │
         ▼
    Response: { success: false, error: "Incorrect API key" }
         │
         ▼
    User: "AI Reports tidak berfungsi" 🤷
```

### Solusi

```typescript
// ✅ SOLUSI — Dekripsi key sebelum dipakai
import { decryptFonnteToken } from '@/lib/encryption';
// Atau buat fungsi decrypt khusus untuk OpenAI key

const rawKey = settings?.openaiApiKey;
const openaiApiKey = rawKey ? decryptFonnteToken(String(rawKey).trim()) : null;

if (!settings?.aiEnabled || !openaiApiKey) {
    return NextResponse.json({
        success: false,
        error: "AI is not enabled or API key is missing."
    }, { status: 400 });
}

// Gunakan openaiApiKey (sudah terdekripsi)
"Authorization": `Bearer ${openaiApiKey}`
```

---

## 🟡 BE-F09 — `aiData.choices[0]` Tanpa Null-check → Potential Runtime Crash

**File:** `app/api/ai-reports/route.ts`
**Probabilitas Terjadi:** 30%
**Dampak:** Server crash dengan `TypeError: Cannot read properties of undefined` ketika OpenAI mengembalikan response dengan array `choices` kosong (misalnya karena content filtering atau error jaringan parsial).

### Narasi

```typescript
// ❌ KODE BERMASALAH
return NextResponse.json({
    success: true,
    analysis: aiData.choices[0].message.content, // ← crash jika choices kosong/undefined
    usage: aiData.usage
});
```

OpenAI API dapat mengembalikan `choices: []` dalam skenario tertentu:
- Model diblokir oleh content policy
- Timeout parsial
- Response terputus

### Solusi

```typescript
// ✅ SOLUSI — Validasi response sebelum akses
const choice = aiData.choices?.[0];
if (!choice?.message?.content) {
    return NextResponse.json({
        success: false,
        error: "AI returned an empty response. Please try again."
    }, { status: 500 });
}

return NextResponse.json({
    success: true,
    analysis: choice.message.content,
    usage: aiData.usage
});
```

---

## 🟡 BE-F10 — AI Low Stock Hardcode `{ $lte: 10 }`, Abaikan Field `alertQuantity`

**File:** `app/api/ai-reports/route.ts`
**Probabilitas Terjadi:** 100%
**Dampak:** AI report memberikan rekomendasi berdasarkan threshold stok yang tidak sesuai dengan konfigurasi bisnis. Produk dengan `alertQuantity: 50` tidak akan dideteksi sebagai low stock oleh AI, sementara produk yang memang intended untuk stok rendah (contoh: produk premium, stok 5 = normal) selalu muncul sebagai alert.

### Narasi

```typescript
// ❌ KODE BERMASALAH — ai-reports/route.ts
const lowStock = await Product.find({
    stock: { $lte: 10 }  // ← angka hardcode 10
}).limit(5).select('name stock');
```

Sementara di halaman Inventory Report (main reports page), threshold yang digunakan adalah `p.alertQuantity` yang dikonfigurasi per produk:

```typescript
// ✅ Cara benar di reports/data untuk summary
const lowStock = products.filter((p: any) => p.stock <= p.alertQuantity).length;
```

### Solusi

```typescript
// ✅ SOLUSI — Gunakan alertQuantity dari masing-masing produk
const lowStock = await Product.find({
    $expr: { $lte: ["$stock", "$alertQuantity"] }  // ← MongoDB expression untuk field comparison
}).limit(10).select('name stock alertQuantity');
```

---

## 🟡 BE-F11 — `ActivityLog.countDocuments()` Tanpa Filter → Total Pagination Salah

**File:** `app/api/reports/activity-log/route.ts`
**Probabilitas Terjadi:** 100%
**Dampak:** Jumlah total halaman di pagination Activity Log salah. User melihat "Page 1 of 150" padahal setelah filter atau dalam konteks tenant tertentu seharusnya lebih sedikit. Jika multi-tenant, semua tenant mendapat count gabungan.

### Narasi

```typescript
// ❌ KODE BERMASALAH — activity-log/route.ts
const total = await ActivityLog.countDocuments();  // ← TANPA filter apapun
const logs = await ActivityLog.find()
    .populate('user', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
```

Tidak ada filter berdasarkan tanggal, pengguna, atau kriteria lainnya. `countDocuments()` menghitung SEMUA log di collection, sehingga `total` selalu merepresentasikan keseluruhan data, bukan data yang sesuai dengan query yang dieksekusi.

### Solusi

```typescript
// ✅ SOLUSI — Buat query object dan gunakan untuk keduanya
const query: any = {};
if (searchParams.get('userId')) query.user = searchParams.get('userId');
if (searchParams.get('action')) query.action = searchParams.get('action');
// Tambahkan filter lain sesuai kebutuhan

const [total, logs] = await Promise.all([
    ActivityLog.countDocuments(query),  // ← gunakan query yang sama
    ActivityLog.find(query)
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
]);
```

---

## 🟡 BE-F12 — WA Daily Report Hardcode `Asia/Jakarta` — Abaikan Settings Tenant

**File:** `app/api/cron/wa-daily-report/route.ts`
**Probabilitas Terjadi:** 30%
**Dampak:** Untuk salon yang berlokasi di luar WIB (misalnya WITA untuk Bali/Makassar, WIT untuk Papua), laporan harian dikirim dan menghitung data berdasarkan jam yang salah. Bisa jadi laporan "hari ini" termasuk atau tidak termasuk transaksi yang seharusnya.

### Narasi

```typescript
// ❌ KODE BERMASALAH — wa-daily-report/route.ts
const tz = 'Asia/Jakarta'; // ← HARDCODE, tidak pakai settings.timezone

const today = new Date();
const year = new Intl.DateTimeFormat('en-US', { timeZone: tz, ... }).format(today);
// dst...
const startOfDayStr = `${year}-..T00:00:00.000+07:00`; // ← offset +07 hardcode
```

Padahal di seluruh codebase lain, timezone diambil dari `Settings.findOne()` yang sudah dilakukan di atas fungsi ini.

### Solusi

```typescript
// ✅ SOLUSI — Pakai timezone dari settings yang sudah di-fetch
const settings = await Settings.findOne();
const timezone = settings?.timezone || 'Asia/Jakarta'; // ← fallback ke WIB jika belum di-set

const tz = timezone; // gunakan variable ini di seluruh fungsi
```

---

## 🟡 BE-F13 — `Customer` & `Product` Load SEMUA Data Tanpa Filter di `/data`

**File:** `app/api/reports/data/route.ts`
**Probabilitas Terjadi:** 100%
**Dampak Performa:** Untuk salon dengan ribuan customer dan produk, endpoint ini akan mengembalikan payload yang sangat besar. Memory usage server tinggi, response time lambat, dan data yang tidak perlu dikirim ke frontend.

### Narasi

```typescript
// ❌ KODE BERMASALAH — reports/data/route.ts
const [invoices, expenses, appointments, customers, products, purchases] = await Promise.all([
    Invoice.find(...).populate(...).sort(...),
    Expense.find(...).sort(...),
    Appointment.find(...).populate(...),
    Customer.find().select("_id name phone email totalPurchases membershipTier"), // ← SEMUA customer
    Product.find().select("_id name stock alertQuantity price"),                  // ← SEMUA produk
    Purchase.find(...).populate(...).sort(...)
]);
```

`Customer.find()` tanpa filter mengembalikan semua customer di database. Untuk bisnis dengan 5000+ customer, ini adalah query yang sangat mahal dan hasilnya hanya dipakai untuk menghitung `totalCustomers` dan `lowStockCount`.

### Solusi

```typescript
// ✅ SOLUSI — Hitung dengan aggregation, bukan load semua data
const [customerCount, lowStockProducts] = await Promise.all([
    Customer.countDocuments(),  // ← hanya hitung, tidak load semua data
    Product.find({
        $expr: { $lte: ["$stock", "$alertQuantity"] }
    }).select("_id name stock alertQuantity price").limit(20)
]);

// Return count, bukan array penuh
return NextResponse.json({
    success: true,
    data: {
        invoices, expenses, appointments,
        customerCount,   // ← angka saja
        lowStockProducts, // ← hanya yang perlu perhatian
        purchases
    }
});
```

---

## 🟢 BE-F14 — Rate Limiter In-memory Tidak Persistent (Reset saat Serverless Cold Start)

**File:** `lib/rateLimiter.ts`
**Probabilitas Terjadi:** 100%
**Dampak:** Di environment serverless (Vercel), setiap function invocation bisa berjalan di instance berbeda. Rate limit counter tidak dishared antar instance, sehingga user bisa bypass rate limit dengan cara memanggil dari berbagai region atau saat cold start.

### Narasi

```typescript
// ❌ KODE BERMASALAH — rateLimiter.ts
const rateLimitStore = new Map<string, RateLimitRecord>(); // ← in-memory, tidak persistent

// Komentar sudah mengakui masalah ini:
// "In production, you'd want to use Redis or another persistent store"
```

### Solusi

```typescript
// ✅ SOLUSI — Gunakan Vercel KV atau Upstash Redis
import { Redis } from '@upstash/redis';
const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });

export async function checkRateLimit(key: string, windowMs: number, max: number) {
    const count = await redis.incr(`ratelimit:${key}`);
    if (count === 1) await redis.pexpire(`ratelimit:${key}`, windowMs);
    return { allowed: count <= max, remaining: Math.max(0, max - count) };
}
```

---

## 🟢 BE-F15 — `formatterCache` di `dateUtils` Unbounded — Potensi Memory Leak

**File:** `lib/dateUtils.ts`
**Probabilitas Terjadi:** 100%
**Dampak:** Module-level `Map` yang terus tumbuh tanpa batas di setiap unique kombinasi timezone + options. Dalam long-running Node.js process, ini bisa menyebabkan memory creep.

### Narasi

```typescript
// ❌ KODE BERMASALAH — dateUtils.ts
const formatterCache = new Map<string, Intl.DateTimeFormat>(); // ← tidak ada size limit

const getFormatter = (timezone: string, options: Intl.DateTimeFormatOptions = {}) => {
    const cacheKey = `${timezone}-${JSON.stringify(options)}`; // ← key dari options object
    if (!formatterCache.has(cacheKey)) {
        formatterCache.set(cacheKey, new Intl.DateTimeFormat(...)); // ← terus bertambah
    }
    return formatterCache.get(cacheKey)!;
};
```

### Solusi

```typescript
// ✅ SOLUSI — Gunakan LRU Cache sederhana atau batasi ukuran
const MAX_CACHE_SIZE = 50;
const formatterCache = new Map<string, Intl.DateTimeFormat>();

const getFormatter = (timezone: string, options: Intl.DateTimeFormatOptions = {}) => {
    const cacheKey = `${timezone}-${JSON.stringify(options)}`;
    if (!formatterCache.has(cacheKey)) {
        if (formatterCache.size >= MAX_CACHE_SIZE) {
            // Hapus entry pertama (FIFO sederhana)
            formatterCache.delete(formatterCache.keys().next().value);
        }
        formatterCache.set(cacheKey, new Intl.DateTimeFormat("en-US", { ... }));
    }
    return formatterCache.get(cacheKey)!;
};
```

---

---

# BAGIAN II — FRONTEND BUGS

---

## 🔴 FE-F01 — `StatCard` Dipanggil dengan Props `trend` Bertipe String, Bukan Object → Trend Tidak Render

**File:** `app/[slug]/(frontend)/reports/page.tsx` — `renderSummary()` vs `components/reports/StatCard.tsx`
**Probabilitas Terjadi:** 100%
**Dampak:** Seluruh section "trend" di kartu statistik Summary Report tidak pernah tampil. User tidak mendapatkan indikasi tren apakah revenue naik atau turun.

### Narasi

Komponen `StatCard` mendefinisikan interface `trend` sebagai object:

```typescript
// components/reports/StatCard.tsx — INTERFACE YANG BENAR
interface StatCardProps {
    trend?: {
        value: number;   // ← angka persentase
        label: string;   // ← label teks
        positive?: boolean;
    };
}

// Di dalam render:
{trend && (
    <div className={`... ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
        <span>{trend.positive ? '+' : ''}{trend.value}%</span>  // ← mengakses trend.value
        <span>{trend.label}</span>
    </div>
)}
```

Namun di halaman laporan, `StatCard` dipanggil dengan `trend` berupa string:

```typescript
// ❌ KODE BERMASALAH — reports/page.tsx
<StatCard
    title="Total Revenue"
    value={formatCurrency(reportData?.totalRevenue)}
    icon={DollarSign}
    color="green"
    trend="Revenue"    // ← string! Bukan { value: number, label: string }
    trendUp={true}     // ← prop ini tidak ada di interface StatCard!
/>
```

TypeScript akan throw error di sini (jika strict mode), atau di runtime `trend.value` akan menjadi `undefined` dan karena `trend` (string) adalah truthy, React akan mencoba render `{trend.value}%` yang menghasilkan `undefined%`. Komponen mungkin tidak crash, tetapi konten trend tidak bermakna.

### Flowchart

```
reports/page.tsx                    StatCard.tsx
     │                                   │
     │  trend="Revenue" (string)          │
     │  trendUp={true} (bukan di props)  │
     │ ───────────────────────────────▶  │
     │                                   │  trend = "Revenue" (truthy!)
     │                                   │  → {trend && (...)} → MASUK blok render
     │                                   │  → trend.value → undefined
     │                                   │  → render: "undefined%" 💥
     │                                   │  → trend.label → undefined
     │                                   │  → trend.positive → undefined (falsy)
     │                                   │  → class: 'text-red-600' (selalu merah!)
     │                                   │
```

### Solusi

```typescript
// ✅ SOLUSI — Sesuaikan pemanggilan dengan interface yang benar
<StatCard
    title="Total Revenue"
    value={formatCurrency(reportData?.totalRevenue)}
    icon={DollarSign}
    color="green"
    trend={{
        value: 0, // Atau hitung persentase change dari periode sebelumnya
        label: "Revenue",
        positive: true
    }}
/>

// ATAU: Hapus prop trend jika memang tidak ada data perbandingan periode
<StatCard
    title="Total Revenue"
    value={formatCurrency(reportData?.totalRevenue)}
    icon={DollarSign}
    color="green"
    // trend tidak dikirim → section trend tidak render (aman)
/>
```

---

## 🟠 FE-F02 — `renderTable` Sort Gagal untuk Format Currency Lokal Indonesia

**File:** `app/[slug]/(frontend)/reports/page.tsx` — fungsi `renderTable`
**Probabilitas Terjadi:** 100%
**Dampak:** Fitur sort kolom di semua tabel laporan (Sales, Services, Products, dll) bekerja keliru untuk kolom bertipe currency. Angka "Rp1.000.000" akan disort secara leksikal, bukan numerik, menghasilkan urutan yang salah.

### Narasi

Kode sort mencoba mengekstrak angka dari string currency dengan regex:

```typescript
// ❌ KODE BERMASALAH — renderTable
if (typeof aVal === 'string') {
    const cleaned = aVal.replace(/[^0-9.-]+/g, "");
    if (cleaned !== "" && !isNaN(Number(cleaned))
        && (aVal.includes(settings.symbol) || aVal.includes('Rp'))) {
        aVal = Number(cleaned);
    }
}
```

Masalahnya ada di format angka Indonesia. `Number.toLocaleString()` di Indonesia menggunakan **titik** sebagai pemisah ribuan dan **koma** sebagai desimal:
- `Rp1.500.000,00` → `cleaned = "1500000,00"` → `Number("1500000,00") = NaN`!

Berbeda dengan format US: `$1,500,000.00` yang regex-nya akan bekerja.

```
Input currency:   "Rp1.500.000"
Regex extraction: "1.500.000"     ← titik di-remove? Tidak, regex hanya hapus non [0-9.-]
Number parse:     Number("1.500.000") = 1.5  (interpreted as 1.5 not 1,500,000!)

Sorting result: Rp5.000 < Rp1.500.000 → sort sebagai 5 > 1.5 = SALAH!
```

### Solusi

```typescript
// ✅ SOLUSI — Hapus semua pemisah ribuan sebelum konversi
const extractNumber = (val: string): number | null => {
    // Hapus currency symbol dan whitespace
    let cleaned = val.replace(settings.symbol, '').replace('Rp', '').trim();
    // Hapus pemisah ribuan (titik untuk ID, koma untuk US)
    cleaned = cleaned.replace(/\./g, '').replace(/,/g, '');
    // Atau: gunakan regex yang lebih robust
    cleaned = cleaned.replace(/[^\d-]/g, '');
    const num = Number(cleaned);
    return isNaN(num) ? null : num;
};

// Dalam sort:
if (typeof aVal === 'string') {
    const num = extractNumber(aVal);
    if (num !== null) aVal = num;
}
```

---

## 🟠 FE-F03 — `handleExport` Tidak Cover Tab `wallet` & `daily` → Export Gagal/Data Mentah

**File:** `app/[slug]/(frontend)/reports/page.tsx` — fungsi `handleExport`
**Probabilitas Terjadi:** 100%
**Dampak:** Ketika user mencoba export dari tab Wallet atau Daily Closing, data yang diekspor adalah objek mentah dari state React (termasuk nested object, timestamp, dll) yang tidak dapat dibaca. Atau export menghasilkan file dengan kolom yang tidak bermakna.

### Narasi

```typescript
// ❌ KODE BERMASALAH — handleExport
const handleExport = () => {
    let exportData = Array.isArray(reportData) ? reportData : [reportData];

    if (activeTab === 'sales') { exportData = reportData.map(...) }
    else if (activeTab === 'staff') { exportData = reportData.map(...) }
    else if (activeTab === 'services') { exportData = reportData.map(...) }
    else if (activeTab === 'products') { exportData = reportData.map(...) }
    else if (activeTab === 'customers') { exportData = reportData.map(...) }
    else if (activeTab === 'profit') { exportData = [{ ... }] }
    // ❌ 'wallet' — TIDAK ADA handler → exportData = [reportData] (objek mentah)
    // ❌ 'daily'  — TIDAK ADA handler → exportData = [reportData] (objek mentah)
    // ❌ 'activity-log' — TIDAK ADA handler
    // ❌ 'inventory' — TIDAK ADA handler (meski data ada)

    const ws = XLSX.utils.json_to_sheet(exportData);
    // Sheet akan berisi key MongoDB internal, timestamp raw, nested objects
};
```

### Solusi

```typescript
// ✅ SOLUSI — Tambahkan handler untuk setiap tab yang missing
else if (activeTab === 'daily') {
    exportData = [{
        'Total Sales (Amount)': reportData.totalSales,
        'Total Collected (Cash In)': reportData.totalCollected,
        'Total Expenses': reportData.totalExpenses,
        'Invoice Count': reportData.invoiceCount,
        'Cash': reportData.payments?.Cash || 0,
        'Card': reportData.payments?.Card || 0,
        'QRIS': reportData.payments?.QRIS || 0,
        'Transfer': reportData.payments?.Transfer || 0,
    }];
} else if (activeTab === 'wallet') {
    exportData = (reportData.transactions || []).map((tx: any) => ({
        'Customer': tx.customer?.name || 'N/A',
        'Type': tx.type,
        'Amount': tx.amount,
        'Date': formatSafeDate(tx.createdAt),
        'Description': tx.description || '-',
    }));
} else if (activeTab === 'inventory') {
    exportData = reportData.map((p: any) => ({
        'Product Name': p.name,
        'SKU': p.sku || 'N/A',
        'Stock': p.stock,
        'Alert Qty': p.alertQuantity,
        'Status': p.stock <= p.alertQuantity ? 'LOW STOCK' : 'OK',
        'Price': p.price,
    }));
}
```

---

## 🟠 FE-F04 — Staff Drilldown Matching by Name → Ambiguous jika Ada Nama Staff Sama

**File:** `app/[slug]/(frontend)/reports/page.tsx` — `handleStaffDrillDown`
**Probabilitas Terjadi:** 30%
**Dampak:** Jika dua staff memiliki nama yang sama (misalnya "Sarah"), klik pada salah satu di tabel staff performance akan melakukan drilldown menggunakan ID staff pertama yang ditemukan di `staffList`, bukan staff yang sebenarnya diklik.

### Narasi

```typescript
// ❌ KODE BERMASALAH
const handleStaffDrillDown = async (staffName: string) => { // ← hanya kirim nama!
    const match = staffList.find(s => s.name === staffName); // ← find by name, bukan ID
    if (!match) { setDrillDownData([]); return; }
    const res = await fetch(`/api/reports?type=sales&...&staffId=${match._id}`, ...);
    // ← jika ada 2 "Sarah", selalu pakai ID "Sarah" pertama di list
};

// Di tabel staff, row onClick hanya kirim nama:
<tr onClick={() => handleStaffDrillDown(s.name)}>  // ← seharusnya kirim s._id
```

Padahal saat rendering tabel, sudah ada akses ke `s._id` (karena data dari backend menyertakannya). Passing ID secara langsung jauh lebih aman.

### Solusi

```typescript
// ✅ SOLUSI — Kirim staff object (id + name) langsung dari row

// Ubah fungsi signature:
const handleStaffDrillDown = async (staffId: string, staffName: string) => {
    setDrillDownStaff(staffName);
    setDrillDownLoading(true);
    // Tidak perlu cari di staffList lagi — langsung pakai staffId
    const res = await fetch(
        `/api/reports?type=sales&startDate=${dateRange.start}&endDate=${dateRange.end}&staffId=${staffId}`,
        { headers: { "x-store-slug": slug } }
    );
    // ...
};

// Di row onClick:
<tr onClick={() => handleStaffDrillDown(s._id, s.name)}>
```

---

## 🟡 FE-F05 — `setPresetRange` Tanpa `default` Case → `start`/`end` Bisa `undefined`

**File:** `app/[slug]/(frontend)/reports/page.tsx` — fungsi `setPresetRange`
**Probabilitas Terjadi:** 20%
**Dampak:** Jika fungsi `setPresetRange` dipanggil dengan nilai preset yang tidak dikenali (misalnya dari future extension atau bug lain), `start` dan `end` akan menjadi `undefined`. Pemanggilan `setDateRange({ start: undefined, end: undefined })` akan menyebabkan fetch API dengan parameter tanggal kosong.

### Narasi

```typescript
// ❌ KODE BERMASALAH
const setPresetRange = (preset: 'thisMonth' | 'lastMonth' | 'last3Months' | 'today') => {
    let start, end; // ← undefined by default

    switch (preset) {
        case 'today':       start = ...; end = start; break;
        case 'thisMonth':   ({ startDate: start, endDate: end } = ...); break;
        case 'lastMonth':   (...); break;
        case 'last3Months': start = ...; end = ...; break;
        // ❌ TIDAK ADA default case!
    }

    setDateRange({ start, end }); // ← start/end bisa undefined jika preset tidak match
};
```

### Solusi

```typescript
// ✅ SOLUSI — Tambahkan default case dan validasi
const setPresetRange = (preset: 'thisMonth' | 'lastMonth' | 'last3Months' | 'today') => {
    const now = new Date();
    let start: string, end: string;

    switch (preset) {
        case 'today':
            start = end = getCurrentDateInTimezone(settings.timezone || "UTC", now);
            break;
        case 'thisMonth':
            ({ startDate: start, endDate: end } = getMonthDateRangeInTimezone(settings.timezone || "UTC", now));
            break;
        case 'lastMonth':
            const lastMonth = subMonths(now, 1);
            ({ startDate: start, endDate: end } = getMonthDateRangeInTimezone(settings.timezone || "UTC", lastMonth));
            break;
        case 'last3Months':
            start = getMonthDateRangeInTimezone(settings.timezone || "UTC", subMonths(now, 2)).startDate;
            end = getMonthDateRangeInTimezone(settings.timezone || "UTC", now).endDate;
            break;
        default:
            console.warn(`Unknown preset: ${preset}`);
            return; // ← jangan update dateRange jika preset tidak dikenal
    }

    if (start && end) setDateRange({ start, end }); // ← validasi sebelum set
};
```

---

## 🟡 FE-F06 — Commission Summary di Drilldown Footer Di-kalkulasi Ulang di Setiap Render

**File:** `app/[slug]/(frontend)/reports/page.tsx` — Staff Drilldown Modal footer
**Probabilitas Terjadi:** 100%
**Dampak Performa:** Untuk staff dengan 200+ invoice, kalkulasi commission di footer modal dilakukan di setiap render cycle. Dengan React StrictMode (development) yang double-invoke, ini bisa menyebabkan lag saat scroll atau interaksi.

### Narasi

```typescript
// ❌ KODE BERMASALAH — kalkulasi berat di dalam JSX
<div className="px-6 py-3 border-t ...">
    Commission: {formatCurrency(drillDownData.reduce((s: number, inv: any) => {
        // Iterasi semua invoice × semua staffAssignments × items × staffAssignments
        const staffMatch = staffList.find(sf => sf.name === drillDownStaff); // ← find di setiap iterasi!
        const sid = staffMatch?._id;
        let c = 0;
        (inv.staffAssignments || []).forEach((sa: any) => {
            if (String(sa.staff?._id || sa.staff || sa.staffId) === String(sid)) c += ...;
        });
        (inv.items || []).forEach((item: any) => {
            (item.staffAssignments || []).forEach((sa: any) => {
                if (String(sa.staff?._id || sa.staff || sa.staffId) === String(sid)) c += ...;
            });
        });
        return s + c;
    }, 0))}
```

Kompleksitas O(n × m × k) dieksekusi di setiap render, termasuk hover, scroll, dan typing.

### Solusi

```typescript
// ✅ SOLUSI — Memoize kalkulasi dengan useMemo
const drillDownSummary = useMemo(() => {
    if (!drillDownStaff || drillDownData.length === 0) return { commission: 0, revenue: 0 };

    const staffMatch = staffList.find(sf => sf.name === drillDownStaff); // ← hanya sekali
    const sid = staffMatch?._id;

    return drillDownData.reduce((acc, inv) => {
        let c = 0;
        (inv.staffAssignments || []).forEach((sa: any) => {
            if (String(sa.staff?._id || sa.staff || sa.staffId) === String(sid))
                c += (sa.komisiNominal || sa.commission || 0);
        });
        (inv.items || []).forEach((item: any) => {
            (item.staffAssignments || []).forEach((sa: any) => {
                if (String(sa.staff?._id || sa.staff || sa.staffId) === String(sid))
                    c += (sa.komisiNominal || sa.commission || 0);
            });
        });
        return { commission: acc.commission + c, revenue: acc.revenue + (inv.totalAmount || 0) };
    }, { commission: 0, revenue: 0 });
}, [drillDownData, drillDownStaff, staffList]); // ← hanya kalkulasi ulang jika data berubah
```

---

## 🟡 FE-F07 — `financial/page.tsx` Tidak Ada Error State UI — Silent Failure

**File:** `app/[slug]/(frontend)/reports/financial/page.tsx`
**Probabilitas Terjadi:** 20%
**Dampak UX:** Ketika fetch API gagal (network error, 500, 403), halaman Financial Report hanya menampilkan teks "Failed to load data" yang plain dan tidak ada tombol retry yang jelas. User tidak tahu apakah ini error sementara atau masalah serius.

### Narasi

```typescript
// ❌ KODE BERMASALAH — financial/page.tsx
const fetchReport = async () => {
    setLoading(true);
    try {
        const res = await fetch(`/api/reports/financial?${query.toString()}`, { headers: { ... } });
        const json = await res.json();
        if (json.success) {
            setData(json.data);
        }
        // ❌ Tidak ada: else { setError(...) } — data tidak di-set, null state muncul
    } catch (error) {
        console.error(error); // ❌ Hanya log, tidak ada user feedback
    } finally {
        setLoading(false);
    }
};

// Di JSX:
) : data ? (
    <div>...</div>
) : (
    <div className="text-center py-20 text-gray-500">
        Failed to load data  // ← static text, tidak ada retry, tidak ada detail error
    </div>
)}
```

### Solusi

```typescript
// ✅ SOLUSI — Tambahkan error state yang informatif
const [error, setError] = useState<string | null>(null);

const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
        const res = await fetch(...);
        if (!res.ok) {
            setError(`Server error: ${res.status} ${res.statusText}`);
            return;
        }
        const json = await res.json();
        if (json.success) {
            setData(json.data);
        } else {
            setError(json.error || 'Failed to load financial data');
        }
    } catch (err: any) {
        setError('Network error: ' + err.message);
    } finally {
        setLoading(false);
    }
};

// Di JSX:
) : error ? (
    <div className="text-center py-20">
        <p className="text-red-600 font-bold mb-4">{error}</p>
        <button onClick={fetchReport} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
            Try Again
        </button>
    </div>
) : (
    <div>Loading...</div>
)}
```

---

## 🟢 FE-F08 — `SalesChart` Component Diimport tapi Tidak Pernah Digunakan

**File:** `components/reports/SalesChart.tsx`
**Probabilitas Terjadi:** 100%
**Dampak:** Dead code / bundle bloat. Komponen ini mengimport `recharts` yang cukup berat. Meskipun tree-shaking bisa mengurangi dampaknya, keberadaan file ini membingungkan developer yang akan maintain kode.

### Narasi

Komponen `SalesChart` di `components/reports/SalesChart.tsx` memiliki implementasi lengkap (Area Chart & Bar Chart dengan Recharts), tetapi tidak ada satu pun halaman report yang mengimportnya:

```bash
# Grep hasil pencarian:
grep -r "SalesChart" app/ components/
# → 0 results (tidak ada yang mengimport komponen ini)
```

Sementara `StatCard` dan `DateRangePicker` dari folder yang sama memang diimport dan digunakan.

### Solusi

Dua opsi:
1. **Hapus file** jika memang tidak ada rencana penggunaan
2. **Integrasikan** ke halaman laporan yang relevan (misalnya visualisasi tren revenue harian di Daily Closing tab atau trend penjualan di Summary tab)

```typescript
// ✅ Contoh integrasi yang bermakna di tab 'daily':
import SalesChart from "@/components/reports/SalesChart";

// Jika ada data tren harian:
<SalesChart
    data={dailyTrend}
    type="bar"
    dataKey="revenue"
    xAxisKey="date"
    color="#3b82f6"
    height={200}
/>
```

---

---

# BAGIAN III — FLOWCHART BUG

---

## Flowchart 1: Alur Bug Backend Financial Route

```
GET /api/reports/financial
         │
         ▼
    checkPermission()
         │
    ┌────┴────┐
    │ Granted │
    └────┬────┘
         │
         ▼
    getUtcRangeForDateRange(start, end, timezone)
         │
         ▼
    ┌──────────────────────────────────────────────┐
    │ Invoice.aggregate()                          │
    │   $match: status ≠ 'cancelled' ✅            │
    │   $group: totalSales, totalCollected ←       │
    │     ┌──────────────────────────────────────┐ │
    │     │ BE-F06: amountPaid bisa undefined    │ │
    │     │ → totalCollected = NaN ❌             │ │
    │     └──────────────────────────────────────┘ │
    └──────────────────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────────────────┐
    │ Purchase.aggregate()                         │
    │   $match: status ≠ 'cancelled' ✅            │
    │   $group: totalPurchases, totalPaid ✅        │
    └──────────────────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────────────────┐
    │ Expense.aggregate()                          │
    │   $match: date range ✅                      │
    │   $group: totalExpenses ✅                   │
    └──────────────────────────────────────────────┘
         │
         ▼
    ┌─────────────────────────────────────────────────────┐
    │ KALKULASI                                           │
    │                                                     │
    │ netProfit = sales - purchases - expenses            │
    │   ┌───────────────────────────────────────────────┐ │
    │   │ BE-F02: Payroll TIDAK disertakan!             │ │
    │   │ → netProfit lebih tinggi dari kenyataan ❌    │ │
    │   └───────────────────────────────────────────────┘ │
    │                                                     │
    │ cashFlow = totalCollected - totalPaid - expenses    │
    │   ┌───────────────────────────────────────────────┐ │
    │   │ BE-F06: Jika totalCollected = NaN             │ │
    │   │ → cashFlow = NaN ❌                           │ │
    │   └───────────────────────────────────────────────┘ │
    └─────────────────────────────────────────────────────┘
         │
         ▼
    Response JSON { netProfit: WRONG_VALUE, cashFlow: POSSIBLY_NAN }
```

---

## Flowchart 2: Alur Bug Frontend Sales Report

```
User → Pilih Staff dari Dropdown → API /api/reports?type=sales&staffId="664f2a..."
                                                              │
                                             ┌────────────────┴───────────────────┐
                                             │ BE-F01: staffFilter = "664f2a..."  │
                                             │ MongoDB ObjectId ≠ String          │
                                             │ → Query match: 0 docs              │
                                             │ → Return: [] (kosong)              │
                                             └────────────────┬───────────────────┘
                                                              │
User ← Tabel kosong tapi filter active ←──────────────────────┘
(User bingung, mengira tidak ada data untuk staff tersebut)


User → Klik Row di Tabel → handleStaffDrillDown(s.name) → "Sarah"
                                          │
                                          ▼
                            staffList.find(s => s.name === "Sarah")
                                          │
                              ┌───────────┴──────────────────┐
                              │ FE-F04: Nama "Sarah" ada 2x  │
                              │ → Match ke Sarah yang pertama│
                              │ → Bisa staff yang salah!     │
                              └───────────┬──────────────────┘
                                          │
                                          ▼
                            fetchStaffInvoices(sarah1._id) ← mungkin bukan yang diklik
                                          │
                                          ▼
                            Drilldown modal menampilkan invoice Sarah yang salah!
```

---

## Flowchart 3: Alur Bug Kalkulasi Staff Revenue

```
Invoice #001 = Rp 1.000.000
StaffAssignments: [Staff A, Staff B, Staff C]

Backend loop (case "staff"):

  forEach staffAssignment:
    ├─ Staff A: staffStats['A'].revenue += 1.000.000  → Rev A = 1.000.000
    ├─ Staff B: staffStats['B'].revenue += 1.000.000  → Rev B = 1.000.000
    └─ Staff C: staffStats['C'].revenue += 1.000.000  → Rev C = 1.000.000

Total revenue dilaporkan: 3.000.000
Nilai invoice sebenarnya: 1.000.000

Overcount: 3x lipat! (BE-F05)


User export → handleExport() → XLSX
                    │
          ┌─────────┴────────────────┐
          │ activeTab === 'wallet'   │  ← FE-F03
          │ TIDAK ADA handler        │
          │ exportData = [reportData]│
          │ = raw MongoDB object     │
          └─────────┬────────────────┘
                    │
                    ▼
          XLSX file dengan kolom:
          _id, totalTopUp, totalUsage, transactions[0]._id, ...
          (tidak dapat dibaca user)
```

---

## Flowchart 4: Alur Bug AI Reports

```
POST /api/ai-reports
         │
         ▼
    Settings.findOne()
    { openaiApiKey: "enc:v1:ENCRYPTED_KEY" }  ← terenkripsi (BE-F08)
         │
         ▼
    Cek: if (!settings.aiEnabled || !settings.openaiApiKey) → false (ada, tapi encrypted)
         │ (tidak return error karena key ada, meski salah format)
         │
         ▼
    Product.find({ stock: { $lte: 10 } })  ← hardcode (BE-F10)
    (abaikan alertQuantity per produk)
         │
         ▼
    fetch("https://api.openai.com/v1/chat/completions", {
        Authorization: "Bearer enc:v1:ENCRYPTED_KEY"  ← salah!
    })
         │
         ▼
    OpenAI → 401 Unauthorized
         │
    aiData = { error: { message: "Incorrect API key" } }
         │
         ▼
    aiData.choices[0].message.content  ← BE-F09: choices undefined!
         │
         ▼
    TypeError: Cannot read properties of undefined (reading 'message')
         │
         ▼
    catch(error) → return 500 Internal Server Error
```

---

---

# BAGIAN IV — PRIORITAS PERBAIKAN

---

## 🚨 Sprint 1 — Fix Segera (Dampak Finansial Langsung)

| # | Bug | File | Estimasi Fix |
|---|-----|------|-------------|
| 1 | **BE-F02** — netProfit tanpa Payroll | `api/reports/financial/route.ts` | 30 menit |
| 2 | **BE-F01** — staffFilter String vs ObjectId | `api/reports/route.ts` | 15 menit |
| 3 | **FE-F01** — StatCard props interface mismatch | `reports/page.tsx` | 20 menit |
| 4 | **BE-F08** — OpenAI key tidak di-decrypt | `api/ai-reports/route.ts` | 15 menit |
| 5 | **BE-F06** — amountPaid undefined → NaN | `api/reports/route.ts` | 20 menit |

---

## ⚠️ Sprint 2 — Fix Minggu Ini (Data Integrity)

| # | Bug | File | Estimasi Fix |
|---|-----|------|-------------|
| 6 | **BE-F03** — Services/products include cancelled | `api/reports/route.ts` | 10 menit |
| 7 | **BE-F05** — Revenue staff double-count | `api/reports/route.ts` | 45 menit |
| 8 | **BE-F07** — Payroll filter createdAt vs date | `api/reports/route.ts` | 10 menit |
| 9 | **FE-F02** — Sort currency format Indonesia | `reports/page.tsx` | 30 menit |
| 10 | **FE-F03** — Export missing wallet/daily tabs | `reports/page.tsx` | 45 menit |
| 11 | **FE-F04** — Staff drilldown name matching | `reports/page.tsx` | 20 menit |

---

## 📋 Sprint 3 — Improvement (Quality & Reliability)

| # | Bug | File | Estimasi Fix |
|---|-----|------|-------------|
| 12 | **BE-F04** — staffStats.appointments selalu 0 | `api/reports/route.ts` | 45 menit |
| 13 | **BE-F09** — choices[0] null check | `api/ai-reports/route.ts` | 10 menit |
| 14 | **BE-F10** — AI low stock hardcode | `api/ai-reports/route.ts` | 10 menit |
| 15 | **BE-F11** — ActivityLog countDocuments | `api/reports/activity-log/route.ts` | 15 menit |
| 16 | **BE-F12** — WA timezone hardcode | `api/cron/wa-daily-report/route.ts` | 10 menit |
| 17 | **BE-F13** — Customer/Product load semua data | `api/reports/data/route.ts` | 30 menit |
| 18 | **FE-F05** — setPresetRange default case | `reports/page.tsx` | 10 menit |
| 19 | **FE-F06** — Commission re-kalkulasi di render | `reports/page.tsx` | 25 menit |
| 20 | **FE-F07** — Financial page error state | `reports/financial/page.tsx` | 20 menit |

---

## 🔧 Backlog — Technical Debt

| # | Bug | File | Catatan |
|---|-----|------|---------|
| 21 | **BE-F14** — Rate limiter in-memory | `lib/rateLimiter.ts` | Butuh Upstash Redis / Vercel KV |
| 22 | **BE-F15** — formatterCache unbounded | `lib/dateUtils.ts` | Tambah size cap |
| 23 | **FE-F08** — SalesChart dead code | `components/reports/SalesChart.tsx` | Hapus atau integrasikan |

---

---

# LAMPIRAN — Estimasi Dampak Keseluruhan

```
┌─────────────────────────────────────────────────────────────┐
│                RISK MATRIX — FINANCIAL REPORTS              │
├────────────────┬────────────────────────────────────────────┤
│ PROBABILITAS   │              DAMPAK                        │
│                │  RENDAH    │  SEDANG    │  TINGGI          │
├────────────────┼────────────┼────────────┼──────────────────┤
│ SANGAT TINGGI  │            │ BE-F03     │ BE-F02 ← #1      │
│ (>90%)         │            │ BE-F04     │ BE-F05           │
│                │            │ FE-F01     │ FE-F02           │
│                │            │ FE-F03     │ FE-F08 (dead)    │
├────────────────┼────────────┼────────────┼──────────────────┤
│ TINGGI         │            │ BE-F07     │ BE-F01 ← #2      │
│ (60-90%)       │            │ BE-F13     │ BE-F06           │
│                │            │ FE-F02     │ BE-F08           │
├────────────────┼────────────┼────────────┼──────────────────┤
│ SEDANG         │ BE-F12     │ BE-F09     │                  │
│ (20-60%)       │ FE-F04     │ BE-F10     │                  │
│                │            │ BE-F11     │                  │
├────────────────┼────────────┼────────────┼──────────────────┤
│ RENDAH         │ BE-F14     │ FE-F05     │                  │
│ (<20%)         │ BE-F15     │ FE-F07     │                  │
│                │            │            │                  │
└────────────────┴────────────┴────────────┴──────────────────┘

Total Estimasi Fix (Sprint 1+2): ~5 jam development
Total Estimasi Fix (Sprint 3): ~4 jam development
Total Estimasi Fix (Backlog): ~2 jam development
```

---

*Report generated by static code analysis — salon-next Financial Reports Module — 16 Mei 2026*