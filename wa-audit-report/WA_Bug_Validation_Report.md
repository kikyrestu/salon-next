# 🔍 Laporan Validasi Bug — Fitur WA & Module WA
### Proyek: `salon-next` | Scope: WhatsApp Features & WA Module
> **Tanggal Analisis:** 18 Mei 2026 | **Analyst:** Code Review via Source Audit | **Status:** ✅ Tervalidasi

---

## 📊 Ringkasan Eksekutif

| # | Bug Yang Dilaporkan Klien | Status Validasi | Severity |
|---|---|---|---|
| 1 | Automated WA Rules — Daily Report & Stock Alert tidak masuk | ✅ **TERKONFIRMASI** — 4 root cause | 🔴 Critical |
| 2 | Past Blast History tidak muncul | ✅ **TERKONFIRMASI** — 2 root cause | 🟡 High |
| 3 | Automation yang sudah dibuat tidak bisa di-edit | ✅ **TERKONFIRMASI** — fitur tidak ada di frontend | 🟡 High |

> **Catatan:** Blast Campaign ✅ dan WA Follow Up Service ✅ sudah berfungsi dengan benar sesuai konfirmasi klien.

---

## 🔴 BUG #1 — Automated WA Rules: Daily Report & Stock Alert Tidak Masuk

### Narasi Masalah

Klien membuat **WA Automation Rule** untuk Daily Report (laporan harian pemilik) dan Stock Alert (peringatan stok habis), namun WA tidak pernah masuk ke nomor yang dituju. Setelah audit kode secara mendalam, ditemukan **4 root cause yang saling terkait** yang menyebabkan sistem automation rules secara keseluruhan tidak dapat berjalan di production.

---

### Root Cause #1-A — Frontend Ping Tanpa Authorization Header (CRITICAL)

**File:** `app/[slug]/(frontend)/wa-marketing/page.tsx` (baris ~198)
**File:** `app/api/wa/cron/route.ts` (baris 7–10)

**Masalah:**
Frontend melakukan ping ke `/api/wa/cron` setiap 30 detik untuk memicu scheduler. Tetapi ping dilakukan **tanpa Authorization header**:

```typescript
// ❌ SEKARANG — tidak ada header Authorization
fetch('/api/wa/cron').catch(() => {});
```

Sementara endpoint `/api/wa/cron` melakukan validasi keamanan:

```typescript
// app/api/wa/cron/route.ts
const authHeader = req.headers.get('authorization');
const cronSecret = process.env.CRON_SECRET;
if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
}
```

**Dampak:** Jika variabel `CRON_SECRET` di-set di environment production (Vercel, Railway, dll — yang mana ini adalah **praktik standar keamanan**), maka **100% dari seluruh ping frontend akan mengembalikan HTTP 401**. Scheduler tidak pernah jalan. Kampanye tidak pernah diproses. Automation rules tidak pernah dieksekusi. Error ini terjadi secara **silent** — tidak ada error message di UI, `fetch().catch(() => {})` menyembunyikan semua error.

**Solusi:**

```typescript
// ✅ PERBAIKAN — tambahkan Authorization header
fetch('/api/wa/cron', {
  headers: {
    'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || ''}`,
  }
}).catch(() => {});
```

> **Alternatif yang lebih aman:** Buat endpoint terpisah khusus untuk ping internal frontend (tanpa auth check), dan endpoint ber-autentikasi khusus untuk cron external.

---

### Root Cause #1-B — Time Window Terlalu Sempit & Scheduler Bergantung pada Page Terbuka

**File:** `lib/scheduler.ts` (baris 338–352)

**Masalah:**
Fungsi `processAutomations()` hanya akan mengeksekusi sebuah rule jika `scheduleTime`-nya berada dalam window **±5 menit ke belakang** dari waktu sekarang:

```typescript
const timeWindowMinutes = 5;
const validTimeSlots = new Set<string>();
for (let offset = -timeWindowMinutes; offset <= 0; offset++) {
    // Build valid HH:MM slots from -5min to now
}
// ...
if (rule.scheduleTime && !validTimeSlots.has(rule.scheduleTime)) continue; // ← SKIP!
```

Jika automation di-set jam `09:00` WIB, rule hanya bisa dieksekusi antara pukul **08:55–09:00**. Di luar jendela itu, rule dilewati (skip) dan **tidak akan dieksekusi lagi hari itu**.

Masalah bertambah berat karena:
- Scheduler **hanya berjalan** ketika halaman WA Marketing sedang terbuka di browser
- Ping setiap 30 detik → hanya 10 peluang dalam 5 menit
- Jika tidak ada pengguna yang membuka halaman pada jam tersebut → **rule terlewat untuk seluruh hari**

**Solusi:**

```typescript
// ✅ Perluas window menjadi 30-60 menit, atau gunakan deduplikasi tanggal saja
const timeWindowMinutes = 30; // Lebih toleran terhadap keterlambatan scheduler

// ✅ ATAU: Gunakan external cron (Vercel Cron Jobs / Uptime Robot) yang memanggil
// /api/cron/wa-daily-report setiap hari di jam tertentu secara otomatis
```

---

### Root Cause #1-C — Flag `lowStockNotifSent` Tidak Pernah Di-reset

**File:** `app/api/cron/wa-stock-alert/route.ts` (baris ~55) & `lib/scheduler.ts` (baris 487)

**Masalah:**
Setelah stock alert WA berhasil terkirim, produk di-flag:

```typescript
await Product.updateMany(
    { _id: { $in: ids } },
    { $set: { lowStockNotifSent: true } }  // ← Ditandai PERMANEN
);
```

Scheduler juga memfilter:

```typescript
const products = await Product.find({
    lowStockNotifSent: { $ne: true },  // ← Tidak akan pernah dinotif lagi!
    $expr: { $lte: ['$stock', '$alertQuantity'] }
});
```

**Dampak:** Setelah sekali notif terkirim, flag `lowStockNotifSent: true` TIDAK PERNAH di-reset. Jika admin melakukan restok → stok naik → kemudian stok turun lagi → **notif stock alert tidak akan pernah muncul lagi selamanya** untuk produk tersebut.

**Solusi:**

```typescript
// ✅ Reset flag saat stok kembali di atas threshold
// Tambahkan ke route update stok / inventory:
if (updatedProduct.stock > updatedProduct.alertQuantity) {
    updatedProduct.lowStockNotifSent = false;
    await updatedProduct.save();
}

// ✅ ATAU: Gunakan tanggal terakhir notif, bukan boolean
// lastStockAlertSent: Date (reset setiap hari atau setelah stok recovery)
```

---

### Root Cause #1-D — Frekuensi Weekly/Monthly Menggunakan Server Timezone (bukan WIB)

**File:** `lib/scheduler.ts` (baris 368–374)

**Masalah:**
Untuk automation dengan frekuensi `weekly` dan `monthly`, hari/tanggal diperiksa menggunakan **server local time** bukan WIB:

```typescript
// ❌ now.getDay() → menggunakan UTC server time
const jsDay = now.getDay();
const isoDay = jsDay === 0 ? 7 : jsDay;
if (!scheduleDays.includes(isoDay)) continue;

// ❌ now.getDate() → UTC, bukan WIB
const dayOfMonth = now.getDate();
if (!scheduleDays.includes(dayOfMonth)) continue;
```

**Dampak:** Di server UTC (Vercel dll.), hari/tanggal bisa berbeda 7 jam dari WIB. Rule mingguan yang seharusnya jalan Senin WIB bisa terdeteksi sebagai Minggu UTC.

**Solusi:**

```typescript
// ✅ Gunakan Intl untuk timezone-aware day/date
const tz = 'Asia/Jakarta';
const isoDay = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' })
    .format(now) === 'Mon' ? '1' : /* ... */);
// Atau gunakan library date-fns-tz yang lebih praktis
```

---

### 🗺️ Flowchart Bug #1 — Automation Rules Flow

```
[User Buat Automation Rule di UI]
           │
           ▼
    [WaAutomation.create() di DB]
    {isActive: true, scheduleTime: "09:00", category: "daily_report"}
           │
           ▼
    [Frontend WA Marketing Page Terbuka?]
           │
    ┌──────┴──────┐
   YA             TIDAK
    │               │
    ▼               ▼
[Ping /api/wa/cron  [❌ SCHEDULER TIDAK JALAN SAMA SEKALI]
 setiap 30 detik]   [Rule di-skip selamanya untuk hari itu]
    │
    ▼
[CRON_SECRET di-set di ENV?]
    │
 ┌──┴──┐
YA     TIDAK
 │       │
 ▼       ▼
[❌ 401   [processAutomations() dipanggil]
Unauthorized]       │
[Silent fail]       ▼
              [Cek: apakah waktu sekarang dalam
               window ±5 menit dari scheduleTime?]
                    │
              ┌─────┴─────┐
          TIDAK (miss)     YA
              │             │
              ▼             ▼
         [❌ Rule di-skip] [Proses kategori rule]
                             │
                    ┌────────┼────────┐
                    │                 │
               daily_report      stock_alert
                    │                 │
                    ▼                 ▼
              [Kirim WA via     [Cek lowStockNotifSent?]
               Fonnte API]           │
                    │          ┌─────┴─────┐
                    ▼         true        false
               [✅ Berhasil]   │             │
                               ▼             ▼
                          [❌ Skip —    [Kirim WA]
                           Tidak        Tandai sent=true
                           pernah       (PERMANEN ❌)]
                           notif lagi]
```

---

## 🟡 BUG #2 — Past Blast History Tidak Muncul

### Narasi Masalah

Klien telah berhasil mengirim beberapa blast campaign, namun tab **"Blast History"** selalu kosong. Investigasi kode menunjukkan bahwa data history bersumber dari koleksi `WaBlastLog` yang berbeda dari `WaCampaignQueue`, dan ada kondisi khusus yang harus terpenuhi sebelum history bisa ditulis.

---

### Root Cause #2-A — WaBlastLog Hanya Dibuat Saat Campaign SELESAI SEPENUHNYA

**File:** `lib/scheduler.ts` (baris 155–190)

**Masalah:**
`WaBlastLog.create()` hanya dipanggil dalam **dua kondisi**:
1. Ketika semua target sudah diproses (`pendingTargets.length === 0`)
2. Ketika failure rate melebihi 30%

```typescript
// ✅ Log dibuat HANYA ketika semua pending habis
if (pendingTargets.length === 0) {
    campaign.status = hasFailed ? 'partially_failed' : 'completed';
    await WaBlastLog.create({ ... }); // ← Baru tersimpan di sini
    continue;
}
```

**Dampak rantai:** Jika scheduler tidak berjalan karena Bug #1 (CRON_SECRET 401), campaign tetap berstatus `processing` atau `pending` selamanya → `WaBlastLog.create()` tidak pernah dipanggil → halaman History selalu kosong.

Bahkan jika scheduler jalan parsial (server restart di tengah pengiriman, Vercel function timeout setelah 60 detik), campaign tidak mencapai state `completed` → log tidak terbuat.

---

### Root Cause #2-B — API `blast-logs` Hanya Query `WaBlastLog`, Bukan `WaCampaignQueue`

**File:** `app/api/wa/blast-logs/route.ts`

**Masalah:**
Endpoint history hanya membaca dari koleksi `WaBlastLog`:

```typescript
const [logs, total] = await Promise.all([
    WaBlastLog.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('sentBy', 'name')
        .select('-recipients')
        .lean(),
    WaBlastLog.countDocuments(),
]);
```

Sementara campaign yang masih dalam status `completed` di `WaCampaignQueue` (namun belum di-log ke `WaBlastLog`) tidak ikut terbaca. Tidak ada fallback ke `WaCampaignQueue` untuk campaign yang sudah selesai.

**Solusi:**

```typescript
// ✅ Opsi 1: Perbaiki Bug #1 agar scheduler berjalan → WaBlastLog otomatis terpopulasi

// ✅ Opsi 2: Tambahkan fallback query ke WaCampaignQueue
// untuk campaign yang sudah completed tapi belum ada di WaBlastLog
const completedCampaigns = await WaCampaignQueue.find({
    status: { $in: ['completed', 'partially_failed'] }
}).sort({ updatedAt: -1 }).lean();

// Merge dengan WaBlastLog yang sudah ada
```

---

### 🗺️ Flowchart Bug #2 — Blast History Flow

```
[User Klik Send Blast]
         │
         ▼
[POST /api/wa/blast-targets]
         │
         ▼
[WaCampaignQueue.create({status: 'pending'})]
         │
         ▼
[Scheduler dipicu via /api/wa/cron]
         │
    ┌────┴────┐
  GAGAL      BERHASIL
(Bug #1)       │
    │          ▼
    │    [Campaign diproses target by target]
    │    [Delay 8–15 detik per pesan]
    │          │
    │     ┌────┴────┐
    │  TIMEOUT/    SELESAI
    │  RESTART      PENUH
    │     │           │
    │     ▼           ▼
    │  [Campaign     [WaCampaignQueue
    │   tetap di      .status = 'completed']
    │   'processing']       │
    │     │                 ▼
    ▼     ▼         [WaBlastLog.create() ✅]
[❌ WaBlastLog TIDAK PERNAH DIBUAT]
         │
         ▼
[GET /api/wa/blast-logs]
         │
         ▼
[WaBlastLog.find() → kosong / data tidak lengkap]
         │
         ▼
[Frontend menampilkan "Belum ada blast yang dikirim" ❌]
```

---

## 🟡 BUG #3 — Automation yang Sudah Dibuat Tidak Bisa Di-Edit

### Narasi Masalah

Klien membuat automation rule, kemudian ingin mengubah isi pesan, jadwal, atau konfigurasi lainnya. Namun tidak ada cara untuk melakukannya — tidak ada tombol Edit, tidak ada modal, tidak ada form edit. Satu-satunya aksi yang tersedia adalah ON/OFF toggle dan Delete.

---

### Root Cause #3-A — Tidak Ada UI Edit di Frontend (Fitur Tidak Diimplementasikan)

**File:** `app/[slug]/(frontend)/wa-marketing/page.tsx` (baris ~1270–1330)

**Masalah:**
Di dalam kartu automation, hanya ada dua aksi:

```typescript
// 1. Toggle ON/OFF — hanya update isActive
<button onClick={async () => {
    await fetch(`/api/wa/automations/${rule._id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: !rule.isActive }), // ← Hanya field ini
    });
}}>

// 2. Hapus
<button onClick={async () => {
    await fetch(`/api/wa/automations/${rule._id}`, { method: "DELETE" });
}}>
```

**Tidak ada** tombol Edit. **Tidak ada** state `editingAutomation`. **Tidak ada** logika untuk mem-populate form dengan data automation yang sudah ada. **Tidak ada** PUT request dengan full payload.

---

### Root Cause #3-B — API Edit Sudah Ada, Tapi Tidak Pernah Dipanggil

**File:** `app/api/wa/automations/[id]/route.ts`

Backend `PUT /api/wa/automations/[id]` sudah tersedia dan mendukung semua field:

```typescript
// Backend SIAP tapi frontend tidak memanggilnya untuk edit
const { name, category, targetRole, frequency, scheduleDays, scheduleTime,
        daysBefore, messageTemplate, isActive } = body;

const automation = await WaAutomation.findByIdAndUpdate(id, update, { new: true });
```

Ini adalah kasus **"API exists, UI doesn't"** — kesenjangan antara backend yang sudah siap dan frontend yang belum mengimplementasikan fitur edit.

---

### Solusi — Implementasi Edit Modal

Berikut adalah yang perlu ditambahkan ke frontend:

**Step 1: Tambah State untuk Edit**

```typescript
// Tambahkan state di komponen
const [editingAutomation, setEditingAutomation] = useState<AutomationRule | null>(null);
const [editForm, setEditForm] = useState<Partial<AutomationRule>>({});
```

**Step 2: Tambah Tombol Edit di Kartu Automation**

```tsx
// Di dalam kartu automation, tambahkan tombol Edit
<button
  onClick={() => {
    setEditingAutomation(rule);
    setEditForm({ ...rule }); // Pre-populate form dengan data existing
  }}
  className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"
>
  <Pencil className="w-4 h-4" />
</button>
```

**Step 3: Tambah Modal Edit**

```tsx
{editingAutomation && (
  <Modal isOpen={!!editingAutomation} onClose={() => setEditingAutomation(null)}
         title="Edit Aturan Automasi">
    {/* Form yang sama dengan Add Automation, tapi pre-filled */}
    <div>
      <input value={editForm.name} onChange={...} />
      <select value={editForm.category} onChange={...} />
      {/* ... semua field ... */}
      <button onClick={async () => {
        const res = await fetch(`/api/wa/automations/${editingAutomation._id}`, {
          method: "PUT",
          headers: { "x-store-slug": slug, "Content-Type": "application/json" },
          body: JSON.stringify(editForm),
        });
        if (res.ok) {
          setEditingAutomation(null);
          fetchAutomations();
        }
      }}>
        Simpan Perubahan
      </button>
    </div>
  </Modal>
)}
```

---

### 🗺️ Flowchart Bug #3 — Automation Edit Flow

```
[User Klik Automation Card]
           │
           ▼
    [Aksi Yang Tersedia?]
           │
    ┌──────┴──────┐
  Toggle        Delete
  ON/OFF         │
    │             ▼
    ▼       [DELETE /api/wa/automations/:id]
[PUT {:isActive}]   ✅ (Berfungsi)
    ✅ (Berfungsi)

[Edit Automation?]
    │
    ▼
[❌ TIDAK ADA TOMBOL EDIT DI UI]
[❌ TIDAK ADA MODAL/FORM EDIT]
[❌ TIDAK ADA STATE editingAutomation]
    │
    ▼
[PUT /api/wa/automations/:id dengan full payload]
    ← ENDPOINT INI SUDAH ADA DAN SIAP ✅
    ← TAPI TIDAK PERNAH DIPANGGIL KARENA TIDAK ADA UI ❌
    │
    ▼
[User terpaksa: DELETE automation lama → CREATE ulang dari awal ❌]
[Kehilangan lastRunDate history ❌]
[Kerja ekstra yang tidak perlu ❌]
```

---

## 🛠️ Ringkasan Solusi & Prioritas Perbaikan

| # | Bug | File yang Perlu Diubah | Prioritas | Estimasi |
|---|---|---|---|---|
| 1A | Frontend ping tanpa auth header | `wa-marketing/page.tsx` | 🔴 P0 — Fix Dulu | 5 menit |
| 1B | Time window terlalu sempit | `lib/scheduler.ts` | 🔴 P0 | 10 menit |
| 1C | `lowStockNotifSent` tidak di-reset | Route update stok | 🟡 P1 | 30 menit |
| 1D | Timezone weekly/monthly salah | `lib/scheduler.ts` | 🟡 P1 | 20 menit |
| 2A | WaBlastLog bergantung pada Bug #1 | Selesai setelah fix 1A+1B | 🟡 P1 | — |
| 2B | Fallback query history | `blast-logs/route.ts` | 🟡 P1 | 30 menit |
| 3 | Tidak ada UI edit automation | `wa-marketing/page.tsx` | 🟡 P1 | 2-3 jam |

---

## 📋 Checklist Verifikasi Setelah Fix

Setelah semua fix diterapkan, lakukan pengujian berikut:

- [ ] Set `CRON_SECRET` di environment, buka halaman WA Marketing, cek apakah scheduler dipanggil tanpa 401 error di network tab
- [ ] Buat automation `daily_report` dengan `scheduleTime` 2 menit dari sekarang → tunggu → verifikasi WA masuk
- [ ] Buat automation `stock_alert` → kurangi stok produk di bawah threshold → verifikasi WA masuk → restok → kurangi lagi → verifikasi notif muncul lagi (test reset flag)
- [ ] Kirim blast campaign ke 2-3 kontak → tunggu proses selesai → buka tab History → verifikasi muncul
- [ ] Buka kartu automation yang sudah ada → klik Edit → ubah pesan → Simpan → verifikasi perubahan tersimpan

---

> **Dokumen ini merupakan hasil audit kode secara langsung terhadap source code `salon-next` dan bukan estimasi atau asumsi.**
> Semua baris kode yang dikutip merujuk ke file aktual dalam proyek.
