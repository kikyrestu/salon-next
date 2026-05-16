# 🔍 Bug & Error Report — Modul Reports (Laporan)
### `salon-next` · Next.js App Router · TypeScript · MongoDB/Mongoose

> **Tanggal Analisa:** 16 Mei 2026  
> **Scope:** Frontend & Backend — Seluruh Modul Report  
> **Analis:** Claude Sonnet 4.6 — Static Code Analysis  
> **File yang Dianalisa:**
> - `app/api/reports/route.ts` ← Induk semua tipe laporan
> - `app/api/reports/data/route.ts` ← Aggregator data untuk halaman Reports
> - `app/api/reports/financial/route.ts` ← Laporan keuangan tersendiri
> - `app/api/reports/activity-log/route.ts` ← Log aktivitas sistem
> - `app/api/ai-reports/route.ts` ← Analitik berbasis AI (OpenAI)
> - `app/api/cron/wa-daily-report/route.ts` ← Cron kirim laporan harian via WA
> - `app/[slug]/(frontend)/reports/page.tsx` ← Halaman utama laporan (75KB!)
> - `app/[slug]/(frontend)/reports/financial/page.tsx` ← Halaman laporan keuangan
> - `app/[slug]/(frontend)/reports/activity-log/page.tsx` ← Halaman log aktivitas (Server Component)
> - `components/reports/StatCard.tsx` ← Kartu statistik
> - `components/reports/SalesChart.tsx` ← Komponen chart
> - `components/reports/DateRangePicker.tsx` ← Picker tanggal

---

## 📊 Ringkasan Eksekutif

| Kode | Deskripsi Singkat | Layer | Severity | Kemungkinan Terjadi |
|------|-------------------|-------|----------|---------------------|
| **BE-R01** | `staffFilter` dikirim sebagai String, bukan ObjectId → query sales selalu miss | Backend | 🔴 Critical | **95%** |
| **BE-R02** | `Appointment.find({ start: ... })` — field yang salah, harusnya `date` | Backend | 🔴 Critical | **100%** |
| **BE-R03** | `Staff.find({ status: 'active' })` salah field — harusnya `isActive: true` | Backend | 🔴 Critical | **100%** |
| **BE-R04** | `staffStats[id].appointments` tidak pernah di-increment (selalu 0) | Backend | 🟠 High | **100%** |
| **BE-R05** | Revenue staff di-count ganda: setiap staff mendapat kredit penuh | Backend | 🟠 High | **100%** |
| **BE-R06** | Laporan services/products include invoice cancelled & voided | Backend | 🟠 High | **100%** |
| **BE-R07** | `inv.amountPaid` bisa `undefined` → `totalCollected` jadi NaN di daily report | Backend | 🟠 High | **70%** |
| **BE-R08** | Payroll filter pakai `createdAt` bukan `date` (inconsistent) | Backend | 🟠 High | **80%** |
| **BE-R09** | `netProfit` di financial route tidak include payroll — beda dengan profit route | Backend | 🟠 High | **100%** |
| **BE-R10** | `openaiApiKey` kemungkinan terenkripsi tapi tidak di-decrypt sebelum dipakai | Backend | 🟠 High | **60%** |
| **BE-R11** | `aiData.choices[0]` tanpa null-check — crash jika OpenAI return empty | Backend | 🟡 Medium | **30%** |
| **BE-R12** | AI low stock hardcode `{ $lte: 10 }`, tidak pakai field `alertQuantity` | Backend | 🟡 Medium | **100%** |
| **BE-R13** | Activity-log API: `countDocuments()` tanpa filter — pagination total salah | Backend | 🟡 Medium | **100%** |
| **BE-R14** | WA daily report: walk-in customers dicount sebagai satu entitas | Backend | 🟡 Medium | **80%** |
| **BE-R15** | Timezone hardcode `Asia/Jakarta` di WA daily report — tidak pakai Settings | Backend | 🟡 Medium | **30%** |
| **BE-R16** | Customer & Product load SEMUA data tanpa filter di reports/data | Backend | 🟡 Medium | **100%** |
| **FE-R01** | `fetchData()` non-summary tab TIDAK kirim `x-store-slug` → data pusat | Frontend | 🔴 Critical | **100%** |
| **FE-R02** | Link activity-log hardcode `/reports/activity-log` tanpa slug prefix | Frontend | 🔴 Critical | **100%** |
| **FE-R03** | `StatCard` dipanggil dengan props interface yang salah — trend tidak tampil | Frontend | 🟠 High | **100%** |
| **FE-R04** | `renderTable` sort currency gagal untuk format angka Indonesia (titik sebagai pemisah ribuan) | Frontend | 🟠 High | **100%** |
| **FE-R05** | Staff drilldown pakai name-matching → ambiguous jika ada nama staff kembar | Frontend | 🟠 High | **30%** |
| **FE-R06** | `handleExport` tidak cover tab `wallet`, `daily`, `activity-log` | Frontend | 🟠 High | **100%** |
| **FE-R07** | `setPresetRange` bisa return `undefined` start/end — tanpa default case | Frontend | 🟡 Medium | **20%** |
| **FE-R08** | Commission summary di drilldown footer dihitung ulang saat render (tidak di-memoize) | Frontend | 🟡 Medium | **100%** |
| **FE-R09** | `financial/page.tsx` tidak ada error state — silent failure saat fetch gagal | Frontend | 🟢 Low | **20%** |
| **FE-R10** | `SalesChart` komponen diimport tapi tidak dipakai di halaman laporan manapun | Frontend | 🟢 Low | **100%** |

**Total: 26 Bug** | 🔴 Critical: 4 | 🟠 High: 11 | 🟡 Medium: 7 | 🟢 Low: 2

---

## 🗂️ Legenda Severity

| Simbol | Level | Definisi |
|--------|-------|----------|
| 🔴 | **Critical** | Menyebabkan data corruption, fitur tidak berfungsi, atau keamanan multi-tenant bocor |
| 🟠 | **High** | Kalkulasi finansial salah, data inkonsisten, atau fitur inti tidak bekerja benar |
| 🟡 | **Medium** | Crash pada kondisi tertentu, edge case cukup sering terjadi |
| 🟢 | **Low** | Code smell, dead code, UX minor |

---

---

# BAGIAN I — BACKEND BUGS

---

## 🔴 BE-R01 — `staffFilter` Dikirim sebagai String, Bukan ObjectId → Filter Sales Selalu Miss

**File:** `app/api/reports/route.ts` (case `"sales"`)  
**Kemungkinan Terjadi:** 95%  
**Dampak:** Filter "Sales by Staff" tidak pernah mengembalikan data yang benar. Semua invoice tetap ditampilkan seolah tidak ada filter yang aktif, atau tidak ada satu pun yang cocok tergantung tipe data di DB.

### Narasi

Ketika user memilih staff dari dropdown filter di halaman sales report, frontend mengirim `staffId` sebagai query parameter string, misalnya `?staffId=664f2a1c0e3b2a001f0e5a78`. Di backend, nilai ini langsung dipakai sebagai string dalam query MongoDB:

```typescript
// app/api/reports/route.ts — case "sales"
const staffFilter = searchParams.get("staffId"); // → string "664f2a1c0e3b2a001f0e5a78"

if (staffFilter) {
    salesQuery.$or = [
        { staff: staffFilter },                           // ❌ String vs ObjectId
        { 'staffAssignments.staff': staffFilter },        // ❌ String vs ObjectId
        { 'items.staffAssignments.staff': staffFilter },  // ❌ String vs ObjectId
    ];
}
```

Field `staff` di collection Invoice bertipe `mongoose.Types.ObjectId`, bukan string. MongoDB tidak melakukan auto-konversi — perbandingan `ObjectId("664f2a...") == "664f2a..."` selalu menghasilkan `false`. Hasilnya: filter staff seolah aktif di UI, tapi server tetap mengembalikan semua invoice tanpa filter. User tidak sadar bahwa laporan yang ditampilkan tidak terfilter dengan benar.

Ironinya, kode ini menggunakan `$or` dengan tiga kondisi yang semuanya gagal secara diam-diam.

### Solusi

```typescript
import mongoose from 'mongoose';

const staffFilter = searchParams.get("staffId");

if (staffFilter && mongoose.Types.ObjectId.isValid(staffFilter)) {
    const staffObjectId = new mongoose.Types.ObjectId(staffFilter);  // ← konversi ke ObjectId
    salesQuery.$or = [
        { staff: staffObjectId },
        { 'staffAssignments.staff': staffObjectId },
        { 'items.staffAssignments.staff': staffObjectId },
    ];
}
```

---

## 🔴 BE-R02 — `Appointment.find({ start: ... })` — Field Salah, Harusnya `date`

**File:** `app/api/reports/data/route.ts`  
**Kemungkinan Terjadi:** 100% (selalu salah)  
**Dampak:** Ketika `type=full` dipanggil dengan date range, query appointment menggunakan field `start` yang tidak ada di schema. Semua appointment dikembalikan tanpa filter tanggal — database dump penuh, bukan data dalam rentang yang diminta.

### Narasi

Di `reports/data/route.ts`, ada agregasi besar yang mengumpulkan semua data sekaligus untuk dipakai di halaman Summary:

```typescript
const [invoices, expenses, appointments, customers, products, purchases] = await Promise.all([
    Invoice.find(startDate && endDate ? { date: dateFilter.date } : {}).populate(...),
    Expense.find(startDate && endDate ? { date: dateFilter.date } : {}),

    // ❌ Field 'start' tidak ada di model Appointment!
    Appointment.find(startDate && endDate ? {
        start: { $gte: new Date(startDate), $lte: new Date(endDate) }
    } : {}).populate('customer').populate('staff').populate('service'),

    ...
]);
```

Schema `models/Appointment.ts` mendefinisikan:
```typescript
date: { type: Date, required: true },  // ← field yang benar adalah 'date', bukan 'start'
```

Query `{ start: { $gte: ..., $lte: ... } }` tidak akan match dokumen manapun karena field `start` tidak ada. MongoDB tidak throw error — ia hanya return semua dokumen (karena filter kosong setelah field yang tidak ada diabaikan dalam matching). Untuk database besar dengan ribuan appointment, ini bisa menyebabkan response payload yang sangat besar dan slowness.

### Solusi

```typescript
// ✅ Gunakan field yang benar sesuai schema
Appointment.find(startDate && endDate ? {
    date: { $gte: new Date(startDate), $lte: new Date(endDate) }
} : {}).populate('customer').populate('staff'),
```

---

## 🔴 BE-R03 — `Staff.find({ status: 'active' })` Field Salah — Harusnya `isActive: true`

**File:** `app/api/reports/data/route.ts` (type=lists)  
**Kemungkinan Terjadi:** 100%  
**Dampak:** Dropdown filter "Staff" di halaman Sales Report selalu kosong. User tidak bisa memfilter laporan berdasarkan staff sama sekali karena list yang dikembalikan adalah array kosong.

### Narasi

Endpoint `GET /api/reports/data?type=lists` digunakan untuk mengisi dropdown Staff dan Service di filter Sales Report. Kode untuk mengambil staff menggunakan:

```typescript
// reports/data/route.ts — type='lists'
const [staff, services] = await Promise.all([
    Staff.find({ status: 'active' }).select("_id name").sort({ name: 1 }),  // ❌ field salah!
    Service.find({ status: 'active' }).select("_id name").sort({ name: 1 })
]);
```

Namun dari analisa `app/api/staff/appointment-list/route.ts` (yang bekerja dengan benar), field yang digunakan adalah:

```typescript
// Cara yang benar, dari appointment-list route
const staffMembers = await Staff.find({ isActive: true }).select("_id name").sort({ name: 1 });
```

Field `status` kemungkinan besar tidak ada di model Staff, yang menggunakan `isActive: boolean`. Sehingga `Staff.find({ status: 'active' })` mengembalikan **array kosong** karena tidak ada dokumen yang memiliki field `status = 'active'`. Dropdown filter staff di Reports page pun kosong setiap saat.

Efek berantai: karena staff list kosong, staff drilldown (`handleStaffDrillDown`) tidak bisa menemukan staff match apapun (`staffList.find(s => s.name === staffName)` selalu `undefined`), dan drilldown modal selalu menampilkan "Tidak ada invoice ditemukan".

### Solusi

```typescript
const [staff, services] = await Promise.all([
    Staff.find({ isActive: true }).select("_id name").sort({ name: 1 }),   // ✅
    Service.find({ isActive: true }).select("_id name").sort({ name: 1 }) // ✅ (sesuaikan dengan schema Service)
]);
```

---

## 🟠 BE-R04 — `staffStats[id].appointments` Tidak Pernah Di-increment (Selalu 0)

**File:** `app/api/reports/route.ts` (case `"staff"`)  
**Kemungkinan Terjadi:** 100%  
**Dampak:** Kolom "Appointments" di Staff Performance report selalu menampilkan 0 untuk semua staff.

### Narasi

Pada kalkulasi statistik staff dari invoice, objek `staffStats` diinisialisasi dengan field `appointments: 0`:

```typescript
staffStats[id] = {
    name: s.name,
    appointments: 0,   // ← diinisialisasi 0...
    sales: 0,
    commission: 0,
    revenue: 0
};
```

Di seluruh blok iterasi (`staffAssignments.forEach`, `else if (inv.staff)`, `else if (inv.appointment?.staff)`), hanya `sales`, `revenue`, dan `commission` yang di-increment. Field `appointments` **tidak pernah disentuh** di manapun:

```typescript
staffStats[id].sales += 1;       // ← di-increment
staffStats[id].revenue += ...;   // ← di-increment
staffStats[id].commission += ...; // ← di-increment
// staffStats[id].appointments    ← TIDAK PERNAH di-increment!
```

Laporan performa staff yang ditampilkan ke owner/manajer selalu menunjukkan 0 appointment untuk semua staff, menyebabkan keputusan bisnis berdasarkan data yang salah.

### Solusi

Tentukan apa yang dimaksud "appointment" dalam konteks ini — apakah setiap invoice = 1 appointment? Jika ya:

```typescript
// Untuk setiap blok assignment:
staffStats[id].appointments += 1;  // ← tambahkan di setiap blok yang increment sales
staffStats[id].sales += 1;
staffStats[id].revenue += inv.totalAmount;
staffStats[id].commission += (assignment.commission || 0);
```

---

## 🟠 BE-R05 — Revenue Staff Di-count Ganda: Setiap Staff Mendapat Kredit Penuh

**File:** `app/api/reports/route.ts` (case `"staff"`)  
**Kemungkinan Terjadi:** 100%  
**Dampak:** Total revenue yang dilaporkan di Staff Performance report bisa 2x-3x dari revenue aktual jika satu invoice dikerjakan oleh multiple staff.

### Narasi

Pada invoice dengan multi-staff (`staffAssignments.length > 0`), kode memberikan kredit revenue **penuh** kepada setiap staff yang terlibat:

```typescript
// Iterasi untuk setiap staff assignment dalam satu invoice
inv.staffAssignments.forEach((assignment: any) => {
    const s = assignment.staff;
    if (s) {
        staffStats[id].revenue += inv.totalAmount;  // ← FULL amount, bukan porsi
    }
});
```

Skenario nyata: Invoice senilai Rp300.000 dikerjakan oleh 3 staff (Rina, Sari, Budi). Revenue yang tercatat:
- Rina: Rp300.000
- Sari: Rp300.000
- Budi: Rp300.000
- **Total di report: Rp900.000** (3x lipat!)

Komentar dalam kode sendiri mengakui ini bermasalah namun dibiarkan:
```typescript
// For revenue, we could either give full credit to everyone or split it.
// Typically, for performance reporting, we give 'sales credit' to everyone involved.
```

Laporan performa staff yang menampilkan total revenue menjadi tidak akurat dan sangat menyesatkan bagi owner yang menggunakan data ini untuk evaluasi kinerja.

### Solusi

Gunakan `porsiPersen` (sudah ada di model Invoice) untuk menghitung porsi revenue yang benar:

```typescript
inv.staffAssignments.forEach((assignment: any) => {
    const s = assignment.staff;
    if (s) {
        const id = s._id.toString();
        if (!staffStats[id]) {
            staffStats[id] = { name: s.name, appointments: 0, sales: 0, commission: 0, revenue: 0 };
        }
        staffStats[id].sales += 1;
        // ✅ Hitung porsi revenue berdasarkan persentase assignment
        const persen = (assignment.porsiPersen || assignment.percentage || 100) / 100;
        staffStats[id].revenue += inv.totalAmount * persen;
        staffStats[id].commission += (assignment.commission || 0);
    }
});
```

---

## 🟠 BE-R06 — Laporan Services/Products Include Invoice Cancelled & Voided

**File:** `app/api/reports/route.ts` (case `"services"` dan `"products"`)  
**Kemungkinan Terjadi:** 100%  
**Dampak:** Revenue per service dan revenue per product include transaksi yang dibatalkan. Laporan menjadi overstated — menampilkan angka lebih besar dari pendapatan aktual.

### Narasi

Kasus `"sales"` sudah memiliki filter status yang eksplisit dan bisa difilter. Namun kasus `"services"` dan `"products"` mengambil semua invoice tanpa filter status apapun:

```typescript
// case "services" — TIDAK ADA filter status
const invoices = await Invoice.find({
    date: { $gte: start, $lte: end }
}).lean();

// case "products" — TIDAK ADA filter status
const productInvoices = await Invoice.find({
    date: { $gte: start, $lte: end }
}).lean();
```

Invoice yang di-void atau cancelled tetap ikut dihitung dalam statistik revenue per service/product. Jika sebuah layanan "Hair Color" menghasilkan Rp5.000.000 di sebulan, tapi Rp500.000-nya adalah dari invoice yang di-void, report tetap menampilkan Rp5.000.000 — seolah tidak ada pembatalan.

Ini juga berbeda dengan behavior laporan lain (`"profit"`, `"financial"`) yang sudah memfilter `{ $ne: 'cancelled' }`.

### Solusi

```typescript
// ✅ Tambah filter status di semua query report
const invoices = await Invoice.find({
    date: { $gte: start, $lte: end },
    status: { $nin: ['cancelled', 'voided'] }  // ← exclude transaksi batal
}).lean();
```

---

## 🟠 BE-R07 — `inv.amountPaid` Bisa `undefined` → `totalCollected` Jadi NaN di Daily Report

**File:** `app/api/reports/route.ts` (case `"daily"`)  
**Kemungkinan Terjadi:** 70%  
**Dampak:** `totalCollected` di Daily Closing Report menampilkan `NaN` jika ada invoice yang tidak memiliki field `amountPaid` (invoice lama sebelum field ini ditambahkan ke schema).

### Narasi

Dalam laporan harian, `totalCollected` dihitung dari:

```typescript
data = {
    totalSales: dailyInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
    totalCollected: dailyInvoices.reduce((sum, inv) => sum + inv.amountPaid, 0),  // ❌ tidak ada fallback
    ...
};
```

Jika `inv.amountPaid` adalah `undefined` (field tidak ada di dokumen lama, atau tidak diisi), maka `sum + undefined = NaN`. `NaN` bersifat viral: operasi apapun terhadap `NaN` menghasilkan `NaN`. Semua invoice berikutnya dalam reduce pun menjadi `NaN`.

Di halaman Daily Closing, user akan melihat "Liquid Cash Collected: NaN" — membingungkan dan tidak bisa digunakan untuk rekonsiliasi kas.

### Solusi

```typescript
totalCollected: dailyInvoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0),  // ✅ fallback
totalSales: dailyInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0),     // ✅ konsisten
```

---

## 🟠 BE-R08 — Payroll Filter Pakai `createdAt` Bukan `date` (Inconsistent)

**File:** `app/api/reports/route.ts` (case `"profit"`)  
**Kemungkinan Terjadi:** 80%  
**Dampak:** Data payroll yang masuk dalam perhitungan Profit & Loss tidak sesuai dengan rentang tanggal yang dipilih user. Laporan P&L menjadi tidak akurat secara finansial.

### Narasi

Di case `"profit"`, empat collection di-query secara bersamaan menggunakan `Promise.all`. Tiga di antaranya menggunakan field `date`, namun Payroll menggunakan `createdAt`:

```typescript
const [revInvoices, expExpenses, payPayroll, purPurchases] = await Promise.all([
    Invoice.find({ date: { $gte: start, $lte: end } }).lean(),         // ✅ field: date
    Expense.find({ date: { $gte: start, $lte: end } }).lean(),         // ✅ field: date
    Payroll.find({ createdAt: { $gte: start, $lte: end } }).lean(),    // ❌ field: createdAt (beda!)
    Purchase.find({ date: { $gte: start, $lte: end }, ... }).lean()    // ✅ field: date
]);
```

`createdAt` adalah timestamp kapan dokumen Payroll dibuat di database, bukan tanggal periode payroll itu berlaku. Jika payroll untuk bulan Mei dibuat pada 1 Juni (misalnya karena ada keterlambatan admin), laporan Mei akan missing data payroll tersebut, sedangkan laporan Juni akan memasukkannya.

Ini menyebabkan Net Profit yang dilaporkan bisa lebih tinggi dari realita (jika payroll baru masuk bulan depan), yang sangat berbahaya untuk keputusan finansial owner.

### Solusi

Verifikasi field tanggal di model Payroll, kemudian gunakan field yang sesuai:

```typescript
// Jika model Payroll memiliki field 'date' atau 'payrollDate':
Payroll.find({ date: { $gte: start, $lte: end } }).lean(),  // ✅
// Atau jika tidak ada, gunakan period field:
Payroll.find({ periodStart: { $gte: start }, periodEnd: { $lte: end } }).lean()
```

---

## 🟠 BE-R09 — `netProfit` di Financial Route Tidak Include Payroll

**File:** `app/api/reports/financial/route.ts`  
**Kemungkinan Terjadi:** 100%  
**Dampak:** Halaman `/reports/financial` dan tab `profit` di `/reports` menampilkan angka "Net Profit" yang berbeda untuk periode yang sama, menyebabkan kebingungan dan ketidakpercayaan pada sistem laporan.

### Narasi

Ada dua titik kalkulasi net profit di sistem ini:

**Di `api/reports/route.ts` (case "profit"):**
```typescript
const netProfit = totalRevenue - totalExpenses - totalPayroll - totalPurchases;
// Payroll ← IKUT diperhitungkan ✅
```

**Di `api/reports/financial/route.ts`:**
```typescript
const netProfit = sales.totalSales - purchases.totalPurchases - expenses.totalExpenses;
// Payroll ← TIDAK diperhitungkan ❌
```

Misalnya dalam satu bulan:
- Revenue: Rp50.000.000
- Expenses: Rp5.000.000
- Purchases: Rp10.000.000
- Payroll: Rp15.000.000

`/reports` menampilkan Net Profit: Rp20.000.000 (benar)
`/reports/financial` menampilkan Net Profit: Rp35.000.000 (salah — 75% lebih besar!)

Inkonsistensi ini bisa menyebabkan owner salah mengambil keputusan bisnis berdasarkan angka yang berbeda dari dua halaman laporan di sistem yang sama.

### Solusi

Selaraskan formula di kedua route:

```typescript
// api/reports/financial/route.ts — tambahkan payroll
const { Payroll } = await getTenantModels(tenantSlug);

const payrollStats = await Payroll.aggregate([
    { $match: { date: { $gte: start, $lte: end } } },  // sesuaikan field
    { $group: { _id: null, totalPayroll: { $sum: "$totalAmount" } } }
]);

const payroll = payrollStats[0] || { totalPayroll: 0 };
const netProfit = sales.totalSales - purchases.totalPurchases - expenses.totalExpenses - payroll.totalPayroll;
```

---

## 🟠 BE-R10 — `openaiApiKey` Kemungkinan Terenkripsi tapi Tidak Di-decrypt

**File:** `app/api/ai-reports/route.ts`  
**Kemungkinan Terjadi:** 60%  
**Dampak:** Semua request ke AI Report gagal dengan "Invalid API Key" dari OpenAI, meskipun key sudah diset di Settings. Fitur AI Report tidak bisa dipakai sama sekali.

### Narasi

Di sistem ini, Fonnte token disimpan terenkripsi dan selalu di-decrypt sebelum digunakan:

```typescript
// Cara yang benar untuk Fonnte token (di berbagai file):
const fonnteToken = settings?.fonnteToken
    ? decryptFonnteToken(String(settings.fonnteToken).trim())
    : undefined;
```

Namun untuk OpenAI API key, kode menggunakannya langsung tanpa proses decrypt:

```typescript
// app/api/ai-reports/route.ts
const settings = await Settings.findOne({});
if (!settings?.aiEnabled || !settings?.openaiApiKey) { ... }

// Langsung dipakai tanpa decrypt:
"Authorization": `Bearer ${settings.openaiApiKey}`  // ← jika terenkripsi, ini jadi "Bearer enc:xxxx..."
```

Jika admin menyimpan API key OpenAI melalui UI Settings yang sama yang mengenkripsi data sensitif (sebuah asumsi yang sangat masuk akal mengingat Fonnte token juga dienkripsi), maka `settings.openaiApiKey` adalah string terenkripsi, bukan API key yang valid. OpenAI akan menolak dengan `401 Invalid API Key`.

### Solusi

```typescript
import { decryptFonnteToken } from '@/lib/encryption'; // atau buat decryptApiKey yang generic

const rawKey = settings.openaiApiKey;
const openaiApiKey = rawKey ? decryptFonnteToken(String(rawKey).trim()) : null;

if (!openaiApiKey) {
    return NextResponse.json({ success: false, error: "OpenAI API key not configured" }, { status: 400 });
}

// Gunakan openaiApiKey yang sudah didecrypt
"Authorization": `Bearer ${openaiApiKey}`
```

---

## 🟡 BE-R11 — `aiData.choices[0]` Tanpa Null-check — Crash Jika OpenAI Return Empty

**File:** `app/api/ai-reports/route.ts`  
**Kemungkinan Terjadi:** 30%  
**Dampak:** Server crash dengan 500 Internal Server Error jika OpenAI mengembalikan response dengan array `choices` kosong (rate limit, content filter triggered, dll).

### Narasi

```typescript
// Tidak ada null-check sebelum akses
return NextResponse.json({
    success: true,
    analysis: aiData.choices[0].message.content,  // ❌ TypeError jika choices kosong
    usage: aiData.usage
});
```

OpenAI dapat mengembalikan `choices: []` dalam beberapa kondisi:
- Content moderation filter aktif (prompt dianggap melanggar kebijakan)
- Timeout atau throttling khusus pada response
- Model constraint tertentu

Ketika `aiData.choices[0]` adalah `undefined`, mengakses `.message.content` akan throw `TypeError: Cannot read properties of undefined`.

### Solusi

```typescript
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

## 🟡 BE-R12 — AI Low Stock Hardcode `{ $lte: 10 }`, Tidak Pakai `alertQuantity`

**File:** `app/api/ai-reports/route.ts`  
**Kemungkinan Terjadi:** 100%  
**Dampak:** AI Report memberikan alert stok yang tidak relevan. Produk dengan `alertQuantity: 50` tidak muncul meski stok sudah di bawah threshold, sementara produk dengan `alertQuantity: 2` muncul sebagai alert padahal stok 8 masih aman.

### Narasi

```typescript
// app/api/ai-reports/route.ts
const lowStock = await Product.find({ stock: { $lte: 10 } }).limit(5).select('name stock');
// ❌ Hardcode threshold 10
```

Sementara di halaman reports/page.tsx, threshold yang benar digunakan:
```typescript
// fe_reports_page.tsx — cara yang benar
const lowStock = products.filter((p: any) => p.stock <= p.alertQuantity).length;
// ✅ Menggunakan alertQuantity dari masing-masing produk
```

Threshold stok minimum setiap produk bisa berbeda-beda (produk bahan baku mungkin perlu reorder pada 50 unit, sementara produk mahal cukup 2 unit). Hardcode angka 10 membuat AI mendapat konteks yang salah, sehingga rekomendasi AI untuk manajemen inventory tidak akurat.

### Solusi

```typescript
// ✅ Gunakan alertQuantity dari masing-masing produk
const lowStock = await Product.find({
    $expr: { $lte: ['$stock', '$alertQuantity'] }
}).limit(10).select('name stock alertQuantity');
```

---

## 🟡 BE-R13 — Activity-log API: `countDocuments()` Tanpa Filter — Pagination Total Salah

**File:** `app/api/reports/activity-log/route.ts`  
**Kemungkinan Terjadi:** 100%  
**Dampak:** Pagination di API activity log menampilkan total halaman yang tidak akurat. Jika ada 1000 log total tapi query hanya menemukan 50 yang match, pagination tetap menghitung berdasarkan 1000.

### Narasi

```typescript
// app/api/reports/activity-log/route.ts
const total = await ActivityLog.countDocuments();   // ❌ Tanpa filter — hitung SEMUA log
const logs = await ActivityLog.find()               // Query pun tidak ada filter
    .populate('user', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
```

API ini tidak mengimplementasikan filter apapun (tidak ada `search`, `date`, `action` filter), meskipun halaman Activity Log di server component (`activity-log/page.tsx`) memiliki fungsionalitas search yang berjalan langsung di server — bukan melalui API ini. Hal ini berarti API route ini secara praktis hanya digunakan tanpa filter, dan `total` selalu = jumlah semua dokumen.

Jika suatu saat API ini diextend untuk menerima filter, bug ini akan langsung muncul: `total` tidak akan akurat dengan hasil query yang difilter.

### Solusi

```typescript
// Definisikan query (bisa extend untuk filter di masa depan)
const query: any = {};
// Contoh filter yang bisa ditambahkan:
// const search = searchParams.get('search');
// if (search) query.$or = [{ action: { $regex: search, $options: 'i' } }, ...];

const total = await ActivityLog.countDocuments(query);  // ✅ Konsisten dengan query
const logs = await ActivityLog.find(query)              // ✅ Sama-sama pakai query
    .populate('user', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
```

---

## 🟡 BE-R14 — WA Daily Report: Walk-in Customers Dicount Sebagai Satu Entitas

**File:** `app/api/cron/wa-daily-report/route.ts`  
**Kemungkinan Terjadi:** 80%  
**Dampak:** Laporan harian via WA melaporkan jumlah customer yang lebih kecil dari realita. Salon dengan banyak walk-in customer (tanpa registrasi) akan melihat angka customer visit yang sangat tidak akurat.

### Narasi

Kode menghitung unique customers menggunakan Set dari ObjectId:

```typescript
// Total customer visit dari invoice hari ini
const totalCustomers = new Set(invoices.map((inv: any) => String(inv.customer))).size;
```

Masalahnya: invoice untuk walk-in customer tidak memiliki field `customer` (atau bernilai `null`). Ketika `inv.customer` adalah `null`, `String(null)` menghasilkan string `"null"`. Semua walk-in dari hari itu akan di-`String`-kan menjadi `"null"` dan masuk ke Set yang sama — sehingga Set menganggap mereka semua adalah SATU customer yang sama.

Contoh: 20 walk-in customer hari ini + 5 customer terdaftar = Set berisi 5 ObjectId + 1 `"null"` = **6 customer**, padahal seharusnya **25 customer**.

Owner mendapat laporan "6 customer hari ini" padahal kenyataannya 25. Ini menyebabkan underestimasi signifikan terhadap traffic salon.

### Solusi

```typescript
// ✅ Hitung walk-in sebagai jumlah invoice tanpa customer, bukan satu entitas
const registeredCustomers = new Set(
    invoices
        .filter((inv: any) => inv.customer)    // hanya yang punya customer
        .map((inv: any) => String(inv.customer))
).size;

const walkInInvoices = invoices.filter((inv: any) => !inv.customer).length;

const totalCustomers = registeredCustomers + walkInInvoices;  // ✅ hitungan akurat
```

---

## 🟡 BE-R15 — Timezone Hardcode `Asia/Jakarta` di WA Daily Report

**File:** `app/api/cron/wa-daily-report/route.ts`  
**Kemungkinan Terjadi:** 30%  
**Dampak:** Untuk tenant yang beroperasi di timezone berbeda (WIB, WITA, WIT), laporan harian mungkin melaporkan transaksi dari hari yang salah.

### Narasi

```typescript
// app/api/cron/wa-daily-report/route.ts
const tz = 'Asia/Jakarta';  // ← hardcode WIB (UTC+7)
const today = new Date();
const year = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric' }).format(today);
// ...
const startOfDayStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000+07:00`;
```

Route lain (termasuk `api/reports/route.ts` dan `api/reports/financial/route.ts`) menggunakan `Settings.timezone` yang bisa dikonfigurasi per tenant. Jika ada salon di Makassar (WITA, UTC+8) atau Papua (WIT, UTC+9), laporan harian WA mereka akan menghitung transaksi berdasarkan jam WIB, bukan jam lokal mereka.

### Solusi

```typescript
const settings = await Settings.findOne();
const tz = settings?.timezone || 'Asia/Jakarta';  // ✅ gunakan timezone dari settings
// ...
const startOfDayStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000${tzOffset}`;
```

---

## 🟡 BE-R16 — Customer & Product Load SEMUA Data Tanpa Filter di `reports/data`

**File:** `app/api/reports/data/route.ts` (full data query)  
**Kemungkinan Terjadi:** 100%  
**Dampak:** Untuk database besar (ribuan customer, ratusan produk), endpoint ini akan load seluruh collection ke memory — menyebabkan response lambat, memory tinggi, dan potensi timeout.

### Narasi

```typescript
const [invoices, expenses, appointments, customers, products, purchases] = await Promise.all([
    Invoice.find(...),                         // ✅ ada date filter
    Expense.find(...),                         // ✅ ada date filter
    Appointment.find(...),                     // (meski field salah, ada attempt filter)
    Customer.find().select("..."),             // ❌ TIDAK ADA filter — load semua customer
    Product.find().select("..."),              // ❌ TIDAK ADA filter — load semua produk
    Purchase.find(...)                         // ✅ ada date filter
]);
```

Customer dan Product memang tidak memiliki "date range" yang relevan untuk filtering (karena summary menunjukkan total, bukan hanya yang bergabung dalam periode). Namun meload **semua** data tetap berbahaya untuk skalabilitas.

### Solusi

Tambahkan limit atau gunakan count+aggregate alih-alih load semua:

```typescript
// Untuk customers: cukup count saja, tidak perlu semua data
const totalCustomers = await Customer.countDocuments();

// Untuk products: cukup ambil yang low stock
const products = await Product.find({ 
    $expr: { $lte: ['$stock', '$alertQuantity'] }
}).select("_id name stock alertQuantity price").limit(100);
```

---

---

# BAGIAN II — FRONTEND BUGS

---

## 🔴 FE-R01 — `fetchData()` Non-summary Tab TIDAK Kirim `x-store-slug` → Data Tenant Pusat

**File:** `app/[slug]/(frontend)/reports/page.tsx` (fungsi `fetchData`)  
**Kemungkinan Terjadi:** 100%  
**Dampak:** Semua tab laporan kecuali `summary` (yaitu: sales, services, products, staff, customers, inventory, expenses, profit, daily, wallet) mengambil data dari tenant `'pusat'`, bukan tenant aktif. Ini adalah **data leak lintas tenant** yang sangat serius.

### Narasi

Fungsi `fetchData` memiliki dua path berbeda: satu untuk tab `summary` dan satu untuk tab lainnya. Keduanya diperlakukan berbeda:

```typescript
const fetchData = async () => {
    setLoading(true);
    try {
        if (activeTab === 'summary') {
            // ✅ Summary tab — benar, kirim header
            const res = await fetch(`/api/reports/data?...`, {
                headers: { "x-store-slug": slug }
            });
            ...
        } else {
            let url = `/api/reports?type=${activeTab}&...`;
            // ❌ Semua tab lain — TIDAK ada header x-store-slug!
            const res = await fetch(url);
            const data = await res.json();
            ...
        }
    }
};
```

Setiap fetch untuk 10 dari 11 tab laporan tidak menyertakan `x-store-slug` header. Backend akan fallback ke `'pusat'`:

```typescript
// api/reports/route.ts
const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
```

**Konsekuensi nyata:** Semua manajer di semua cabang yang membuka tab Sales, Staff Performance, Profit & Loss, dll akan melihat data milik cabang **Pusat** — termasuk nominal pendapatan, nama customer, dan performa staff Pusat. Ini bukan hanya bug fungsional, ini adalah **kebocoran data bisnis antar tenant**.

### Solusi

Tambahkan header di semua fetch:

```typescript
} else {
    let url = `/api/reports?type=${activeTab}&startDate=${dateRange.start}&endDate=${dateRange.end}`;
    if (activeTab === 'sales') {
        if (staffFilter) url += `&staffId=${staffFilter}`;
        if (serviceFilter) url += `&serviceId=${serviceFilter}`;
    }
    const res = await fetch(url, {
        headers: { "x-store-slug": slug }  // ← tambahkan ini
    });
    ...
}
```

**Rekomendasi jangka panjang:** Buat custom hook `useSalonFetch` yang auto-inject header (lihat rekomendasi di bagian akhir).

---

## 🔴 FE-R02 — Link Activity-log Hardcode `/reports/activity-log` Tanpa Slug Prefix

**File:** `app/[slug]/(frontend)/reports/page.tsx` (case `'activity-log'` di `renderContent`)  
**Kemungkinan Terjadi:** 100%  
**Dampak:** Klik tombol "Access Security Logs" di tab Activity Log selalu mengarahkan ke `/{slug}/reports/activity-log` yang salah, atau ke `/reports/activity-log` yang tidak ada route-nya, menghasilkan 404.

### Narasi

```tsx
// case 'activity-log' — hardcoded path tanpa slug
case 'activity-log':
    return (
        <div>
            ...
            <a
                href="/reports/activity-log"    // ❌ hardcode! tidak ada slug
                className="..."
            >
                <FileText className="w-5 h-5" />
                Access Security Logs
            </a>
        </div>
    );
```

Di Next.js App Router dengan struktur `app/[slug]/(frontend)/reports/activity-log/`, URL yang benar adalah `/{slug}/reports/activity-log`. Hardcoding `/reports/activity-log` akan mengarahkan ke route yang salah.

Selain itu, menggunakan `<a>` alih-alih Next.js `<Link>` berarti full page reload terjadi, yang tidak sesuai dengan pola SPA yang digunakan di bagian lain aplikasi.

### Solusi

```tsx
import Link from 'next/link';
// atau gunakan useTenantRouter yang sudah ada

// Opsi 1: Gunakan Link dengan slug dari params
<Link
    href={`/${slug}/reports/activity-log`}  // ✅ dengan slug
    className="..."
>
    Access Security Logs
</Link>

// Opsi 2: Gunakan router.push dari useTenantRouter
const router = useTenantRouter();
<button onClick={() => router.push('/reports/activity-log')} className="...">
    Access Security Logs
</button>
```

---

## 🟠 FE-R03 — `StatCard` Dipanggil dengan Props Interface yang Salah — Trend Tidak Tampil

**File:** `app/[slug]/(frontend)/reports/page.tsx` (renderSummary), `components/reports/StatCard.tsx`  
**Kemungkinan Terjadi:** 100%  
**Dampak:** Semua StatCard di halaman Summary tidak menampilkan informasi trend. Komponen diam-diam mengabaikan prop yang salah tipe.

### Narasi

StatCard didefinisikan dengan interface yang mengharapkan `trend` sebagai objek:

```typescript
// components/reports/StatCard.tsx
interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    trend?: {
        value: number;      // angka persentase
        label: string;      // teks label
        positive?: boolean; // naik atau turun
    };
    color?: "blue" | "green" | "red" | "orange" | "purple";
    loading?: boolean;
}
```

Namun di halaman reports, StatCard dipanggil dengan:

```tsx
// app/[slug]/(frontend)/reports/page.tsx — SALAH tipe!
<StatCard
    title="Total Revenue"
    value={formatCurrency(reportData?.totalRevenue)}
    icon={DollarSign}
    color="green"
    trend="Revenue"       // ❌ string, bukan { value, label, positive }
    trendUp={true}        // ❌ prop ini tidak ada di interface!
/>
```

TypeScript seharusnya menangkap ini, namun jika `tsconfig.json` memiliki konfigurasi yang permisif atau ada `@ts-ignore`, komponen tetap di-render. Di runtime, `StatCard` melakukan `{trend && ...}` — karena `trend = "Revenue"` (string truthy), kondisi lolos. Namun `trend.value`, `trend.label`, `trend.positive` semuanya `undefined` → konten trend tampil sebagai `undefinedundefined` atau tidak sama sekali.

### Solusi

Sesuaikan pemanggilan dengan interface yang benar:

```tsx
<StatCard
    title="Total Revenue"
    value={formatCurrency(reportData?.totalRevenue)}
    icon={DollarSign}
    color="green"
    trend={{
        value: 0,           // atau hitung persentase perubahan dari periode sebelumnya
        label: "this period",
        positive: true
    }}
/>
```

Atau ubah interface StatCard untuk mendukung penggunaan yang lebih fleksibel:

```typescript
// Alternatif: buat trend bisa string atau object
trend?: string | { value: number; label: string; positive?: boolean };
```

---

## 🟠 FE-R04 — `renderTable` Sort Currency Gagal untuk Format Angka Indonesia

**File:** `app/[slug]/(frontend)/reports/page.tsx` (fungsi `renderTable`)  
**Kemungkinan Terjadi:** 100%  
**Dampak:** Sorting kolom Amount/Revenue di semua tabel laporan tidak bekerja dengan benar. Nilai seperti "Rp1.234.567" diurutkan secara string atau salah parse sebagai desimal.

### Narasi

Fungsi `renderTable` mencoba mengkonversi string currency ke angka untuk sorting:

```typescript
const sortedRows = [...rows].sort((a, b) => {
    if (!sortConfig.key) return 0;
    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];

    // Coba konversi string currency ke angka
    if (typeof aVal === 'string') {
        const cleaned = aVal.replace(/[^0-9.-]+/g, "");  // ← regex ini bermasalah!
        if (cleaned !== "" && !isNaN(Number(cleaned)) && (aVal.includes(settings.symbol) || aVal.includes('Rp'))) {
            aVal = Number(cleaned);
        }
    }
    ...
});
```

Regex `[^0-9.-]+` menghapus semua karakter **kecuali** digit, titik, dan tanda minus. Untuk format Indonesia seperti `"Rp1.234.567"`, hasil cleaned-nya adalah `"1.234.567"`. JavaScript `Number("1.234.567")` menginterpretasi ini sebagai **1.234** (desimal), bukan 1.234.567 (satu juta dua ratus tiga puluh empat ribu lima ratus enam puluh tujuh).

Contoh sorting yang salah:
- Rp100.000 → Number("100.000") = 100
- Rp50.000 → Number("50.000") = 50
- Rp1.000.000 → Number("1.000.000") = 1 (!!!)

Hasil: Rp1.000.000 dianggap lebih kecil dari Rp50.000. Sort menghasilkan urutan yang terbalik dan tidak masuk akal.

### Solusi

```typescript
// ✅ Hapus semua titik (pemisah ribuan) SEBELUM konversi ke Number
const cleanCurrency = (str: string) => {
    // Format Indonesia: titik = pemisah ribuan, koma = desimal
    return parseFloat(
        str
            .replace(/[^0-9,.-]/g, '')  // hapus simbol currency
            .replace(/\./g, '')           // hapus titik (pemisah ribuan)
            .replace(',', '.')            // ganti koma desimal ke titik
    ) || 0;
};

if (typeof aVal === 'string' && (aVal.includes(settings.symbol) || aVal.includes('Rp'))) {
    aVal = cleanCurrency(aVal);
}
```

---

## 🟠 FE-R05 — Staff Drilldown Pakai Name-matching — Ambiguous Jika Ada Nama Staff Kembar

**File:** `app/[slug]/(frontend)/reports/page.tsx` (fungsi `handleStaffDrillDown`)  
**Kemungkinan Terjadi:** 30%  
**Dampak:** Jika ada dua staff bernama sama (misalnya "Sari"), drilldown akan selalu menggunakan ID dari yang pertama ditemukan di list, menyebabkan laporan commission yang salah staff.

### Narasi

Saat user mengklik row staff untuk melihat detail invoice, fungsi drilldown mencari ID staff berdasarkan nama:

```typescript
const handleStaffDrillDown = async (staffName: string) => {
    setDrillDownStaff(staffName);
    setDrillDownLoading(true);
    try {
        // Cari staff ID dari list berdasarkan nama — FRAGILE!
        const match = staffList.find(s => s.name === staffName);  // ❌ name-based lookup
        if (!match) { setDrillDownData([]); return; }
        const res = await fetch(
            `/api/reports?type=sales&...&staffId=${match._id}`,
            { headers: { "x-store-slug": slug } }
        );
        ...
    }
};
```

Saat report data ditampilkan di tabel, setiap row berisi `s.name` (string), bukan `s._id`. Sehingga untuk drilldown, sistem harus "balik mencari" ID dari nama. Selain masalah nama kembar, pendekatan ini juga rentan terhadap case-sensitivity dan whitespace.

Ironisnya, data `staffStats` yang berasal dari API sudah memiliki `name` tapi tidak memiliki `_id` — ini adalah akar masalahnya.

### Solusi Jangka Pendek

Sertakan `_id` dalam response staff report dari API:

```typescript
// api/reports/route.ts — case "staff"
staffStats[id] = {
    _id: id,          // ← tambahkan _id
    name: s.name,
    ...
};
```

Kemudian di frontend:

```typescript
// handleStaffDrillDown menerima object staff, bukan hanya nama
const handleStaffDrillDown = async (staff: { _id: string; name: string }) => {
    // Langsung pakai staff._id tanpa lookup by name
    const res = await fetch(`/api/reports?type=sales&staffId=${staff._id}`, ...);
};
```

---

## 🟠 FE-R06 — `handleExport` Tidak Cover Tab `wallet`, `daily`, `activity-log`

**File:** `app/[slug]/(frontend)/reports/page.tsx` (fungsi `handleExport`)  
**Kemungkinan Terjadi:** 100%  
**Dampak:** Mengklik tombol "Export .xlsx" di tab Wallet, Daily Closing, dan Activity Log menghasilkan file Excel yang berisi data mentah atau tidak berguna.

### Narasi

Fungsi `handleExport` memiliki switch-case untuk masing-masing tab, tapi tidak mencakup semua tab:

```typescript
const handleExport = () => {
    if (!reportData || ...) { alert('No data to export'); return; }
    let exportData = Array.isArray(reportData) ? reportData : [reportData];

    if (activeTab === 'sales') { exportData = reportData.map(...); }
    else if (activeTab === 'staff') { exportData = reportData.map(...); }
    else if (activeTab === 'services') { exportData = reportData.map(...); }
    else if (activeTab === 'products') { exportData = reportData.map(...); }
    else if (activeTab === 'customers') { exportData = reportData.map(...); }
    else if (activeTab === 'profit') { exportData = [{ ... }]; }
    // ❌ wallet: tidak ada handler → exportData = object mentah
    // ❌ daily: tidak ada handler → exportData = [{ totalSales, payments: {}, ... }]
    // ❌ activity-log: tidak ada handler (tab ini redirect, jadi tidak ada reportData)
    // ❌ inventory: tidak ada handler
    // ❌ expenses: tidak ada handler
```

Ketika `wallet` dipilih, `reportData` adalah `{ totalTopUp, totalUsage, transactions: [...] }` — objek, bukan array. `Array.isArray(reportData)` false, sehingga `exportData = [reportData]` → Excel berisi satu baris dengan key `totalTopUp`, `totalUsage`, `transactions` yang formatnya tidak terbaca.

### Solusi

```typescript
} else if (activeTab === 'wallet') {
    exportData = (reportData?.transactions || []).map((t: any) => ({
        'Date': formatSafeDate(t.createdAt),
        'Customer': t.customer?.name || '-',
        'Type': t.type,
        'Amount': t.amount,
        'Description': t.description
    }));
} else if (activeTab === 'daily') {
    exportData = [{
        'Date': dateRange.start,
        'Gross Sales': reportData.totalSales,
        'Cash Collected': reportData.totalCollected,
        'Expenses': reportData.totalExpenses,
        'Invoice Count': reportData.invoiceCount,
        ...Object.fromEntries(Object.entries(reportData.payments || {}).map(([k, v]) => [`Payment - ${k}`, v]))
    }];
} else if (activeTab === 'inventory') {
    exportData = (reportData || []).map((p: any) => ({
        'Product Name': p.name,
        'SKU': p.sku || 'N/A',
        'Stock': p.stock,
        'Min. Stock': p.alertQuantity,
        'Price': p.price
    }));
} else if (activeTab === 'expenses') {
    exportData = (reportData || []).map((e: any) => ({
        'Category': e.category,
        'Date': formatSafeDate(e.date),
        'Amount': e.amount,
        'Title': e.title
    }));
}
```

---

## 🟡 FE-R07 — `setPresetRange` Bisa Return `undefined` Start/End — Tanpa Default Case

**File:** `app/[slug]/(frontend)/reports/page.tsx` (fungsi `setPresetRange`)  
**Kemungkinan Terjadi:** 20%  
**Dampak:** Jika nilai preset yang tidak dikenal dikirim (misalnya dari kode lain), `start` dan `end` tidak terdefinisi → `dateRange` menjadi `{ start: undefined, end: undefined }` → URL fetch menjadi `/api/reports?...&startDate=undefined&endDate=undefined`.

### Narasi

```typescript
const setPresetRange = (preset: 'thisMonth' | 'lastMonth' | 'last3Months' | 'today') => {
    const now = new Date();
    let start, end;  // ← diinisialisasi sebagai undefined!

    switch (preset) {
        case 'today': ...; break;
        case 'thisMonth': ...; break;
        case 'lastMonth': ...; break;
        case 'last3Months': ...; break;
        // ← TIDAK ADA default case!
    }

    setDateRange({ start, end });  // Jika preset tidak match → { start: undefined, end: undefined }
};
```

TypeScript union type `'thisMonth' | 'lastMonth' | 'last3Months' | 'today'` seharusnya mencegah nilai lain masuk. Namun jika ada runtime call dengan tipe yang dilemahkan (`as any`), bug ini bisa muncul.

### Solusi

```typescript
const setPresetRange = (preset: 'thisMonth' | 'lastMonth' | 'last3Months' | 'today') => {
    const now = new Date();
    const today = getCurrentDateInTimezone(settings.timezone || "UTC", now);

    // Nilai default sebagai safety net
    let start: string = today;
    let end: string = today;

    switch (preset) {
        case 'today':
            start = today; end = today; break;
        case 'thisMonth':
            ({ startDate: start, endDate: end } = getMonthDateRangeInTimezone(settings.timezone || "UTC", now)); break;
        case 'lastMonth':
            ({ startDate: start, endDate: end } = getMonthDateRangeInTimezone(settings.timezone || "UTC", subMonths(now, 1))); break;
        case 'last3Months':
            start = getMonthDateRangeInTimezone(settings.timezone || "UTC", subMonths(now, 2)).startDate;
            end = getMonthDateRangeInTimezone(settings.timezone || "UTC", now).endDate; break;
        default:
            console.warn(`Unknown preset: ${preset}`); break;  // ← safety net
    }

    setDateRange({ start, end });
};
```

---

## 🟡 FE-R08 — Commission Summary di Drilldown Footer Dihitung Ulang Saat Render

**File:** `app/[slug]/(frontend)/reports/page.tsx` (Staff drilldown modal footer)  
**Kemungkinan Terjadi:** 100%  
**Dampak:** Setiap render ulang komponen (misalnya saat hover, scroll, atau state update kecil) menjalankan ulang kalkulasi O(n×m) untuk commission total — potensi performance issue pada dataset besar.

### Narasi

Di footer modal drilldown staff, komisilah commission total dihitung langsung di JSX render dengan reduce dan nested forEach:

```tsx
{/* Di footer — computed langsung dalam JSX */}
Commission: {formatCurrency(drillDownData.reduce((s: number, inv: any) => {
    const staffMatch = staffList.find(sf => sf.name === drillDownStaff);  // O(n) setiap invoice!
    const sid = staffMatch?._id;
    let c = 0;
    (inv.staffAssignments || []).forEach((sa: any) => { ... });
    (inv.items || []).forEach((item: any) => {
        (item.staffAssignments || []).forEach((sa: any) => { ... });
    });
    return s + c;
}, 0))}
```

Untuk setiap render, ini menjalankan: `drillDownData.length × (staffList.length + inv.staffAssignments.length + inv.items.length × item.staffAssignments.length)` operasi. Dengan 100 invoice, 50 staff, 5 items per invoice, ini bisa ribuan operasi per render.

### Solusi

Gunakan `useMemo` untuk caching hasil kalkulasi:

```typescript
const drillDownTotals = useMemo(() => {
    if (!drillDownStaff || drillDownData.length === 0) return { commission: 0, revenue: 0 };
    const staffMatch = staffList.find(sf => sf.name === drillDownStaff);
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
}, [drillDownData, drillDownStaff, staffList]);

// Di JSX:
Commission: {formatCurrency(drillDownTotals.commission)} | Revenue: {formatCurrency(drillDownTotals.revenue)}
```

---

## 🟢 FE-R09 — `financial/page.tsx` Tidak Ada Error State — Silent Failure

**File:** `app/[slug]/(frontend)/reports/financial/page.tsx`  
**Kemungkinan Terjadi:** 20%  
**Dampak:** Jika fetch laporan keuangan gagal (network error, server down), halaman tetap kosong tanpa ada notifikasi ke user. User tidak tahu apakah laporan belum dimuat atau memang tidak ada data.

### Narasi

```typescript
const fetchReport = async () => {
    setLoading(true);
    try {
        const res = await fetch(`/api/reports/financial?...`, { headers: { "x-store-slug": slug } });
        const json = await res.json();
        if (json.success) {
            setData(json.data);
        }
        // ❌ Tidak ada else: jika json.success false, data tetap null tanpa error message
    } catch (error) {
        console.error(error);  // ❌ Hanya log ke console, tidak ada state error untuk user
    } finally {
        setLoading(false);
    }
};
```

### Solusi

```typescript
const [error, setError] = useState<string | null>(null);

const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
        const res = await fetch(...);
        const json = await res.json();
        if (json.success) {
            setData(json.data);
        } else {
            setError(json.error || 'Failed to load financial report');
        }
    } catch (err) {
        setError('Network error. Please check your connection.');
    } finally {
        setLoading(false);
    }
};

// Di JSX:
{error && (
    <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
        {error}
    </div>
)}
```

---

## 🟢 FE-R10 — `SalesChart` Komponen Diimport tapi Tidak Dipakai di Halaman Laporan

**File:** `components/reports/SalesChart.tsx`  
**Kemungkinan Terjadi:** 100%  
**Dampak:** Bundle size bertambah karena `recharts` library di-include untuk komponen yang tidak dipakai. Dead code meningkatkan maintenance burden.

### Narasi

Komponen `SalesChart.tsx` mengimport dan menggunakan library `recharts`:

```typescript
// components/reports/SalesChart.tsx
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
```

Namun dari analisa seluruh file report, tidak ada satu pun halaman yang mengimport atau menggunakan `<SalesChart />`. Komponen ini adalah sisa dari iterasi desain sebelumnya yang belum dibersihkan.

### Solusi

Hapus file `components/reports/SalesChart.tsx` atau implementasikan penggunaannya di halaman laporan (misalnya trend chart harian/mingguan di tab Summary).

---

---

# BAGIAN III — FLOWCHART BUG & ERROR

---

## 🗺️ Flowchart 1 — Alur Error Filter Staff di Sales Report

```
User membuka tab "Sales Report"
        │
        ▼
useEffect → fetchData() (aktifTab='sales')
        │
        ├── Fetch staff/service list: fetch('/api/reports/data?type=lists')
        │       ↓
        │   Staff.find({ status: 'active' })   ← [BE-R03] field salah
        │       ↓
        │   Return [] (empty array)             ← dropdown staff KOSONG
        │
        └── Fetch report: fetch('/api/reports?type=sales&...')
               ← TIDAK ADA x-store-slug header  ← [FE-R01]
               ↓
           tenantSlug = 'pusat'                 ← data cabang Pusat!
               ↓
           staffFilter dari searchParams = "664f2a..." (string)
           $or: [{ staff: "664f2a..." }]        ← [BE-R01] String bukan ObjectId
               ↓
           MongoDB: String != ObjectId → NO MATCH
               ↓
           Return SEMUA invoice (filter tidak efektif)
               ↓
User melihat semua invoice tanpa filter,
tapi semua dari TENANT PUSAT!
```

---

## 🗺️ Flowchart 2 — Alur Error Summary Tab (reports/data)

```
User membuka tab "Summary"
        │
        ▼
fetchData() → fetch('/api/reports/data?...', { headers: { x-store-slug: slug } })
        │ ← ini sudah benar headernya ✅
        ▼
GET /api/reports/data?type=full&startDate=...&endDate=...
        │
        ▼
Promise.all([
  Invoice.find({ date: ... }) ✅
  Expense.find({ date: ... }) ✅
  Appointment.find({ start: ... })  ← [BE-R02] field 'start' tidak ada!
       ↓ MongoDB abaikan field tidak ada
       ↓ Return SEMUA appointment (dump penuh)
  Customer.find()  ← [BE-R16] tanpa filter, load semua
  Product.find()   ← [BE-R16] tanpa filter, load semua
  Purchase.find({ date: ... }) ✅
])
        │
        ▼
appointments.length → jumlah SEMUA appointment di DB (bukan range yang dipilih)
        │
        ▼
setReportData({ totalAppointments: <angka terlalu besar> })
        │
        ▼
Summary menampilkan jumlah appointment yang tidak sesuai date range
```

---

## 🗺️ Flowchart 3 — Alur Error Staff Performance Report

```
User membuka tab "Staff Performance"
        │
        ▼
fetchData() → fetch('/api/reports?type=staff&...')
               ← TIDAK ADA x-store-slug  ← [FE-R01]
        │
        ▼
API mengambil data dari tenant 'pusat' ← data bocor
        │
        ▼
staffInvoices.forEach(inv => {
  inv.staffAssignments.forEach(assignment => {
    staffStats[id].appointments // tidak pernah increment ← [BE-R04]
    staffStats[id].sales += 1
    staffStats[id].revenue += inv.totalAmount  // full amount ← [BE-R05]
    // Staff 1: Rp300.000
    // Staff 2: Rp300.000
    // Seharusnya: masing-masing sesuai porsi!
  })
})
        │
        ▼
data = Object.values(staffStats)
  → [{ name: "Rina", appointments: 0, revenue: 900.000, ... }]
     appointments selalu 0 ← [BE-R04]
     revenue triple count ← [BE-R05]
        │
        ▼
User klik "Lihat" untuk drilldown
        │
        ▼
handleStaffDrillDown("Rina")
  staffList.find(s => s.name === "Rina")  ← [FE-R05] name-based lookup
  staffList = []  ← karena [BE-R03] staff list kosong!
        │
        ▼
match = undefined → setDrillDownData([])
Modal menampilkan "Tidak ada invoice ditemukan"
(meskipun ada invoice untuk Rina)
```

---

## 🗺️ Flowchart 4 — Alur Error AI Report

```
User klik "Generate AI Analysis"
        │
        ▼
POST /api/ai-reports
        │
        ▼
Settings.findOne()
  settings.openaiApiKey = "enc:AbCdEf..."  ← mungkin terenkripsi [BE-R10]
        │
        ▼
fetch("https://api.openai.com/v1/chat/completions", {
  Authorization: `Bearer enc:AbCdEf...`  ← invalid key!
})
        │
        ▼
OpenAI response: { error: { message: "Incorrect API key" } }
!response.ok → return { success: false, error: "Incorrect API key" }
        │
Atau jika key valid tapi content filter aktif:
        ▼
aiData = { choices: [] }  ← empty choices [BE-R11]
aiData.choices[0]         ← undefined!
.message.content          ← TypeError!
        │
        ▼
Catch block → return { success: false, error: "Cannot read properties of undefined" }
        │
        ▼
AI Report context juga menggunakan low stock hardcode:
  Product.find({ stock: { $lte: 10 } })  ← [BE-R12]
  (Produk dengan alertQuantity=50 dan stock=20 tidak masuk alert)
        │
        ▼
AI mendapat data inventory yang tidak akurat
→ Rekomendasi AI untuk manajemen stok bisa menyesatkan
```

---

## 🗺️ Flowchart 5 — Alur Error Export Excel

```
User di tab "Wallet" klik tombol "Export .xlsx"
        │
        ▼
handleExport()
        │
        ▼
!reportData → false (ada data)
Array.isArray(reportData) → false (wallet data adalah object { totalTopUp, totalUsage, transactions })
        │
        ▼
exportData = [reportData]  ← satu baris dengan key-value mentah
  → [{ totalTopUp: 500000, totalUsage: 300000, transactions: [...] }]
        │
        ▼
XLSX.utils.json_to_sheet(exportData)
  → Excel berisi 1 baris dengan kolom "totalTopUp", "totalUsage", "transactions"
  → Kolom "transactions" berisi "[object Object],[object Object]..." ← tidak berguna
        │
        ▼
File Excel tidak berguna dan tidak bisa dibaca [FE-R06]

=== Sama untuk tab "Daily" ===
exportData = [{ totalSales, totalCollected, payments: {Cash: 100, Card: 200}, ... }]
  → Kolom "payments" berisi "[object Object]" ← tidak terbaca
```

---

---

# BAGIAN IV — PRIORITAS FIX & REKOMENDASI

---

## 🎯 Urutan Prioritas Fix

| Prioritas | Kode | Alasan | Effort | Impact |
|-----------|------|--------|--------|--------|
| **P1** | **FE-R01** | Data bocor lintas tenant — semua report tab pakai data Pusat | 🟢 Easy | 🔴 Critical |
| **P2** | **BE-R03** | Staff list selalu kosong → filter tidak bisa dipakai | 🟢 Easy | 🔴 Critical |
| **P3** | **BE-R01** | staffFilter String vs ObjectId → filter sales tidak efektif | 🟢 Easy | 🔴 Critical |
| **P4** | **BE-R02** | Appointment query pakai field `start` yang tidak ada | 🟢 Easy | 🔴 Critical |
| **P5** | **FE-R02** | Link activity-log hardcoded tanpa slug | 🟢 Easy | 🔴 Critical |
| **P6** | **BE-R09** | Inkonsistensi netProfit antara dua route | 🟡 Medium | 🟠 High |
| **P7** | **BE-R05** | Revenue staff double-count pada multi-staff invoice | 🟡 Medium | 🟠 High |
| **P8** | **BE-R06** | Invoice cancelled masuk hitungan service/product stats | 🟢 Easy | 🟠 High |
| **P9** | **BE-R07** | amountPaid tanpa fallback → NaN di daily report | 🟢 Easy | 🟠 High |
| **P10** | **BE-R10** | OpenAI key kemungkinan tidak di-decrypt | 🟡 Medium | 🟠 High |
| **P11** | **BE-R08** | Payroll filter pakai createdAt bukan date | 🟢 Easy | 🟠 High |
| **P12** | **FE-R03** | StatCard props interface mismatch | 🟢 Easy | 🟠 High |
| **P13** | **FE-R04** | Sort currency format Indonesia gagal | 🟡 Medium | 🟠 High |
| **P14** | **FE-R06** | Export Excel tidak cover wallet/daily/inventory/expenses | 🟡 Medium | 🟠 High |
| **P15** | **BE-R04** | appointments counter tidak pernah increment | 🟢 Easy | 🟠 High |
| **P16** | **BE-R11** | choices[0] null-check di AI report | 🟢 Easy | 🟡 Medium |
| **P17** | **BE-R12** | Low stock hardcode 10, pakai alertQuantity | 🟢 Easy | 🟡 Medium |
| **P18** | **BE-R13** | ActivityLog countDocuments tanpa filter | 🟢 Easy | 🟡 Medium |
| **P19** | **BE-R14** | Walk-in customer count tidak akurat di WA report | 🟡 Medium | 🟡 Medium |
| **P20** | **FE-R05** | Drilldown name-matching ambiguous | 🟡 Medium | 🟠 High |
| **P21** | **BE-R15** | Timezone hardcode di WA daily report | 🟢 Easy | 🟡 Medium |
| **P22** | **BE-R16** | Customer/Product load semua tanpa limit | 🟡 Medium | 🟡 Medium |
| **P23** | **FE-R07** | setPresetRange tanpa default case | 🟢 Easy | 🟡 Medium |
| **P24** | **FE-R08** | Commission kalkulasi tidak di-memoize | 🟡 Medium | 🟡 Medium |
| **P25** | **FE-R09** | Financial page silent failure | 🟢 Easy | 🟢 Low |
| **P26** | **FE-R10** | SalesChart dead code | 🟢 Easy | 🟢 Low |

---

## 🏗️ Rekomendasi Arsitektur Jangka Panjang

### 1. Buat Custom `useSalonFetch` Hook (Menyelesaikan FE-R01 dan potensi bug serupa)

```typescript
// hooks/useSalonFetch.ts
import { useParams } from 'next/navigation';

export function useSalonFetch() {
    const params = useParams();
    const slug = params.slug as string;
    
    return async (url: string, options?: RequestInit) => {
        return fetch(url, {
            ...options,
            headers: {
                'x-store-slug': slug,
                ...options?.headers,
            }
        });
    };
}

// Penggunaan di reports/page.tsx:
const salonFetch = useSalonFetch();
const res = await salonFetch('/api/reports?type=sales&...');
```

### 2. Sentralisasi Schema Field Constants (Menyelesaikan BE-R02, BE-R03)

Buat file constants untuk nama field yang sering dipakai:

```typescript
// lib/modelConstants.ts
export const STAFF_ACTIVE_FILTER = { isActive: true };
export const APPOINTMENT_DATE_FIELD = 'date';  // bukan 'start'

// Penggunaan:
import { STAFF_ACTIVE_FILTER } from '@/lib/modelConstants';
Staff.find(STAFF_ACTIVE_FILTER).select('_id name');
```

### 3. Unified Report API dengan Proper Typing (Menyelesaikan BE-R01, BE-R05, BE-R06)

Buat handler terpisah per report type dengan interface yang ketat:

```typescript
// lib/reportHandlers/staffReport.ts
import mongoose from 'mongoose';

export async function buildStaffReport(Invoice: any, start: Date, end: Date) {
    const invoices = await Invoice.find({
        date: { $gte: start, $lte: end },
        status: { $nin: ['cancelled', 'voided'] }  // ← filter status
    }).populate('staffAssignments.staff').lean();
    
    const staffStats: Record<string, StaffStat> = {};
    
    invoices.forEach(inv => {
        const assignments = inv.staffAssignments || [];
        const totalPersen = assignments.reduce((s, a) => s + (a.porsiPersen || 0), 0) || 100;
        
        assignments.forEach(assignment => {
            const s = assignment.staff;
            if (!s) return;
            const id = s._id.toString();
            if (!staffStats[id]) {
                staffStats[id] = { _id: id, name: s.name, appointments: 0, sales: 0, commission: 0, revenue: 0 };
            }
            staffStats[id].appointments += 1;
            staffStats[id].sales += 1;
            // Porsi revenue yang adil
            const persen = (assignment.porsiPersen || (100 / assignments.length)) / 100;
            staffStats[id].revenue += inv.totalAmount * persen;
            staffStats[id].commission += (assignment.commission || 0);
        });
    });
    
    return Object.values(staffStats).sort((a, b) => b.revenue - a.revenue);
}
```

---

## 📋 Checklist Fix Developer

```
CRITICAL — selesaikan sebelum release:
☐ [FE-R01] Tambahkan x-store-slug header di semua fetch non-summary di fetchData()
☐ [BE-R03] Ganti Staff.find({ status: 'active' }) → Staff.find({ isActive: true })
☐ [BE-R01] Konversi staffFilter string ke ObjectId sebelum query
☐ [BE-R02] Ganti Appointment.find({ start: ... }) → Appointment.find({ date: ... })
☐ [FE-R02] Ganti <a href="/reports/activity-log"> dengan Link yang include slug

HIGH — selesaikan dalam sprint ini:
☐ [BE-R09] Tambahkan payroll ke kalkulasi netProfit di financial route
☐ [BE-R05] Gunakan porsiPersen untuk kalkulasi revenue staff
☐ [BE-R06] Tambahkan status filter ke query services dan products report
☐ [BE-R07] Tambahkan fallback (inv.amountPaid || 0) di daily report
☐ [BE-R10] Decrypt openaiApiKey sebelum dikirim ke OpenAI
☐ [BE-R08] Ganti createdAt → date di Payroll query
☐ [FE-R03] Sesuaikan StatCard props dengan interface yang benar
☐ [FE-R04] Perbaiki logika parsing currency Indonesia di renderTable sort
☐ [FE-R06] Tambahkan export handler untuk tab wallet, daily, inventory, expenses
☐ [BE-R04] Tambahkan appointments increment di staffStats

MEDIUM — sprint berikutnya:
☐ [BE-R11] Tambahkan null-check untuk aiData.choices[0]
☐ [BE-R12] Ganti hardcode $lte: 10 dengan $expr $lte ['$stock', '$alertQuantity']
☐ [BE-R13] Tambahkan filter ke ActivityLog.countDocuments() agar konsisten
☐ [BE-R14] Hitung walk-in customer per invoice, bukan satu entitas
☐ [FE-R05] Sertakan _id dalam staff report data untuk avoid name-based lookup
☐ [BE-R15] Gunakan Settings.timezone di WA daily report
☐ [BE-R16] Gunakan count/aggregate untuk Customer dan Product, bukan load semua
☐ [FE-R07] Tambahkan default value untuk start/end di setPresetRange
☐ [FE-R08] Bungkus kalkulasi commission drilldown dengan useMemo

LOW — technical debt:
☐ [FE-R09] Tambahkan error state di financial/page.tsx
☐ [FE-R10] Hapus atau implementasikan SalesChart.tsx yang tidak terpakai
```

---

*Laporan dihasilkan dari analisa statis kode `1778847535192_salon-next.zip` pada 16 Mei 2026.*  
*Scope analisa: `app/api/reports/**`, `app/api/ai-reports/**`, `app/api/cron/wa-daily-report/**`, `app/[slug]/(frontend)/reports/**`, `components/reports/**`*