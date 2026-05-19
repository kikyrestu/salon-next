# 🔍 Bug & Error Analysis Report
## WA Marketing Tab — Blast Campaign & Automation

**Project:** Salon Next (Multi-tenant SaaS)  
**Scope:** `app/[slug]/(frontend)/wa-marketing/page.tsx` + Backend API `/app/api/wa/*` + `lib/scheduler.ts`  
**Tanggal Analisis:** 18 Mei 2026  
**Analis:** Code Audit Engine  

---

## 📊 Ringkasan Eksekutif

| Kategori | Jumlah Bug | Level Rata-rata |
|---|---|---|
| 🔴 Critical | 4 | 90–95% |
| 🟠 High | 5 | 70–88% |
| 🟡 Medium | 7 | 50–69% |
| 🟢 Low | 3 | 30–49% |
| **Total** | **19** | — |

Sistem WA Marketing memiliki **3 aliran utama** yang rentan: (1) Blast Campaign, (2) Scheduled Campaign, dan (3) Automation Rules. Temuan paling kritis berpusat pada **kebocoran secret ke client-side**, **double-send pada kampanye multi-batch**, dan **inkonsistensi kunci enkripsi Fonnte token**.

---

## 🗺️ Flowchart Bug & Error

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        USER ACTION: WA Marketing Page                   │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
             ┌───────────────┴────────────────┐
             ▼                                ▼
     ┌───────────────┐              ┌─────────────────────┐
     │  PAGE MOUNT   │              │   FETCH SERVICES     │
     │  useEffect    │              │ (slug missing dep)   │◄── [F-03] MEDIUM 65%
     └──────┬────────┘              └─────────────────────┘
            │
     ┌──────▼────────────────────────────────────────────────┐
     │  AUTO-PING /api/wa/cron (setiap 30 detik)             │
     │  Authorization: Bearer NEXT_PUBLIC_CRON_SECRET         │◄──── [F-01] CRITICAL 95%
     │  ⚠️ Secret ter-expose di client bundle!               │      Secret PUBLIC!
     │  ⚠️ Backend cek CRON_SECRET ≠ NEXT_PUBLIC_CRON_SECRET  │◄──── [F-09] CRITICAL 90%
     │      → Selalu 401 Unauthorized → ping tidak berguna   │
     └───────────────────────────────────────────────────────┘
            │
            │   ┌──────── TAB: BLAST CAMPAIGN ──────────────────────────┐
            ├──►│                                                        │
            │   │  FILTER TARGET CUSTOMER                               │
            │   │                                                        │
            │   │  fetchTargets() → GET /api/wa/blast-targets            │
            │   │    useCallback: deps = [lastVisitSince, serviceId,     │
            │   │      membershipTier, birthdayMonth, searchQuery]       │
            │   │    ⚠️ slug tidak ada di deps                           │◄── [F-03] MEDIUM
            │   │                                                        │
            │   │  [BACKEND GET blast-targets]                          │
            │   │    ├─ Query: customerQuery.waNotifEnabled: true        │
            │   │    └─ Returns: hanya customer WA enabled               │
            │   │                                                        │
            │   │  [FRONTEND] Tampilkan target list                      │
            │   │    ├─ selectAll() → cek selectedIds.size === targets.length│
            │   │    │   ⚠️ Harus dibandingkan dengan enabledTargets      │◄── [F-08] HIGH 75%
            │   │    │   disabled customers tidak bisa dipilih            │
            │   │    │   → "Unselect All" tidak pernah muncul            │
            │   │    └─ const enabledTargets = ... → TIDAK DIPAKAI       │◄── [F-07] MEDIUM 70%
            │   │                                                         │
            │   │  SEND MODE: "Kirim Sekarang"                           │
            │   │    POST /api/wa/blast-targets                          │
            │   │      └─ Create WaCampaignQueue { scheduledAt: now }    │
            │   │                                                        │
            │   │  SEND MODE: "Jadwalkan"                                │
            │   │    POST /api/wa/campaigns                              │
            │   │      ├─ Validate scheduledAt > 5 menit lalu           │
            │   │      ├─ Limit MAX_TARGETS = 500                        │
            │   │      │   ⚠️ blast-targets POST tidak ada limit!         │◄── [B-10] HIGH 80%
            │   │      └─ Create WaCampaignQueue { scheduledAt: future } │
            │   │                                                        │
            │   └────────────────────────────────────────────────────────┘
            │
            │   ┌──────── SCHEDULER TICK (setiap 5 menit) ─────────────┐
            ├──►│                                                        │
            │   │  processPendingCampaigns()                             │
            │   │    ├─ Cek jam operasional (08:00–20:00 WIB) ✓         │
            │   │    ├─ Cek daily limit & hourly limit ✓                 │
            │   │    ├─ findOneAndUpdate → claim 1 campaign per tenant   │◄── [B-11] MEDIUM 65%
            │   │    │   ⚠️ Hanya 1 campaign/tenant/tick                  │   (bottleneck)
            │   │    ├─ Filter pending targets (slice by remainingQuota) │
            │   │    └─ LOOP per target:                                 │
            │   │         ├─ Dedup check di WaBlastLog (24h)            │
            │   │         │   ⚠️ WaBlastLog hanya terisi SETELAH done   │◄── [B-03] CRITICAL 85%
            │   │         │   → In-progress campaign tidak ter-dedup    │
            │   │         │   → Double-send pada multi-batch campaign    │
            │   │         ├─ Replace {{nama_customer}}                   │
            │   │         ├─ addMessageVariation()                       │
            │   │         ├─ sendWhatsApp(phone, msg, token)             │
            │   │         │   ⚠️ token = decryptFonnteToken(...)          │
            │   │         │   ⚠️ Enkripsi gunakan 'utf8' key             │◄── [B-05] CRITICAL 88%
            │   │         │   ⚠️ Dekripsi generic gunakan 'hex' key      │
            │   │         │   → Key mismatch → decrypt failure prod!     │
            │   │         ├─ Delay 8–15s (ok) / 30–60s backoff (error)  │
            │   │         └─ Save status per-target (updateOne)          │
            │   │                                                        │
            │   │    ── Setelah batch selesai ──                         │
            │   │    ├─ stillPending? → set back to 'pending' ✓          │
            │   │    └─ allDone? → status 'completed'/'partially_failed' │
            │   │         └─ Create WaBlastLog (setelah semua selesai)  │
            │   │                                                        │
            │   └────────────────────────────────────────────────────────┘
            │
            │   ┌──────── TAB: BLAST HISTORY ───────────────────────────┐
            ├──►│                                                        │
            │   │  fetchHistory() → GET /api/wa/blast-logs               │
            │   │    [BACKEND]                                           │
            │   │    ├─ WaBlastLog.find() → TANPA LIMIT ke DB!           │◄── [B-01] CRITICAL 90%
            │   │    │   select('-recipients') OK tapi no DB-level page  │
            │   │    ├─ WaCampaignQueue.find({completed/failed})         │
            │   │    │   select('-targets.logId') → targets array PENUH  │◄── [B-06] HIGH 80%
            │   │    │   ⚠️ Tiap campaign bisa punya 500+ target docs    │
            │   │    ├─ Gabung + sort in-memory                          │
            │   │    └─ Slice in-memory (skip/limit)                     │
            │   │    ⚠️ Pagination implementasi server-side palsu!        │
            │   │                                                        │
            │   │  fetchQueue() → GET /api/wa/campaigns                  │
            │   │    [BACKEND]                                           │
            │   │    ├─ find({pending, processing}) tanpa limit          │◄── [B-07] MEDIUM 65%
            │   │    └─ populate('sentBy', 'name')                       │
            │   │                                                        │
            │   │  cancelCampaign(id) → DELETE /api/wa/campaigns?id=X    │
            │   │    [BACKEND]                                           │
            │   │    ├─ Cek if completed → tolak ✓                       │
            │   │    └─ ⚠️ TIDAK cek if 'processing'!                    │◄── [B-08] HIGH 72%
            │   │       → Campaign yg sedang kirim bisa dihapus          │
            │   │       → Pesan terkirim tapi record hilang               │
            │   │                                                        │
            │   │  Campaign Detail Modal:                                │
            │   │    ├─ ETA countdown per target                         │
            │   │    │   ⚠️ Asumsi 1 detik/target                        │◄── [F-05] HIGH 85%
            │   │    │   ⚠️ Aktual: 8–60 detik/target                    │
            │   │    │   → ETA bisa melesat 8–60× lebih cepat            │
            │   │    └─ refreshDetailCampaign(id)                        │
            │   │         ⚠️ slug tidak ada di useCallback deps          │◄── [F-04] MEDIUM 65%
            │   │                                                        │
            │   └────────────────────────────────────────────────────────┘
            │
            └──►┌──────── TAB: AUTOMATIONS ─────────────────────────────┐
                │                                                        │
                │  processAutomations()                                  │
                │    ├─ Bangun validTimeSlots (60 menit ke belakang)      │
                │    ├─ Untuk setiap rule:                               │
                │    │   ├─ if lastRunDate === todayStr → skip           │
                │    │   ├─ Cek frequency (weekly/monthly) ✓             │
                │    │   ├─ Cek scheduleTime in validTimeSlots           │
                │    │   │   ⚠️ Window hanya -60 menit ke belakang       │◄── [B-04] HIGH 82%
                │    │   │   → Rule 09:00 miss jika server restart 10:01 │
                │    │   │   → Tidak akan masuk window 09:00 - 10:00     │
                │    │   ├─ Atomic claim via findOneAndUpdate ✓           │
                │    │   └─ Execute rule (daily_report, stock_alert, ...) │
                │    │                                                   │
                │    │   [daily_report]                                  │
                │    │     ├─ Check hasRunToday() (CronDedup) ✓          │
                │    │     └─ markAsRun hanya kalau allSuccess           │
                │    │         ⚠️ Partial failure → lock tidak dicatat   │◄── [B-09] MEDIUM 60%
                │    │                                                   │
                │    │   [stock_alert]                                   │
                │    │     ├─ Skip dedup check (tidak ada hasRunToday)   │◄── [B-09] MEDIUM 60%
                │    │     └─ Update lowStockNotifSent setelah kirim ✓   │
                │    │                                                   │
                │    │   [birthday]                                      │
                │    │     └─ Tidak ada dedup WaBlastLog check           │◄── [B-09] MEDIUM 60%
                │    │         → Bisa kirim ulang jika lock gagal        │
                │    │                                                   │
                │    │   [membership_expiry / package_expiry]            │
                │    │     └─ startOfTarget/endOfTarget gunakan setHours  │◄── [B-12] MEDIUM 55%
                │    │         ⚠️ setHours tidak aware timezone!          │
                │    │         → Salah target pada server UTC            │
                │    │                                                   │
                │    │  [FRONTEND AUTOMATION FORM]                       │
                │    │   ├─ Validasi scheduleTime di POST ✓               │
                │    │   ├─ scheduleTime hanya wajib untuk beberapa cat. │
                │    │   │   ⚠️ membership/package_expiry tidak butuh     │◄── [F-06] LOW 45%
                │    │   │   scheduleTime tapi UI tetap tampilkan field  │
                │    │   └─ Save automation → if(res.ok) → sukses        │
                │    │       ⚠️ Error dari server tidak ditampilkan       │◄── [F-10] LOW 40%
                │    │       ke user kalau status 4xx                    │
                │    │                                                   │
                └───────────────────────────────────────────────────────┘
```

---

## 🔴 CRITICAL BUGS (90–95%)

---

### [F-01] Secret CRON_SECRET Bocor ke Client Bundle
**File:** `page.tsx` baris ~143–151  
**Level Risiko:** 🔴 CRITICAL — 95%

**Narasi:**  
Frontend melakukan auto-ping ke `/api/wa/cron` setiap 30 detik menggunakan:
```typescript
fetch('/api/wa/cron', {
  headers: { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || ''}` }
})
```
Setiap variabel environment yang diawali `NEXT_PUBLIC_` oleh Next.js **secara otomatis di-bundle ke dalam JavaScript client-side yang dapat dibaca siapapun** melalui browser DevTools atau view-source. Jika nilai `NEXT_PUBLIC_CRON_SECRET` diset, nilainya akan ter-expose sepenuhnya kepada publik.

**Dampak:** Siapapun yang memiliki akses ke halaman ini dapat membaca secret tersebut dan memanggil `/api/wa/cron` secara bebas, memicu pengiriman massal WA tanpa otentikasi.

**Solusi:**
```typescript
// JANGAN gunakan NEXT_PUBLIC_ untuk secret
// HAPUS auto-ping dari frontend sepenuhnya
// Gunakan Vercel Cron Jobs / external cron yang memanggil server-to-server
// Atau jika perlu ping dari client, gunakan Next.js Route Handler sebagai proxy:
// POST /api/internal/trigger-cron → server-side call dengan CRON_SECRET

// Di route handler server-side:
const secret = process.env.CRON_SECRET; // TIDAK public
```

---

### [F-09] Mismatch Env Variable: NEXT_PUBLIC_CRON_SECRET vs CRON_SECRET
**File:** `page.tsx` baris ~143 vs `app/api/wa/cron/route.ts` baris ~10  
**Level Risiko:** 🔴 CRITICAL — 90%

**Narasi:**  
Frontend mengirimkan token dari `NEXT_PUBLIC_CRON_SECRET`, namun backend memvalidasi terhadap `CRON_SECRET`:

```typescript
// Frontend (page.tsx)
'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || ''}`

// Backend (cron/route.ts)
const cronSecret = process.env.CRON_SECRET; // nama berbeda!
if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

Karena dua variable ini berbeda, ping dari frontend **selalu gagal dengan 401 Unauthorized** di environment production (di mana `NEXT_PUBLIC_CRON_SECRET` kemungkinan tidak di-set atau berbeda nilainya). Fitur auto-ping yang menjadi tulang punggung scheduler di development mode tidak pernah berhasil di production.

**Dampak:** Scheduler tidak akan pernah dipicu dari frontend. Kampanye yang dijadwalkan akan tertahan di queue selamanya kecuali ada external cron runner.

**Solusi:**
```typescript
// Hapus entirely auto-ping dari frontend.
// Setup Vercel Cron di vercel.json:
{
  "crons": [{
    "path": "/api/wa/cron",
    "schedule": "*/5 * * * *"
  }]
}
// Backend gunakan CRON_SECRET dari header Vercel-Cron-Secret
```

---

### [B-03] Double-Send: Dedup Tidak Cover In-Progress Campaign
**File:** `lib/scheduler.ts` baris ~186–196  
**Level Risiko:** 🔴 CRITICAL — 85%

**Narasi:**  
Scheduler mengecek duplikasi pengiriman dengan mencari record di `WaBlastLog`:
```typescript
const recentBlast = await WaBlastLog.findOne({
  'recipients.phone': target.phone,
  'recipients.status': 'sent',
  createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60_000) }
});
```
Masalahnya, `WaBlastLog` hanya **dibuat setelah seluruh campaign selesai** (ketika `pendingTargets.length === 0`). Untuk kampanye besar dengan 200+ targets yang membutuhkan beberapa "tick" scheduler (masing-masing memproses sebagian), **pada tick ke-2, ke-3, dst., check dedup di atas tidak akan menemukan record** apapun di `WaBlastLog` karena campaign belum selesai. Hasilnya, target yang sudah berhasil dikirim di tick sebelumnya bisa dikirim **ulang lagi** di tick berikutnya.

**Catatan Teknis:** Meskipun status per-target disimpan di `WaCampaignQueue.targets[].status`, dedup check tidak membaca collection tersebut.

**Dampak:** Pelanggan dalam kampanye besar menerima pesan WA yang sama 2x, 3x, atau lebih — sangat merusak kepercayaan dan meningkatkan risiko ban nomor WA.

**Solusi:**
```typescript
// Tambahkan dedup check ke WaCampaignQueue juga:
const alreadySentInQueue = await WaCampaignQueue.findOne({
  'targets.phone': target.phone,
  'targets.status': 'sent',
  createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60_000) }
});
if (alreadySentInQueue) {
  target.status = 'failed';
  target.error = 'Already sent within 24h (queue dedup)';
  continue;
}
```

---

### [B-05] Inkonsistensi Kunci Enkripsi Fonnte Token
**File:** `lib/encryption.ts` baris ~10, ~78–100  
**Level Risiko:** 🔴 CRITICAL — 88%

**Narasi:**  
Terdapat dua pasang fungsi enkripsi/dekripsi yang menggunakan pendekatan **pembuatan kunci berbeda** dari `ENCRYPTION_KEY` yang sama:

| Fungsi | Cara buat key |
|---|---|
| `encrypt()` / `decrypt()` | `Buffer.from(ENCRYPTION_KEY, 'hex')` — interpretasi sebagai hex (64 char hex = 32 bytes) |
| `encryptFonnteToken()` / `decryptFonnteToken()` | `Buffer.from(key, 'utf8')` dan dipotong ke 32 byte — interpretasi sebagai UTF-8 |

Dengan default key `'0'.repeat(64)`:
- `encrypt()` menghasilkan 32 bytes: `[0x00, 0x00, ..., 0x00]` (interpretasi hex)
- `encryptFonnteToken()` menghasilkan 32 bytes pertama dari `'000...000'` sebagai UTF-8: `[0x30, 0x30, ..., 0x30]` (karakter '0' = ASCII 48 = 0x30)

**Dua kunci yang berbeda sepenuhnya!** Jika key default ini dipakai di production, atau jika developer secara keliru menggunakan fungsi yang salah untuk decrypt, token akan **gagal didekripsi** dengan silent error — `decryptFonnteToken` mengembalikan string aslinya (encrypted), sehingga token yang dikirim ke Fonnte API adalah ciphertext, bukan plain token → **seluruh pengiriman WA gagal**.

**Solusi:**
```typescript
// Standardisasi satu cara buat key:
const getKey = () => {
  const keyHex = process.env.ENCRYPTION_KEY || '0'.repeat(64);
  // Selalu gunakan hex parsing untuk konsistensi
  return Buffer.from(keyHex.padEnd(64, '0').slice(0, 64), 'hex');
};
// Gunakan getKey() di SEMUA fungsi enkripsi/dekripsi
```

---

### [B-01] Pagination Blast-Logs Palsu: Full Table Scan ke Memory
**File:** `app/api/wa/blast-logs/route.ts` baris ~15–50  
**Level Risiko:** 🔴 CRITICAL — 90%

**Narasi:**  
Route ini menerima parameter `page` dan `limit`, tetapi seluruh paginasi dilakukan **di memory setelah mengambil semua dokumen** dari database:

```typescript
// MASALAH: Tidak ada limit/skip di level MongoDB
const [blastLogs, queuedLogs] = await Promise.all([
  WaBlastLog.find()           // ← ambil SEMUA blast logs!
    .populate('sentBy', 'name')
    .select('-recipients')
    .lean(),
  WaCampaignQueue.find({ status: { $in: ['completed', 'failed'] } })
    .select('-targets.logId') // ← targets array masih penuh!
    .lean(),
]);
// Sort + slice dilakukan di JavaScript, bukan di DB
const paginated = combined.slice(skip, skip + limit);
```

Untuk toko yang aktif dengan 100+ kampanye dan setiap kampanye berisi 200+ target, total data yang dimuat ke RAM bisa mencapai **puluhan hingga ratusan MB per request**. Ini akan menyebabkan timeout atau OOM crash di serverless environment seperti Vercel (batas memori 1GB per function).

**Solusi:**
```typescript
// Implementasi pagination di level DB:
const blastLogs = await WaBlastLog.find()
  .populate('sentBy', 'name')
  .select('-recipients')
  .sort({ createdAt: -1 })
  .skip(skip).limit(limit)
  .lean();

// Untuk WaCampaignQueue, hanya ambil field summary:
const queuedLogs = await WaCampaignQueue.find({ status: { $in: ['completed', 'failed'] } })
  .select('campaignName message scheduledAt createdAt targets.status sentBy')
  .sort({ scheduledAt: -1 })
  .skip(skip).limit(limit)
  .lean();
```

---

## 🟠 HIGH BUGS (70–88%)

---

### [F-05] ETA Countdown Campaign Detail: Asumsi 1 Detik vs Realitas 8–60 Detik per Pesan
**File:** `page.tsx` baris ~682–694  
**Level Risiko:** 🟠 HIGH — 85%

**Narasi:**  
Modal detail campaign menampilkan countdown ETA dengan kalkulasi:
```typescript
const waitSeconds = (pendingCount + 1) * 1; // ← 1 detik per target
```

Namun di scheduler, delay aktual per pesan adalah:
- **Pengiriman berhasil:** `8000 + Math.random() * 7000` = **8–15 detik**
- **Pengiriman gagal (backoff):** `30000 + Math.random() * 30000` = **30–60 detik**

Jika ada 20 pesan pending, ETA yang ditampilkan adalah **20 detik**, padahal realitasnya **2–20 menit**. User akan bingung kenapa countdown sudah selesai tapi pesan belum terkirim.

**Solusi:**
```typescript
// Gunakan estimasi yang lebih akurat (misalnya 12 detik average):
const AVERAGE_SEND_DELAY_SECONDS = 12;
const waitSeconds = (pendingCount + 1) * AVERAGE_SEND_DELAY_SECONDS;
// Dan tambahkan teks disclaimer: "Estimasi kasar, aktual bisa lebih lama"
```

---

### [F-08] selectAll() Membandingkan dengan `targets.length` Bukan `enabledTargets`
**File:** `page.tsx` baris ~238–244  
**Level Risiko:** 🟠 HIGH — 75%

**Narasi:**  
```typescript
const selectAll = () => {
  if (selectedIds.size === targets.length) { // ← bandingkan dengan TOTAL
    setSelectedIds(new Set());
  } else {
    setSelectedIds(new Set(targets.map((t) => t._id)));
  }
};
```

Jika ada beberapa customer dengan `waNotifEnabled === false` (ditampilkan dengan opacity 40% dan tidak bisa diklik), mereka tidak pernah masuk ke `selectedIds`. Maka `selectedIds.size` tidak pernah sama dengan `targets.length`. Kondisi untuk "Unselect All" **tidak pernah terpenuhi** — tombol selalu menampilkan "Select All" meskipun semua customer yang bisa dipilih sudah dipilih.

**Solusi:**
```typescript
const selectableTargets = targets.filter(t => t.waNotifEnabled !== false);
const selectAll = () => {
  if (selectedIds.size === selectableTargets.length) {
    setSelectedIds(new Set());
  } else {
    setSelectedIds(new Set(selectableTargets.map((t) => t._id)));
  }
};
```

---

### [B-06] `enabledTargets` Dideklarasikan tapi Tidak Pernah Digunakan
**File:** `page.tsx` baris ~247  
**Level Risiko:** 🟠 HIGH — 70%

**Narasi:**  
```typescript
const enabledTargets = targets.filter((t) => t.waNotifEnabled !== false);
```
Variabel ini dideklarasikan di level komponen tapi **tidak dipakai di satu pun JSX atau logic**. Ini menunjukkan adanya refactoring yang tidak selesai — kemungkinan seharusnya dipakai di `selectAll()` (lihat [F-08]) dan di counter UI ("X dipilih dari Y yang WA-enabled"). Saat ini counter menampilkan `{selectedIds.size} / {targets.length}` yang menyesatkan karena `targets.length` termasuk customer WA-disabled.

**Solusi:**
```typescript
// Ganti counter di UI:
<span>{selectedIds.size} / {enabledTargets.length} dipilih</span>
// Dan gunakan enabledTargets di selectAll()
```

---

### [B-08] DELETE Campaign Tidak Memblokir Status 'processing'
**File:** `app/api/wa/campaigns/route.ts` baris ~79–88  
**Level Risiko:** 🟠 HIGH — 72%

**Narasi:**  
```typescript
if (campaign.status === 'completed') {
  return NextResponse.json({ error: 'Cannot cancel completed campaign' }, { status: 400 });
}
// Tidak ada cek untuk 'processing'!
await WaCampaignQueue.findByIdAndDelete(id);
```

Ketika seorang user membatalkan campaign yang sedang aktif dikirim (`status: 'processing'`), record campaign dihapus dari database. Namun scheduler yang sedang berjalan di background masih memegang reference ke campaign object di memory dan akan terus mencoba melakukan `WaCampaignQueue.updateOne({ _id: campaign._id, ... })` — **operasi yang akan silently gagal** karena document sudah tidak ada. Selain itu, pesan sudah terlanjur dikirim ke sebagian target tanpa ada log tersimpan.

**Solusi:**
```typescript
if (['completed', 'processing'].includes(campaign.status)) {
  return NextResponse.json({ 
    success: false, 
    error: campaign.status === 'processing' 
      ? 'Campaign sedang diproses. Tunggu selesai atau kontak admin.' 
      : 'Campaign sudah selesai, tidak bisa dibatalkan.' 
  }, { status: 400 });
}
```

---

### [B-04] Automation Time Window Hanya Mundur: Rule Bisa Terlewat Jika Server Restart
**File:** `lib/scheduler.ts` baris ~340–352  
**Level Risiko:** 🟠 HIGH — 82%

**Narasi:**  
Untuk menentukan apakah suatu automation rule perlu dijalankan, scheduler membangun set waktu valid dengan window **hanya ke belakang (maks 60 menit)**:
```typescript
for (let offset = -timeWindowMinutes; offset <= 0; offset++) {
  // window dari (now - 60 menit) s/d now
}
```

Jika sebuah rule di-set jam **09:00**, dan server baru restart/ping pertama kali jam **10:05** (lebih dari 60 menit setelah jadwal), maka `validTimeSlots` akan berisi jam **09:05 hingga 10:05** — jam `09:00` **tidak ada** dalam set ini. Rule dilewati, tidak pernah dijalankan hari itu. Ini khususnya berbahaya untuk `daily_report` yang diharapkan pemilik salon menerima laporan setiap hari.

**Solusi:**
```typescript
// Gunakan pendekatan berdasarkan "sudahkah lewat jadwalnya hari ini":
if (rule.scheduleTime) {
  const [h, m] = rule.scheduleTime.split(':').map(Number);
  const scheduledToday = new Date(now);
  scheduledToday.setHours(h, m, 0, 0);
  // Jalankan jika jadwal sudah lewat hari ini dan belum pernah jalan
  if (now < scheduledToday) continue; // Belum waktunya
  // lastRunDate check sudah menangani "sudah jalan hari ini"
}
```

---

### [B-10] Blast Manual via blast-targets Tidak Ada Limit Target
**File:** `app/api/wa/blast-targets/route.ts` baris ~85  
**Level Risiko:** 🟠 HIGH — 80%

**Narasi:**  
Komentar di kode berbunyi `"Limit restriction removed to allow unlimited targets"`, namun `POST /api/wa/campaigns` (untuk scheduled campaign) tetap membatasi `MAX_TARGETS = 500`. Artinya terdapat **inkonsistensi proteksi** antara dua cara pengiriman yang secara fungsional sama:

| Jalur | Limit |
|---|---|
| "Jadwalkan" → `/api/wa/campaigns` POST | ✅ Max 500 |
| "Kirim Sekarang" → `/api/wa/blast-targets` POST | ❌ Tidak ada limit |

Blast manual dengan 2000+ target akan membuat satu `WaCampaignQueue` document berisi 2000+ subdocument target, yang bisa mencapai ukuran **8–16MB per document** — mendekati atau melebihi batas dokumen MongoDB (16MB).

**Solusi:**
```typescript
// Di blast-targets POST, tambahkan limit yang sama:
const MAX_TARGETS = 500; // atau nilai yang disepakati
if (customers.length > MAX_TARGETS) {
  return NextResponse.json({
    success: false,
    error: `Terlalu banyak target (${customers.length}). Pisahkan menjadi beberapa batch.`
  }, { status: 400 });
}
```

---

## 🟡 MEDIUM BUGS (50–69%)

---

### [F-03] Dependency `slug` Hilang di Semua useCallback Fetch Functions
**File:** `page.tsx` baris ~160–205  
**Level Risiko:** 🟡 MEDIUM — 65%

**Narasi:**  
Empat `useCallback` functions (`fetchHistory`, `fetchQueue`, `fetchAutomations`, `refreshDetailCampaign`) menggunakan variabel `slug` di dalam fetch request, namun tidak menyertakannya di dependency array:

```typescript
const fetchHistory = useCallback(async () => {
  const res = await fetch("/api/wa/blast-logs", { 
    headers: { "x-store-slug": slug } // slug dipakai
  });
  ...
}, []); // ← slug tidak ada di sini!
```

Di skenario multi-tenant dimana user berpindah toko (slug berubah tanpa full page reload), callback ini akan terus menggunakan `slug` dari closure lama, menampilkan data toko yang salah.

**Solusi:**
```typescript
const fetchHistory = useCallback(async () => {
  ...
}, [slug]); // Tambahkan slug
```

---

### [F-04] `refreshDetailCampaign` Missing Slug Dependency
**File:** `page.tsx` baris ~207–215  
**Level Risiko:** 🟡 MEDIUM — 65%

**Narasi:**  
```typescript
const refreshDetailCampaign = useCallback(async (id: string) => {
  const res = await fetch(`/api/wa/campaigns/${id}`, { 
    headers: { "x-store-slug": slug } // slug dipakai tapi...
  });
  ...
}, []); // ← tidak ada slug di deps
```

Sama dengan [F-03], potensi stale closure untuk multi-tenant navigation.

---

### [B-06_2] blast-logs Memuat `targets` Array Lengkap dari WaCampaignQueue
**File:** `app/api/wa/blast-logs/route.ts` baris ~35  
**Level Risiko:** 🟡 MEDIUM — 68%

**Narasi:**  
```typescript
WaCampaignQueue.find({ status: { $in: ['completed', 'failed'] } })
  .select('-targets.logId') // hanya exclude 1 field dari subdoc!
  .lean()
```

Untuk setiap campaign yang completed, MongoDB mengembalikan seluruh array `targets` yang bisa berisi ratusan subdokument. Jika ada 20 campaign completed masing-masing 100 targets, ini berarti **2000 subdokument** dimuat hanya untuk ditampilkan sebagai 20 baris di history. Field yang seharusnya di-project cukup `targets.status` untuk keperluan count sentCount/failedCount.

**Solusi:**
```typescript
.select('campaignName message scheduledAt createdAt sentBy targets.status')
```

---

### [B-07] GET /api/wa/campaigns Tidak Ada Pagination
**File:** `app/api/wa/campaigns/route.ts` baris ~19–27  
**Level Risiko:** 🟡 MEDIUM — 65%

**Narasi:**  
```typescript
const campaigns = await WaCampaignQueue.find({
  status: { $in: ['pending', 'processing'] }
}) // tidak ada limit
.sort({ scheduledAt: 1 })
.populate('sentBy', 'name')
.lean();
```

Jika ada puluhan campaign pending (misalnya user menjadwalkan 30 campaign sekaligus), semua dikembalikan sekaligus. Mengingat setiap campaign bisa memiliki ratusan targets dalam subdokument, response size bisa besar dan memperlambat rendering tab History.

---

### [B-09] Automation Non-Daily Tidak Konsisten dalam Penggunaan Dedup
**File:** `lib/scheduler.ts` baris ~398–520  
**Level Risiko:** 🟡 MEDIUM — 60%

**Narasi:**  
Hanya `daily_report` yang secara eksplisit memanggil `hasRunToday()` dari `CronDedup`. Category lain (`stock_alert`, `birthday`, `membership_expiry`, `package_expiry`) hanya mengandalkan `lastRunDate` di document `WaAutomation`. Jika pengiriman gagal dan lock di-unset via `$unset: { lastRunDate }`, rule tersebut akan mencoba lagi di tick berikutnya — **ini memang intended behavior**. Namun masalahnya:
- Untuk `stock_alert`: jika kirim ke phone 1 berhasil tapi phone 2 gagal, `sent = false`, `ruleSuccess = false`, lock di-unset → di tick berikutnya, **notifikasi kirim ulang ke phone 1 juga**.
- Tidak ada pencatatan `markAsRun()` untuk category selain `daily_report`.

---

### [B-12] setHours() Timezone-Naive untuk Membership/Package Expiry
**File:** `lib/scheduler.ts` baris ~435–455  
**Level Risiko:** 🟡 MEDIUM — 55%

**Narasi:**  
```typescript
const startOfTarget = new Date(targetDate);
startOfTarget.setHours(0, 0, 0, 0);    // ← timezone server (UTC!)
const endOfTarget = new Date(targetDate);
endOfTarget.setHours(23, 59, 59, 999); // ← timezone server (UTC!)
```

Jika server berjalan di UTC (umum di cloud), `setHours(0,0,0,0)` menghasilkan tengah malam UTC = 07:00 WIB. Pelanggan yang membership-nya berakhir tanggal 20 Mei (00:00 WIB) sebenarnya berakhir tanggal 19 Mei 17:00 UTC. Query dengan `startOfTarget` UTC akan **melewatkan atau mengirim notif di hari yang salah** untuk klien WIB.

**Solusi:**
```typescript
// Gunakan Intl.DateTimeFormat untuk membentuk startOfTarget di WIB:
const tz = 'Asia/Jakarta';
const y = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric' }).format(targetDate);
const mo = new Intl.DateTimeFormat('en-US', { timeZone: tz, month: '2-digit' }).format(targetDate);
const d = new Intl.DateTimeFormat('en-US', { timeZone: tz, day: '2-digit' }).format(targetDate);
const startOfTarget = new Date(`${y}-${mo}-${d}T00:00:00.000+07:00`);
const endOfTarget   = new Date(`${y}-${mo}-${d}T23:59:59.999+07:00`);
```

---

### [B-11] Satu Campaign per Tenant per Tick (Throughput Bottleneck)
**File:** `lib/scheduler.ts` baris ~170  
**Level Risiko:** 🟡 MEDIUM — 65%

**Narasi:**  
`findOneAndUpdate` hanya mengambil **satu campaign** per tenant per tick (5 menit). Untuk campaign dengan 200 targets dan delay 12 detik/target, total waktu pengiriman adalah **40 menit**. Jika ada 3 campaign berbeda yang dijadwalkan, campaign ke-3 baru mulai diproses setelah **80+ menit**, meskipun sudah melewati waktu jadwalnya.

---

## 🟢 LOW BUGS (30–49%)

---

### [F-10] Error Message Server Tidak Ditampilkan ke User di Automation Save
**File:** `page.tsx` baris ~834  
**Level Risiko:** 🟢 LOW — 40%

**Narasi:**  
```typescript
const res = await fetch(url, { method, ... });
if (res.ok) {
  // berhasil
} else alert("Gagal menyimpan"); // ← pesan error dari server dibuang!
```

Jika server mengembalikan `{ error: "Invalid scheduleTime format. Must be HH:MM" }` dengan status 400, user hanya melihat pesan generic "Gagal menyimpan" tanpa tahu penyebabnya.

**Solusi:**
```typescript
if (res.ok) {
  // ...
} else {
  const errData = await res.json().catch(() => ({}));
  alert(errData.error || "Gagal menyimpan");
}
```

---

### [F-06] `scheduleTime` Field Tampil untuk Category yang Tidak Membutuhkan
**File:** `page.tsx` baris ~793–810  
**Level Risiko:** 🟢 LOW — 45%

**Narasi:**  
Kondisi untuk menampilkan "Jam Eksekusi":
```typescript
{(autoForm.category === "daily_report" || 
  autoForm.category === "stock_alert" || 
  autoForm.category === "birthday") && (
  <input type="time" ... />
)}
```

Category `membership_expiry` dan `package_expiry` memiliki blok terpisah yang **juga** memiliki field `scheduleTime`. Namun kedua blok bisa tampil bersamaan, menyebabkan dua input `scheduleTime` terlihat di form saat user memilih `membership_expiry`. Secara fungsional hanya satu yang disimpan, tapi UI-nya confusing.

---

### [F-11] cancelCampaign Tidak Menampilkan Error ke User
**File:** `page.tsx` baris ~222–229  
**Level Risiko:** 🟢 LOW — 35%

**Narasi:**  
```typescript
const cancelCampaign = async (id: string) => {
  if (!confirm("Batalkan jadwal campaign ini?")) return;
  try {
    const res = await fetch(`/api/wa/campaigns?id=${id}`, { method: "DELETE" });
    if (res.ok) fetchQueue(); // berhasil
    // Jika gagal: tidak ada feedback ke user!
  } catch (e) {
    console.error(e); // hanya log, tidak tampil ke user
  }
};
```

Jika campaign tidak bisa dibatalkan (misalnya karena status 'processing' setelah fix [B-08] diimplementasi), user akan mengklik tombol Cancel, konfirmasi dialog muncul, tapi tampak tidak ada yang terjadi.

---

## 📋 Prioritas Perbaikan

| Prioritas | Bug ID | Estimasi Effort | Dampak Bisnis |
|---|---|---|---|
| 🔴 P1 | F-01, F-09 | 2 jam | Security + functionality |
| 🔴 P1 | B-03 | 4 jam | Double-send customer |
| 🔴 P1 | B-05 | 1 jam | Semua WA gagal (prod) |
| 🔴 P1 | B-01 | 3 jam | Server crash/timeout |
| 🟠 P2 | B-04 | 2 jam | Automation miss jadwal |
| 🟠 P2 | B-08 | 1 jam | Data corruption |
| 🟠 P2 | B-10 | 1 jam | Document size limit |
| 🟠 P2 | F-08, F-07 | 1 jam | UX select all broken |
| 🟠 P2 | F-05 | 30 menit | UX misleading ETA |
| 🟡 P3 | B-06, B-07 | 2 jam | Performance |
| 🟡 P3 | B-09, B-12 | 3 jam | Reliability |
| 🟡 P3 | F-03, F-04 | 30 menit | Multi-tenant correctness |
| 🟢 P4 | F-10, F-11, F-06 | 1 jam | UX polish |

---

## 🔧 Quick Wins (< 30 Menit Implementasi)

1. **Hapus `NEXT_PUBLIC_` prefix** dari cron secret env var dan pindahkan ping ke server-side API proxy.
2. **Rename env var** agar frontend dan backend gunakan nama yang sama, atau hapus frontend ping entirely.
3. **Tambahkan `enabledTargets`** ke `selectAll()` logic — satu baris fix.
4. **Tambahkan limit ke blast-targets POST** — 5 baris kode.
5. **Tambahkan `else alert(errData.error)` ke automation save** — 3 baris kode.
6. **Tambahkan cek `processing` status** di DELETE campaign — 3 baris kode.
7. **Tambahkan `[slug]` ke semua useCallback deps** — satu karakter per function.

---

*Report generated from static code analysis. Semua persentase adalah estimasi probabilitas bug aktif terjadi di kondisi production normal.*