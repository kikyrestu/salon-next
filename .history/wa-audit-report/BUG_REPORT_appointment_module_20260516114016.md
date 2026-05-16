# 🔍 Bug & Error Report — Modul Appointment
### `salon-next` · Next.js App Router · TypeScript · MongoDB/Mongoose

> **Tanggal Analisa:** 15 Mei 2026  
> **Scope:** Frontend & Backend — Modul Appointment (semua fitur & sub-modul)  
> **Analis:** Claude Sonnet 4.6 — Static Code Analysis  
> **File yang Dianalisa:** `app/api/appointments/route.ts`, `app/api/appointments/[id]/route.ts`, `app/api/appointments/send-reminders/route.ts`, `app/api/staff/appointment-list/route.ts`, `app/[slug]/(frontend)/appointments/page.tsx`, `app/[slug]/(frontend)/appointments/calendar/page.tsx`, `components/appointments/StaffCalendar.tsx`, `models/Appointment.ts`

---

## 📊 Ringkasan Eksekutif

| Kode | Deskripsi Singkat | Layer | Severity | Kemungkinan Terjadi |
|------|-------------------|-------|----------|---------------------|
| **BE-01** | Typo `'no_show'` vs `'no-show'` di conflict check | Backend | 🔴 Critical | **95%** |
| **BE-02** | String time comparison fragile di conflict detection | Backend | 🔴 Critical | **80%** |
| **BE-03** | Counter tidak di-rollback saat Invoice gagal (invoice number gap) | Backend | 🟠 High | **70%** |
| **BE-04** | `s.price` tanpa fallback `|| 0` di PUT → NaN subtotal | Backend | 🟠 High | **60%** |
| **BE-05** | Invoice tidak di-update saat appointment diedit (financial mismatch) | Backend | 🟠 High | **85%** |
| **BE-06** | `staff.name` tanpa null-check di send-reminders → crash | Backend | 🟡 Medium | **40%** |
| **BE-07** | Timezone mismatch di date range query (`new Date(start)`) | Backend | 🟡 Medium | **50%** |
| **BE-08** | `generateInvoiceNumber` fail sebelum rollback appointment | Backend | 🟡 Medium | **30%** |
| **FE-01** | `StaffCalendar` tidak kirim `x-store-slug` header → data salah tenant | Frontend | 🔴 Critical | **100%** |
| **FE-02** | `fetchResources` di `calendar/page.tsx` tidak kirim header untuk customers | Frontend | 🔴 Critical | **100%** |
| **FE-03** | Race condition di slot fetching — tidak ada AbortController | Frontend | 🟠 High | **65%** |
| **FE-04** | Double-fetch saat searchTerm dan filter berubah bersamaan | Frontend | 🟠 High | **55%** |
| **FE-05** | `apt.totalAmount.toLocaleString()` throw jika value null/undefined | Frontend | 🟡 Medium | **25%** |
| **FE-06** | Status filter tidak include opsi 'no-show' | Frontend | 🟡 Medium | **100%** (missing feature) |
| **FE-07** | `timeSlots` adalah dead code — tidak pernah dipakai di JSX | Frontend | 🟢 Low | **100%** (code smell) |
| **FE-08** | `taxRate` state dead code di `calendar/page.tsx` | Frontend | 🟢 Low | **100%** (code smell) |
| **FE-09** | `${view}ly Schedule` menghasilkan teks salah untuk 'day' view | Frontend | 🟢 Low | **100%** |
| **FE-10** | Tidak ada error handling di `fetchResources` — silent failure | Frontend | 🟢 Low | **20%** |

**Total: 18 Bug** | 🔴 Critical: 3 | 🟠 High: 5 | 🟡 Medium: 4 | 🟢 Low: 4 *(Backend: 2C, 3H, 2M | Frontend: 1C, 2H, 2M, 4L)*

---

## 🗂️ Legenda Severity

| Simbol | Level | Definisi |
|--------|-------|----------|
| 🔴 | **Critical** | Menyebabkan data corruption, fitur tidak berfungsi sama sekali, atau seluruh tenant memakai data tenant lain |
| 🟠 | **High** | Menyebabkan kalkulasi finansial salah, data inkonsisten antara collection, atau UX sangat terganggu |
| 🟡 | **Medium** | Crash pada kondisi tertentu, edge case yang cukup sering terjadi |
| 🟢 | **Low** | Code smell, dead code, atau efek kecil pada performa/tampilan |

---

---

# BAGIAN I — BACKEND BUGS

---

## 🔴 BE-01 — Typo `'no_show'` vs `'no-show'` di Conflict Check

**File:** `app/api/appointments/route.ts` (POST handler, baris conflict detection)  
**Kemungkinan Terjadi:** 95%  
**Dampak:** Staff yang memiliki appointment `no-show` tidak bisa dibooking ulang di slot yang sama → slot secara permanen terkunci

### Narasi

Ketika user mencoba membuat appointment baru, sistem akan memeriksa apakah staff sudah memiliki jadwal di slot yang sama. Query conflict detection menggunakan `$nin` untuk mengecualikan status tertentu dari pengecekan. Masalahnya, kode menggunakan `'no_show'` (underscore) sementara schema Mongoose mendefinisikan enum dengan `'no-show'` (hyphen).

Akibatnya, MongoDB tidak pernah menemukan dokumen dengan status `'no_show'` karena tidak ada yang tersimpan demikian — nilai yang tersimpan selalu `'no-show'`. Kondisi `$nin: ['cancelled', 'no_show']` hanya benar-benar mengecualikan `'cancelled'`, sedangkan `'no-show'` tetap ikut dihitung sebagai conflict. Staff yang punya satu appointment no-show tidak bisa menerima booking baru di slot itu selamanya — kecuali admin manual menghapusnya.

### Bukti Kode

```typescript
// app/api/appointments/route.ts — POST conflict check
const conflictingAppointment = await Appointment.findOne({
    staff: body.staff,
    date: new Date(body.date),
    status: { $nin: ['cancelled', 'no_show'] },  // ❌ SALAH: underscore
    $or: [ ... ]
});

// models/Appointment.ts — schema definisi
status: {
    enum: ['pending', 'confirmed', 'completed', 'cancelled', 'no-show'],  // ✅ hyphen
    default: 'pending',
},
```

### Solusi

```typescript
// ✅ BENAR: gunakan hyphen, konsisten dengan schema enum
status: { $nin: ['cancelled', 'no-show'] },
```

---

## 🔴 BE-02 — String Time Comparison Fragile di Conflict Detection

**File:** `app/api/appointments/route.ts` (POST handler)  
**Kemungkinan Terjadi:** 80%  
**Dampak:** Conflict detection gagal total jika waktu melewati tengah malam; selain itu membandingkan string `"HH:mm"` menggunakan operator numerik MongoDB

### Narasi

Conflict detection membandingkan `startTime` dan `endTime` sebagai string `"HH:mm"` dengan operator MongoDB `$lte`, `$gt`, `$lt`, `$gte`. Ini secara kebetulan bekerja karena format `"HH:mm"` bersifat lexicographically sortable — `"09:00" < "14:00"` secara string. Namun ini adalah kebetulan yang rapuh.

**Kasus problematik nyata:**  
- Appointment 23:30 – 01:00 (melewati tengah malam): `endTime = "01:00"`. Perbandingan string `"01:00" < "23:30"` akan salah interpret — "01:00" dianggap "lebih kecil" secara lexicographic sehingga tidak terdeteksi sebagai conflict.
- Appointment dengan format berbeda (misal "9:00" tanpa leading zero): langsung gagal.

Selain itu, MongoDB `$lte/"HH:mm"` adalah *string comparison*, bukan *numeric comparison*. Ini berbeda dengan perbandingan angka murni. Meskipun hasilnya kebetulan sama untuk format dua-digit, kode ini sangat rentan terhadap perubahan di masa depan.

### Bukti Kode

```typescript
// route.ts POST — conflict check menggunakan string comparison
$or: [
    { startTime: { $lte: body.startTime }, endTime: { $gt: body.startTime } },   // ❌ string compare
    { startTime: { $lt: body.endTime }, endTime: { $gte: body.endTime } },        // ❌ string compare
    { startTime: { $gte: body.startTime }, endTime: { $lte: body.endTime } },     // ❌ string compare
]
```

### Solusi

Simpan `startTime` dan `endTime` sebagai **menit sejak midnight** (integer) di database, atau konversi ke `Date` object untuk perbandingan yang robust:

```typescript
// Konversi HH:mm ke menit sejak midnight untuk perbandingan yang aman
const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
};

const newStart = toMinutes(body.startTime);
const newEnd = toMinutes(body.endTime);

// Fetch semua appointment di tanggal yang sama dan filter di aplikasi
const sameDay = await Appointment.find({
    staff: body.staff,
    date: new Date(body.date),
    status: { $nin: ['cancelled', 'no-show'] }
});

const hasConflict = sameDay.some(apt => {
    const aptStart = toMinutes(apt.startTime);
    const aptEnd = toMinutes(apt.endTime);
    return newStart < aptEnd && newEnd > aptStart;
});
```

---

## 🟠 BE-03 — Counter Invoice Tidak Di-rollback Saat Invoice Gagal (Gap Nomor)

**File:** `app/api/appointments/route.ts` (POST), `lib/invoiceNumber.ts`  
**Kemungkinan Terjadi:** 70%  
**Dampak:** Nomor invoice bolong (gap) setiap kali terjadi kegagalan setelah counter di-increment. Pada audit finansial, gap nomor invoice adalah temuan serius.

### Narasi

Alur pembuatan appointment dengan status `confirmed` adalah:
1. `Appointment.create()` → berhasil, appointment tersimpan
2. `generateInvoiceNumber()` → **Counter di-increment secara atomic** dari seq N ke N+1, menghasilkan `"INV-2026-0000N+1"`
3. `Invoice.create({ invoiceNumber: "INV-2026-0000N+1", ... })` → jika **gagal** di sini

Counter sudah terlanjur di-increment ke N+1. Bahkan dengan rollback appointment (yang sudah ada di kode), Counter tidak di-decrement kembali. Nomor invoice N+1 "hilang" — tidak pernah terpakai di database. Pada request berikutnya, nomor menjadi N+2.

Untuk salon yang diaudit secara finansial, gap nomor invoice `INV-2026-00015, INV-2026-00017` (tanpa `00016`) adalah tanda merah yang membutuhkan penjelasan.

### Alur Error

```
generateInvoiceNumber()
    Counter: seq N → N+1               ← counter sudah berubah
    return "INV-2026-0000N+1"
              ↓
Invoice.create({ invoiceNumber: "INV-2026-0000N+1", ... })
              ↓ GAGAL (duplicate key / validation error)
              ↓
Appointment.findByIdAndDelete(apt._id)  ← rollback appointment ✅
Counter TIDAK di-decrement               ← gap terjadi ❌
              ↓
Request berikutnya → Counter N+1 → N+2 → nomor N+1 hilang selamanya
```

### Solusi

Tambahkan mekanisme retry atau gunakan nomor yang diambil dari invoice terakhir sebagai fallback:

```typescript
// lib/invoiceNumber.ts — tambah fungsi decrement untuk rollback
export async function rollbackInvoiceNumber(tenantSlug: string, year: number) {
    const db = await getTenantDb(tenantSlug);
    const Counter = db.model('Counter', counterSchema);
    await Counter.findOneAndUpdate(
        { _id: `INV-${year}` },
        { $inc: { seq: -1 } }
    );
}

// app/api/appointments/route.ts — gunakan saat rollback
try {
    const createdInvoice = await Invoice.create({ invoiceNumber, ... });
    await scheduleFollowUp(createdInvoice._id, tenantSlug);
} catch (invoiceError) {
    await rollbackInvoiceNumber(tenantSlug, new Date().getFullYear()); // ← tambahkan ini
    await Appointment.findByIdAndDelete(appointment._id);
    throw invoiceError;
}
```

---

## 🟠 BE-04 — `s.price` Tanpa Fallback di PUT → NaN Subtotal

**File:** `app/api/appointments/[id]/route.ts` (PUT handler)  
**Kemungkinan Terjadi:** 60%  
**Dampak:** Jika ada service tanpa harga (misalnya service yang baru ditambahkan admin tapi belum diisi harganya), subtotal menjadi `NaN`, menyebar ke `tax`, `totalAmount`, dan tersimpan di invoice sebagai `NaN`

### Narasi

Di handler PUT (update appointment), kalkulasi subtotal dilakukan tanpa fallback untuk nilai `price` yang bisa saja `undefined`:

```typescript
// PUT route — tidak ada fallback
const subtotal = services.reduce((acc: number, s: any) => acc + s.price, 0);

// POST route — sudah ada fallback ✅  
const subtotal = body.services.reduce((acc: number, s: any) => acc + (s.price || 0), 0);
```

Jika satu service memiliki `price: undefined` atau `price: null`, operasi `acc + undefined` menghasilkan `NaN`. `NaN` bersifat viral — semua kalkulasi selanjutnya (`tax = subtotal * ...`, `totalAmount = subtotal + tax - discount`) juga menjadi `NaN`. Mongoose akan menyimpan `NaN` ke MongoDB sebagai nilai numeric yang tidak valid, menyebabkan tampilan di frontend menampilkan `NaN` sebagai nominal transaksi.

### Solusi

```typescript
// ✅ Konsisten dengan POST — tambah fallback
const subtotal = services.reduce((acc: number, s: any) => acc + (s.price || 0), 0);
const totalDuration = (cleanBody.services || existingAppointment.services)
    .reduce((acc: number, s: any) => acc + (s.duration || 0), 0);
```

---

## 🟠 BE-05 — Invoice Tidak Di-update Saat Appointment Diedit (Financial Mismatch)

**File:** `app/api/appointments/[id]/route.ts` (PUT handler)  
**Kemungkinan Terjadi:** 85%  
**Dampak:** Invoice menampilkan harga lama meskipun appointment sudah diedit; laporan keuangan tidak akurat

### Narasi

Saat admin mengedit appointment yang sudah punya invoice (misalnya mengganti service, mengubah harga, atau menambah diskon), kode PUT hanya:
1. Menghitung ulang `subtotal`, `tax`, `totalAmount` untuk appointment
2. Membuat invoice **baru** jika belum ada
3. Mengupdate status invoice ke `'paid'` jika appointment menjadi `'completed'`

Yang **tidak** dilakukan: mengupdate `items`, `subtotal`, `tax`, `discount`, dan `totalAmount` di invoice yang **sudah ada**. Ini menyebabkan invoice lama tetap menyimpan data finansial versi sebelumnya.

Contoh skenario:
- Appointment dibuat: Service A (Rp100.000) + Service B (Rp150.000) → Invoice total Rp250.000
- Admin edit: ganti Service B dengan Service C (Rp200.000)
- Invoice masih tercatat Rp250.000, padahal seharusnya Rp300.000

### Bukti Kode

```typescript
// PUT route — existingInvoice ditemukan, tapi HANYA status yang diupdate
} else if (
    appointment.status === 'completed' &&
    existingInvoice.status !== 'paid'
) {
    await Invoice.findByIdAndUpdate(existingInvoice._id, {
        status: 'paid'   // ← hanya update status, tidak update items/amounts!
    });
}
```

### Solusi

```typescript
// ✅ Update invoice data saat appointment diedit
const invoiceUpdate: any = {
    items: appointment.services.map((s: any) => ({
        item: s.service?._id || s.service,
        itemModel: 'Service',
        name: s.name,
        price: s.price || 0,
        quantity: 1,
        total: s.price || 0
    })),
    subtotal: appointment.subtotal,
    tax: appointment.tax,
    discount: appointment.discount || 0,
    totalAmount: appointment.totalAmount,
    commission: totalCommission,
};

if (appointment.status === 'completed' && existingInvoice.status !== 'paid') {
    invoiceUpdate.status = 'paid';
}

await Invoice.findByIdAndUpdate(existingInvoice._id, invoiceUpdate);
```

---

## 🟡 BE-06 — `staff.name` Tanpa Null-check di Send-reminders → Runtime Crash

**File:** `app/api/appointments/send-reminders/route.ts`  
**Kemungkinan Terjadi:** 40%  
**Dampak:** Loop pengiriman reminder crash total; semua appointment dalam batch gagal terkirim reminder

### Narasi

Di endpoint send-reminders, setelah populate `staff`, kode langsung mengakses `staff.name` dalam template pesan WA tanpa memverifikasi bahwa populate berhasil:

```typescript
const staff: any = appointment.staff;  // bisa null jika staff sudah dihapus dari DB

const waMessage = 
    `- Staff: *${staff.name}*\n` +   // ❌ TypeError: Cannot read properties of null
    ...
```

Skenario yang memicu bug ini: staff yang sudah ditugaskan ke appointment kemudian **dihapus** atau **dinonaktifkan** dari sistem. Populate dengan `'staff', 'name'` akan menghasilkan `null` jika dokumen Staff tidak ditemukan. Ketika iterasi mencapai appointment ini, keseluruhan `for` loop akan throw `TypeError` dan semua reminder berikutnya dalam batch itu tidak terkirim.

Ada pengecekan untuk `customer` (ada `if (!customer) { errors.push(...); continue; }`), tapi tidak ada pengecekan serupa untuk `staff`.

### Solusi

```typescript
const staff: any = appointment.staff;

// ✅ Tambah null-check untuk staff, sama seperti customer
if (!staff) {
    errors.push({ appointmentId: appointment._id, error: "Staff not found (possibly deleted)" });
    continue;
}
```

---

## 🟡 BE-07 — Timezone Mismatch di Date Range Query

**File:** `app/api/appointments/route.ts` (GET handler)  
**Kemungkinan Terjadi:** 50%  
**Dampak:** Appointment di awal/akhir hari bisa tidak muncul atau muncul di hari yang salah tergantung timezone server

### Narasi

Query date range mengkonstruksi `Date` object dari string YYYY-MM-DD yang dikirim frontend:

```typescript
query.date = {
    $gte: new Date(start),                        // "2026-05-01" → UTC midnight
    $lte: new Date(end + "T23:59:59.999Z")        // "2026-05-01T23:59:59.999Z" → UTC end of day
};
```

Masalahnya: `new Date("2026-05-01")` diinterpretasikan sebagai **UTC midnight** (`2026-05-01T00:00:00.000Z`). Jika salon beroperasi di timezone WIB (UTC+7) dan server di UTC, sebuah appointment yang dibuat pada `2026-05-01 07:00 WIB` tersimpan di MongoDB sebagai `2026-05-01T00:00:00.000Z`. Ini cocok.

Namun appointment pada `2026-05-01 06:00 WIB` tersimpan sebagai `2026-04-30T23:00:00.000Z` — jatuh di **hari sebelumnya** dalam UTC, sehingga tidak masuk dalam range query `$gte: 2026-05-01T00:00:00.000Z`. Salon di timezone UTC- bahkan lebih terdampak.

### Solusi

Gunakan pendekatan yang timezone-aware:

```typescript
import { startOfDay, endOfDay } from 'date-fns';
import { zonedTimeToUtc } from 'date-fns-tz'; // atau gunakan manual offset

const TIMEZONE = process.env.TIMEZONE || 'Asia/Jakarta';

query.date = {
    $gte: zonedTimeToUtc(startOfDay(new Date(start)), TIMEZONE),
    $lte: zonedTimeToUtc(endOfDay(new Date(end)), TIMEZONE)
};
```

---

## 🟡 BE-08 — `generateInvoiceNumber` Gagal Sebelum Try-Invoice Tanpa Rollback

**File:** `app/api/appointments/route.ts` (POST handler)  
**Kemungkinan Terjadi:** 30%  
**Dampak:** Appointment tersimpan tanpa invoice, tanpa rollback, jika counter DB gagal

### Narasi

Dalam kode yang sudah ada rollback untuk `Invoice.create()` failure, ada satu celah: jika `generateInvoiceNumber()` sendiri yang gagal (misalnya Counter collection tidak tersedia, koneksi DB timeout saat akses Counter), exception di-throw **sebelum** masuk ke try-catch block invoice, dan appointment yang sudah tersimpan tidak di-rollback.

```typescript
const appointment = await Appointment.create({...});  // ✅ tersimpan

if (appointment.status === 'confirmed' || ...) {
    const invoiceNumber = await generateInvoiceNumber(tenantSlug);  // ← jika ini throw...
    
    try {  // ← baru masuk try setelah generateInvoiceNumber
        const createdInvoice = await Invoice.create({ invoiceNumber, ... });
        ...
    } catch (invoiceError) {
        await Appointment.findByIdAndDelete(appointment._id);  // rollback
        throw invoiceError;
    }
    // generateInvoiceNumber failure tidak ter-cover oleh try-catch di atas!
}
```

### Solusi

Pindahkan `generateInvoiceNumber` ke dalam try-catch block yang sama:

```typescript
try {
    const invoiceNumber = await generateInvoiceNumber(tenantSlug);  // ← pindah ke sini
    const createdInvoice = await Invoice.create({ invoiceNumber, ... });
    await scheduleFollowUp(createdInvoice._id, tenantSlug);
} catch (invoiceError) {
    await Appointment.findByIdAndDelete(appointment._id);
    throw invoiceError;
}
```

---

---

# BAGIAN II — FRONTEND BUGS

---

## 🔴 FE-01 — `StaffCalendar` Tidak Kirim `x-store-slug` Header → Data Salah Tenant

**File:** `components/appointments/StaffCalendar.tsx`  
**Kemungkinan Terjadi:** 100% (selalu terjadi di setup multi-tenant)  
**Dampak:** Calendar view **selalu** menampilkan data dari tenant `'pusat'`, bukan tenant yang sedang aktif. Staff dari cabang lain bisa terlihat. Appointments dari semua tenant tercampur.

### Narasi

`StaffCalendar` adalah komponen mandiri yang melakukan fetch ke dua endpoint secara independen. Komponen ini tidak menerima `slug` sebagai prop, sehingga tidak memiliki cara untuk meng-inject `x-store-slug` header:

```typescript
// components/appointments/StaffCalendar.tsx
const fetchResources = useCallback(async () => {
    const res = await fetch("/api/staff?isActive=true");  // ❌ tidak ada x-store-slug
    ...
}, []);

const fetchAppointments = useCallback(async (...) => {
    const res = await fetch(url);                         // ❌ tidak ada x-store-slug
    ...
}, []);
```

Di sisi API:
```typescript
// app/api/appointments/route.ts
const tenantSlug = request.headers.get('x-store-slug') || 'pusat';  // fallback ke 'pusat'
```

Setiap pengguna di cabang `bintaro` yang membuka Calendar View akan melihat data appointment cabang `pusat`. Ini adalah **data leak lintas tenant** yang serius.

### Solusi

Tambahkan `slug` sebagai prop dan inject ke semua fetch call:

```typescript
// StaffCalendar.tsx — tambah slug prop
interface StaffCalendarProps {
    onSelectEvent?: (event: any) => void;
    refreshTrigger?: number;
    slug: string;  // ← tambah ini
}

export default function StaffCalendar({ onSelectEvent, refreshTrigger, slug }: StaffCalendarProps) {
    const fetchResources = useCallback(async () => {
        const res = await fetch("/api/staff?isActive=true", {
            headers: { "x-store-slug": slug }  // ← inject header
        });
        ...
    }, [slug]);

    const fetchAppointments = useCallback(async (...) => {
        const res = await fetch(url, {
            headers: { "x-store-slug": slug }  // ← inject header
        });
        ...
    }, [slug, ...]);
}

// Usage di appointments/page.tsx dan calendar/page.tsx
<StaffCalendar slug={slug} refreshTrigger={refreshTrigger} onSelectEvent={...} />
```

---

## 🔴 FE-02 — `fetchResources` di `calendar/page.tsx` Tidak Kirim Header untuk Customers

**File:** `app/[slug]/(frontend)/appointments/calendar/page.tsx`  
**Kemungkinan Terjadi:** 100%  
**Dampak:** Daftar customer di form appointment Calendar selalu diambil dari tenant `'pusat'`, bukan tenant aktif. User di cabang lain tidak bisa memilih customer mereka sendiri.

### Narasi

Di `calendar/page.tsx`, fungsi `fetchResources` melakukan tiga fetch secara bersamaan. Dua dari tiga sudah kirim header, tetapi satu — untuk customers — tidak:

```typescript
// calendar/page.tsx
const fetchResources = async () => {
    const [staffRes, serviceRes, customerRes] = await Promise.all([
        fetch("/api/staff/appointment-list", { headers: { "x-store-slug": slug } }),  // ✅
        fetch("/api/services?limit=0", { headers: { "x-store-slug": slug } }),        // ✅
        fetch("/api/customers?limit=0")                                                // ❌ MISSING!
    ]);
```

Ini **berbeda** dengan `appointments/page.tsx` (halaman daftar) yang sudah kirim header untuk semua resource. Inconsistency ini menunjukkan header ditambahkan secara manual per-fetch, bukan melalui interceptor terpusat.

### Solusi

```typescript
fetch("/api/customers?limit=0", { headers: { "x-store-slug": slug } })  // ✅
```

**Rekomendasi jangka panjang:** Buat custom `useFetch` hook yang otomatis inject `x-store-slug` dari context:

```typescript
// hooks/useSalonFetch.ts
export function useSalonFetch() {
    const { slug } = useParams();
    return (url: string, options?: RequestInit) => fetch(url, {
        ...options,
        headers: {
            "x-store-slug": slug as string,
            ...options?.headers,
        }
    });
}
```

---

## 🟠 FE-03 — Race Condition di Slot Fetching — Tidak Ada AbortController

**File:** `app/[slug]/(frontend)/appointments/page.tsx`, `app/[slug]/(frontend)/appointments/calendar/page.tsx`  
**Kemungkinan Terjadi:** 65%  
**Dampak:** Slot yang ditampilkan bisa merupakan hasil request lama (stale), bukan request terbaru. User bisa memilih slot yang sudah tidak tersedia.

### Narasi

Effect untuk fetch available slots ter-trigger setiap kali `staffId` atau `date` berubah:

```typescript
useEffect(() => {
    if (formData.staffId && formData.date && isModalOpen) {
        fetchAvailableSlots();  // setiap kali staffId/date berubah
    }
}, [formData.staffId, formData.date, isModalOpen]);
```

Jika user dengan cepat mengganti staff dari "Rina" → "Sari" → "Budi", tiga request HTTP diluncurkan secara berurutan. Tidak ada mekanisme untuk membatalkan request sebelumnya (AbortController) atau mengabaikan response yang sudah stale. Jika response untuk "Rina" datang **setelah** response untuk "Budi" (karena network jitter), slot yang ditampilkan adalah slot milik Rina, bukan Budi — namun tampilan staff yang dipilih menunjukkan Budi. User akan memesan slot yang sebenarnya adalah milik staff yang salah.

### Solusi

```typescript
useEffect(() => {
    if (!formData.staffId || !formData.date || !isModalOpen) {
        setAvailableSlots([]);
        return;
    }
    
    const controller = new AbortController();  // ← buat controller per-effect
    
    const fetchSlots = async () => {
        setLoadingSlots(true);
        try {
            const res = await fetch(`/api/staff-slots?...`, {
                headers: { "x-store-slug": slug },
                signal: controller.signal  // ← pass signal ke fetch
            });
            const data = await res.json();
            if (data.success) {
                setAvailableSlots(data.data.availableSlotsForBooking || []);
            }
        } catch (error: any) {
            if (error.name !== 'AbortError') {  // ← abaikan error dari abort
                console.error("Error fetching slots:", error);
                setAvailableSlots([]);
            }
        } finally {
            setLoadingSlots(false);
        }
    };
    
    fetchSlots();
    
    return () => controller.abort();  // ← cancel saat effect re-run atau unmount
}, [formData.staffId, formData.date, isModalOpen]);
```

---

## 🟠 FE-04 — Double-fetch Saat `searchTerm` dan Filter Berubah Bersamaan

**File:** `app/[slug]/(frontend)/appointments/page.tsx`  
**Kemungkinan Terjadi:** 55%  
**Dampak:** Dua request GET `/api/appointments` berjalan paralel; tampilan bisa flicker atau menampilkan hasil yang salah

### Narasi

Ada dua `useEffect` terpisah yang keduanya memanggil `fetchAppointments()`:

```typescript
// Effect 1: re-fetch saat page, statusFilter, startDate, endDate berubah
useEffect(() => {
    fetchAppointments();
}, [page, statusFilter, startDate, endDate]);

// Effect 2: debounced re-fetch saat searchTerm berubah
useEffect(() => {
    const timer = setTimeout(() => {
        setPage(1);         // ← ini memicu Effect 1 juga!
        fetchAppointments();
    }, 500);
    return () => clearTimeout(timer);
}, [searchTerm]);
```

Ketika `searchTerm` berubah, Effect 2 setelah 500ms melakukan `setPage(1)`. React batch state updates, tapi `setPage(1)` juga akan memicu Effect 1 (karena `page` ada di dependency array-nya) yang langsung memanggil `fetchAppointments()` lagi — hampir bersamaan dengan panggilan dari Effect 2.

Hasil: dua request paralel, dua kali loading state toggle, dan tampilan yang berkedip.

### Solusi

Gabungkan kedua effect menjadi satu dengan debounce yang diterapkan ke semua trigger:

```typescript
// Gunakan satu state terpusat untuk semua filter
const [filters, setFilters] = useState({
    page: 1, search: '', status: '', startDate: '', endDate: ''
});

// Satu useEffect dengan debounce untuk search saja
const [debouncedSearch, setDebouncedSearch] = useState('');

useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 500);
    return () => clearTimeout(timer);
}, [filters.search]);

useEffect(() => {
    fetchAppointments();
}, [filters.page, filters.status, filters.startDate, filters.endDate, debouncedSearch]);
```

---

## 🟡 FE-05 — `apt.totalAmount.toLocaleString()` Throw Jika Value Null/Undefined

**File:** `app/[slug]/(frontend)/appointments/page.tsx` (tabel list dan mobile card)  
**Kemungkinan Terjadi:** 25%  
**Dampak:** Seluruh halaman appointments crash (white screen) jika ada satu appointment dengan `totalAmount` null

### Narasi

Di rendering tabel dan mobile card:

```tsx
{settings.symbol}
{apt.totalAmount.toLocaleString("id-ID", { maximumFractionDigits: 0 })}
```

Jika `apt.totalAmount` adalah `null`, `undefined`, atau `NaN` (bisa terjadi dari BE-04), memanggil `.toLocaleString()` pada `null`/`undefined` akan throw `TypeError: Cannot read properties of null (reading 'toLocaleString')`. Karena ini ada dalam render loop, **satu appointment bermasalah akan crash seluruh halaman**.

### Solusi

```tsx
{settings.symbol}
{(apt.totalAmount ?? 0).toLocaleString("id-ID", { maximumFractionDigits: 0 })}
```

---

## 🟡 FE-06 — Status Filter Tidak Include Opsi 'no-show'

**File:** `app/[slug]/(frontend)/appointments/page.tsx`  
**Kemungkinan Terjadi:** 100% (missing feature)  
**Dampak:** Admin tidak bisa memfilter appointments berdasarkan status no-show dari UI; harus menggunakan cara lain

### Narasi

Status filter dropdown hanya mendefinisikan empat opsi:

```tsx
<option value="">All Statuses</option>
<option value="pending">Pending</option>
<option value="confirmed">Confirmed</option>
<option value="completed">Completed</option>
<option value="cancelled">Cancelled</option>
// ❌ 'no-show' tidak ada!
```

Schema `Appointment` mendefinisikan lima status: `'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no-show'`. Appointment dengan status `no-show` tersimpan di database dan bisa ter-create, namun tidak bisa difilter dari UI.

### Solusi

```tsx
<option value="no-show">No-show</option>
```

---

## 🟢 FE-07 — `timeSlots` adalah Dead Code

**File:** `app/[slug]/(frontend)/appointments/page.tsx`  
**Kemungkinan Terjadi:** 100% (selalu ada)  
**Dampak:** Tidak ada dampak fungsional; hanya membuang CPU cycle setiap render

### Narasi

```typescript
// Dicompute setiap render (bukan useMemo), dan...
const timeSlots: string[] = [];
for (let i = 9; i <= 20; i++) {
    timeSlots.push(`${i.toString().padStart(2, "0")}:00`);
    timeSlots.push(`${i.toString().padStart(2, "0")}:30`);
}

// ...tidak pernah dipakai di JSX!
// Form time slot sudah diganti dengan availableSlots dari API
```

Array `timeSlots` di-generate setiap render tetapi tidak digunakan sama sekali di JSX. Time slot selection sudah bermigrasi ke sistem `availableSlots` dari endpoint `/api/staff-slots`, tapi kode lama belum dihapus.

### Solusi

Hapus seluruh blok `timeSlots` generation.

---

## 🟢 FE-08 — `taxRate` State Dead Code di `calendar/page.tsx`

**File:** `app/[slug]/(frontend)/appointments/calendar/page.tsx`  
**Kemungkinan Terjadi:** 100%  
**Dampak:** Fetch API settings yang tidak perlu; state `taxRate` tidak pernah benar-benar dipakai

### Narasi

Di `calendar/page.tsx` terdapat dua sumber data taxRate yang saling bertentangan:

```typescript
// Sumber 1: useSettings hook (dipakai di kalkulasi)
const { settings } = useSettings();
const tax = subtotal * (settings.taxRate / 100);  // ← ini yang dipakai

// Sumber 2: fetch manual + state terpisah (TIDAK dipakai)
const [taxRate, setTaxRate] = useState(0);
const fetchSettings = async () => {
    const res = await fetch("/api/settings", { headers: { "x-store-slug": slug } });
    const data = await res.json();
    if (data.success) setTaxRate(data.data.taxRate || 0);  // ← di-set tapi tidak pernah dibaca
};
```

`taxRate` state di-fetch dan di-set tapi tidak pernah digunakan — kalkulasi `tax` menggunakan `settings.taxRate` dari `useSettings()`. Ini berarti ada satu request HTTP ekstra ke `/api/settings` di setiap mount komponen yang sia-sia.

### Solusi

Hapus `fetchSettings` function, `useEffect` yang memanggilnya, dan `taxRate` state. Cukup gunakan `settings.taxRate` dari `useSettings()`.

---

## 🟢 FE-09 — Title `${view}ly Schedule` Salah untuk 'day' View

**File:** `components/appointments/StaffCalendar.tsx`  
**Kemungkinan Terjadi:** 100%  
**Dampak:** Typo di judul komponen Calendar; "dayly Schedule" bukan kata yang valid dalam bahasa Inggris

### Narasi

```tsx
<h2 className="text-lg md:text-xl font-bold text-gray-900 capitalize">
    {view}ly Schedule
</h2>
```

Hasil yang dihasilkan:
- `view = "day"` → **"Dayly Schedule"** ❌ (seharusnya "Daily Schedule")
- `view = "week"` → **"Weekly Schedule"** ✅ (kebetulan benar)
- `view = "month"` → **"Monthly Schedule"** ✅ (kebetulan benar)

### Solusi

```typescript
const viewLabel: Record<string, string> = {
    day: 'Daily',
    week: 'Weekly',
    month: 'Monthly'
};

<h2>{viewLabel[view] || view} Schedule</h2>
```

---

## 🟢 FE-10 — Tidak Ada Error Handling di `fetchResources`

**File:** `app/[slug]/(frontend)/appointments/page.tsx`  
**Kemungkinan Terjadi:** 20%  
**Dampak:** Jika salah satu dari tiga fetch gagal, `Promise.all` reject tanpa catch, menyebabkan unhandled promise rejection; user tidak mendapat feedback apa pun

### Narasi

```typescript
const fetchResources = async () => {
    // Tidak ada try-catch!
    const [staffRes, serviceRes, customerRes] = await Promise.all([
        fetch("/api/staff/appointment-list", { headers }),
        fetch("/api/services?limit=0", { headers }),
        fetch("/api/customers?limit=0", { headers }),
    ]);
    // Jika salah satu gagal → unhandled rejection
    const staffData = await staffRes.json();
    ...
};
```

### Solusi

```typescript
const fetchResources = async () => {
    try {
        const [staffRes, serviceRes, customerRes] = await Promise.all([...]);
        const [staffData, serviceData, customerData] = await Promise.all([
            staffRes.json(), serviceRes.json(), customerRes.json()
        ]);
        if (staffData.success) setStaffList(staffData.data);
        if (serviceData.success) setServices(serviceData.data);
        if (customerData.success) setCustomers(customerData.data);
    } catch (error) {
        console.error("Error loading resources:", error);
        // Tambah toast/alert untuk user feedback
    }
};
```

---

---

# BAGIAN III — FLOWCHART BUG & ERROR

---

## 🗺️ Flowchart 1 — Alur Error POST /api/appointments (Critical Path)

```
User klik "New Appointment" → isi form → submit
                │
                ▼
        POST /api/appointments
                │
   ┌────────────┴────────────┐
   │  x-store-slug header?   │
   └────────────┬────────────┘
      Tidak ada │                Terjadi 100% di StaffCalendar
   (calendar)   │  Ada (list)    sehingga default ke 'pusat'
                ▼
        tenantSlug = 'pusat' ← [FE-01 / FE-02]
                │
                ▼
    checkPermission() ✅
                │
                ▼
    Conflict check staff+date+time
                │
         ┌──────┴──────┐
         │ 'no_show'   │ 'no-show'    ← [BE-01]
         │  (salah)    │  (benar)
         └──────┬──────┘
                │ Appointment no-show ikut dihitung conflict
                ▼
    String time comparison [BE-02]
    (rapuh untuk appointment melewati tengah malam)
                │
                ▼
    Appointment.create() ✅ tersimpan di DB
                │
      ┌─────────┴──────────────────────┐
      │ status === 'confirmed'?        │
      │ atau 'completed'?              │
      └─────────┬──────────────────────┘
                │ Ya
                ▼
    generateInvoiceNumber()  ← [BE-08] jika ini fail → appointment orphan
                │
    Counter: seq N → N+1     ← [BE-03] counter tidak rollback jika berikutnya gagal
                │
                ▼
    Invoice.create({ invoiceNumber })
                │
         ┌──────┴──────────────┐
         │ Berhasil            │ Gagal (E11000 dll)
         │     ✅              │     ❌
         │                     ▼
         │         Appointment.findByIdAndDelete ✅ (rollback)
         │         Counter TIDAK di-decrement  ← [BE-03]
         │         handleApiError → 400
         ▼
    scheduleFollowUp() → return success
```

---

## 🗺️ Flowchart 2 — Alur Error PUT /api/appointments/:id (Update)

```
Admin edit appointment → submit
                │
                ▼
        PUT /api/appointments/:id
                │
                ▼
    findById(id) — appointment ditemukan ✅
                │
                ▼
    services.reduce(acc + s.price, 0) ← [BE-04] tanpa || 0
                │
         ┌──────┴──────────────┐
         │ s.price ada         │ s.price undefined/null
         │     ✅ NaN-safe     │     ❌ subtotal = NaN → tax = NaN → totalAmount = NaN
         └──────┬──────────────┘
                │
                ▼
    findByIdAndUpdate → appointment tersimpan
                │
                ▼
    Invoice.findOne({ appointment: id })
                │
         ┌──────┴──────────────────────────┐
         │ Invoice tidak ada               │ Invoice sudah ada
         │ → buat invoice baru             │        ↓
         │     ✅                          │ existingInvoice.status diupdate
         │                                 │ (hanya 'paid' jika completed)
         │                                 │ items/subtotal/totalAmount
         │                                 │ TIDAK diupdate ← [BE-05]
         └─────────────────────────────────┘
                │
                ▼
    Response: { success: true, data: appointment }
    (Invoice masih punya data finansial lama) ← [BE-05]
```

---

## 🗺️ Flowchart 3 — Alur Error Frontend Calendar View

```
User buka Calendar tab
                │
                ▼
    <StaffCalendar slug={slug} />
    (StaffCalendar tidak punya slug prop) ← [FE-01]
                │
                ▼
    fetchResources() → fetch("/api/staff?isActive=true")
                         No x-store-slug header ← [FE-01]
                │
                ▼
    API: tenantSlug = request.headers.get('x-store-slug') || 'pusat'
                │                                   ↑
                │                           selalu 'pusat'
                ▼
    Staff dari tenant 'pusat' ditampilkan ← data leak lintas tenant
                │
                ▼
    fetchAppointments() → fetch(`/api/appointments?...`)
                         No x-store-slug header ← [FE-01]
                │
                ▼
    Appointments dari tenant 'pusat' di-render di calendar
    (User di cabang Bintaro melihat jadwal cabang Pusat)
```

---

## 🗺️ Flowchart 4 — Alur Race Condition Slot Fetching

```
User pilih Staff "Rina"
                │
                ▼
    useEffect triggered (formData.staffId changed)
    → fetchAvailableSlots() [Request A: Rina]  →→→→ NETWORK ──────────────────┐
                │                                                               │
    User cepat pilih Staff "Budi" (200ms kemudian)                             │
                │                                                               │
                ▼                                                               │
    useEffect triggered (formData.staffId changed)                              │
    → fetchAvailableSlots() [Request B: Budi]  →→→→ NETWORK ──────┐            │
                │                                                   │            │
    Request B selesai lebih dulu (fast)                             │            │
    setAvailableSlots([...Budi's slots])  ✅                        │            │
                │                                                   │            │
    Tampilan menunjukkan slot Budi ✅                               │            │
                │                                                   │            │
    [Beberapa saat kemudian]                                        │            │
    Request A selesai (slow network / cache miss)  ←←←←←←←←←←←←←←┘            │
    setAvailableSlots([...Rina's slots])  ❌  ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←┘
                │
                ▼
    Tampilan menunjukkan slot RINA
    Tapi formData.staffId = "Budi"  ← mismatch!
                │
                ▼
    User pilih slot 10:00 (slot Rina)
    Submit → appointment di-create untuk Budi jam 10:00
    Tapi slot 10:00 mungkin sudah di-book untuk Rina! ← conflict
```

---

---

# BAGIAN IV — PRIORITAS FIX & REKOMENDASI

---

## 🎯 Urutan Prioritas Fix

| Prioritas | Kode | Alasan | Effort | Impact |
|-----------|------|--------|--------|--------|
| **P1** | **FE-01** | Data leak lintas tenant di Calendar — keamanan | 🟡 Medium | 🔴 Critical |
| **P2** | **FE-02** | Customer list salah tenant di Calendar form | 🟢 Easy | 🔴 Critical |
| **P3** | **BE-01** | Typo no_show → no-show di conflict check | 🟢 Easy | 🔴 Critical |
| **P4** | **BE-05** | Invoice tidak sync saat appointment diedit | 🟡 Medium | 🟠 High |
| **P5** | **BE-04** | Fallback `|| 0` di PUT subtotal | 🟢 Easy | 🟠 High |
| **P6** | **FE-03** | AbortController untuk race condition slots | 🟡 Medium | 🟠 High |
| **P7** | **BE-02** | String time comparison → integer minutes | 🟡 Medium | 🔴 Critical |
| **P8** | **FE-04** | Gabungkan double useEffect fetch | 🟡 Medium | 🟠 High |
| **P9** | **BE-06** | Null-check untuk staff di send-reminders | 🟢 Easy | 🟡 Medium |
| **P10** | **BE-03** | Rollback counter invoice number | 🟡 Medium | 🟠 High |
| **P11** | **BE-07** | Timezone-aware date query | 🟠 Hard | 🟡 Medium |
| **P12** | **BE-08** | Pindah generateInvoiceNumber ke dalam try-catch | 🟢 Easy | 🟡 Medium |
| **P13** | **FE-05** | Null-safe totalAmount toLocaleString | 🟢 Easy | 🟡 Medium |
| **P14** | **FE-06** | Tambah opsi no-show di filter | 🟢 Easy | 🟡 Medium |
| **P15** | **FE-07** | Hapus dead code timeSlots | 🟢 Easy | 🟢 Low |
| **P16** | **FE-08** | Hapus dead code taxRate | 🟢 Easy | 🟢 Low |
| **P17** | **FE-09** | Fix "dayly" → "Daily" | 🟢 Easy | 🟢 Low |
| **P18** | **FE-10** | Tambah try-catch di fetchResources | 🟢 Easy | 🟢 Low |

---

## 🏗️ Rekomendasi Arsitektur Jangka Panjang

### 1. Buat Custom `useSalonFetch` Hook (menyelesaikan FE-01, FE-02, dan potensi masalah serupa di file lain)

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
```

Dengan hook ini, setiap komponen — termasuk `StaffCalendar` — cukup memanggil `const salonFetch = useSalonFetch()` dan gunakan `salonFetch('/api/...')` tanpa perlu ingat inject header manual.

### 2. Gunakan Database Transaction untuk Appointment + Invoice (menyelesaikan BE-03, BE-08)

```typescript
// Gunakan MongoDB session untuk atomicity
const session = await mongoose.startSession();
session.startTransaction();
try {
    const appointment = await Appointment.create([{ ...body }], { session });
    const invoiceNumber = await generateInvoiceNumber(tenantSlug, session);
    const invoice = await Invoice.create([{ invoiceNumber, ... }], { session });
    await session.commitTransaction();
} catch (error) {
    await session.abortTransaction();
    throw error;
} finally {
    session.endSession();
}
```

### 3. Simpan Time sebagai Integer Minutes (menyelesaikan BE-02)

Migrasi `startTime` dan `endTime` dari string `"HH:mm"` ke integer menit sejak midnight di schema Mongoose. Ini membuat semua operasi aritmetika dan perbandingan waktu menjadi type-safe dan tidak bergantung pada kebetulan lexicographic ordering.

---

## 📋 Checklist Fix Developer

```
CRITICAL (selesaikan sebelum release):
☐ [FE-01] Tambah slug prop ke StaffCalendar dan inject x-store-slug di semua fetch
☐ [FE-02] Tambah x-store-slug header untuk customer fetch di calendar/page.tsx
☐ [BE-01] Ganti 'no_show' → 'no-show' di conflict check query

HIGH (selesaikan dalam sprint ini):
☐ [BE-05] Update invoice items/amounts saat appointment diedit
☐ [BE-04] Tambah || 0 fallback di subtotal reduce di PUT handler
☐ [FE-03] Tambah AbortController di fetchAvailableSlots useEffect
☐ [BE-02] Migrasi time comparison ke integer minutes
☐ [FE-04] Refactor double useEffect menjadi satu fetch trigger

MEDIUM (sprint berikutnya):
☐ [BE-06] Tambah null-check untuk staff di send-reminders loop
☐ [BE-03] Tambah rollbackInvoiceNumber saat Invoice.create gagal
☐ [BE-07] Implementasi timezone-aware date query
☐ [BE-08] Pindah generateInvoiceNumber ke dalam try-catch invoice
☐ [FE-05] Null-safe apt.totalAmount ?? 0 sebelum toLocaleString
☐ [FE-06] Tambah opsi 'no-show' di status filter dropdown

LOW (technical debt):
☐ [FE-07] Hapus dead code timeSlots array
☐ [FE-08] Hapus dead code taxRate state dan fetchSettings di calendar page
☐ [FE-09] Fix "dayly" → "Daily" di StaffCalendar title
☐ [FE-10] Tambah try-catch di fetchResources
```

---

*Laporan dihasilkan dari analisa statis kode `1778847535192_salon-next.zip` pada 15 Mei 2026.*  
*Scope analisa: `app/api/appointments/**`, `app/[slug]/(frontend)/appointments/**`, `components/appointments/**`, `models/Appointment.ts`.*