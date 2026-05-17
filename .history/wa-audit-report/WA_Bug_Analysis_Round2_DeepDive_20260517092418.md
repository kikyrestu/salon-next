# 🔬 Laporan Analisis Bug & Error Lanjutan — Modul WA (Ronde 2)
**Proyek:** `salon-next` · **Fokus:** Deep-dive `lib/scheduler.ts`, `lib/encryption.ts`, `lib/tenantDb.ts`, cron routes, appointment reminder  
**Tanggal:** 16 Mei 2026 · **Ronde:** 2 dari 2  

> ⚠️ Ronde ini menemukan bug yang lebih dalam dan lebih berbahaya dari Ronde 1 — sebagian besar bersifat **silent failures** yang tidak memunculkan error eksplisit sehingga sulit dideteksi.

---

## 📊 Ringkasan Temuan Ronde 2

| Level | Jumlah |
|---|---|
| 🔴 **CRITICAL (85–100%)** | 4 |
| 🟠 **HIGH (65–84%)** | 5 |
| 🟡 **MEDIUM (40–64%)** | 4 |

**Total bug baru ditemukan: 13 item**

---

## 🔴 CRITICAL BUGS (85–100%)

---

### BUG-N01 · `lib/scheduler.ts` → `getTenantFonnteToken()`
**Judul:** Token Fonnte tidak di-decrypt — SEMUA pesan WA dari scheduler dikirim dengan token terenkripsi  
**Level Risiko:** 🔴 **99% — Seluruh scheduler mati secara diam-diam**

**Narasi:**
Ini adalah bug paling kritis dalam seluruh modul WA. Fungsi `getTenantFonnteToken()` di scheduler membaca `settings.fonnteToken` dari database dan langsung mengembalikannya sebagai string **tanpa mendekripsi terlebih dahulu**:

```typescript
// lib/scheduler.ts — getTenantFonnteToken()
async function getTenantFonnteToken(slug: string): Promise<string> {
    const models = await getTenantModels(slug);
    const settings: any = await models.Settings.findOne({});
    if (settings?.fonnteToken) {
        return String(settings.fonnteToken).trim();  // ← LANGSUNG RETURN! Tidak decrypt!
    }
    return String(process.env.FONNTE_TOKEN || '').trim();
}
```

Sedangkan ketika token disimpan melalui UI Settings, ia dienkripsi dengan `encryptFonnteToken()` dan tersimpan sebagai string dengan prefix `"ENC:..."`. Semua API route lain yang membaca token sudah benar:

```typescript
// Contoh di /api/fonnte/webhook/route.ts — BENAR ✅
const fonnteToken = settings?.fonnteToken 
    ? decryptFonnteToken(String(settings.fonnteToken).trim()) 
    : undefined;
```

**Dampak Nyata:**
Seluruh fungsi berikut terdampak karena semuanya memanggil `getTenantFonnteToken`:
- `processPendingCampaigns()` — Blast campaign **tidak terkirim**
- `processAutomations()` — Semua automation WA (daily report, stock alert, birthday, dll) **tidak terkirim**
- `processPendingWaSchedules()` — Follow-up WA pasca-transaksi **tidak terkirim**

Token yang dikirim ke Fonnte API adalah `"ENC:a1b2c3...:d4e5f6..."` (string terenkripsi), bukan token asli. Fonnte akan menolak dengan error autentikasi, dan karena error ini ditangkap di level `sendWhatsApp()` yang hanya mengembalikan `{ success: false }`, tidak ada exception yang dilempar — semua **gagal diam-diam**.

**Verifikasi:**
```bash
# Cek bahwa semua route lain sudah benar
grep -rn "decryptFonnteToken" app/api/ | wc -l  # → 10+ files
# Cek scheduler tidak decrypt
grep "decryptFonnteToken" lib/scheduler.ts  # → TIDAK ADA
```

**Solusi:**
```typescript
import { decryptFonnteToken } from '@/lib/encryption';

async function getTenantFonnteToken(slug: string): Promise<string> {
    const models = await getTenantModels(slug);
    const settings: any = await models.Settings.findOne({});
    if (settings?.fonnteToken) {
        const raw = String(settings.fonnteToken).trim();
        return decryptFonnteToken(raw); // ← WAJIB DECRYPT
    }
    return String(process.env.FONNTE_TOKEN || '').trim();
}
```

---

### BUG-N02 · `lib/scheduler.ts` → `processPendingWaSchedules()`
**Judul:** Status `'processing'` tidak ada di enum WaSchedule — atomic claim GAGAL, pesan terkirim ganda  
**Level Risiko:** 🔴 **95%**

**Narasi:**
`processPendingWaSchedules()` menggunakan pola atomic claim untuk mencegah dua worker memproses schedule yang sama secara bersamaan. Pola ini mengandalkan pengubahan status ke `'processing'`:

```typescript
// lib/scheduler.ts — processPendingWaSchedules()
const schedule = await WaSchedule.findOneAndUpdate(
    { _id: sched._id, status: 'pending' },
    { $set: { status: 'processing', processedAt: new Date() } },  // ← STATUS TIDAK VALID!
    { new: true }
);
```

Namun, model `WaSchedule` hanya mendefinisikan tiga status yang valid:

```typescript
// models/WaSchedule.ts
enum: ['pending', 'sent', 'failed'],  // ← 'processing' TIDAK ADA!
```

Karena Mongoose strict mode (default aktif), pengaturan ke nilai yang tidak ada di enum **akan gagal validasi** saat dokumen disimpan. `findOneAndUpdate` dengan `runValidators: false` (default) mungkin memang melewati validasi, tapi field tetap tidak tersimpan karena tipe schema tidak cocok.

Hasil: **Kondisi `{ _id: sched._id, status: 'pending' }` pada attempt kedua masih cocok** karena status tidak berhasil diubah ke 'processing'. Dua instance scheduler yang berjalan bersamaan (misalnya dari frontend ping + cron job) bisa memproses schedule yang sama dan mengirim WA dua kali ke customer.

Tambahan: field `processedAt` yang di-set juga tidak ada di schema WaSchedule, sehingga field tersebut dibuang oleh Mongoose strict mode.

**Solusi:**
```typescript
// models/WaSchedule.ts — Tambahkan 'processing' ke enum
enum: ['pending', 'processing', 'sent', 'failed'],

// Dan tambahkan field processedAt:
processedAt: { type: Date },

// Partial unique index perlu diupdate juga:
waScheduleSchema.index(
    { transactionId: 1, templateId: 1 },
    { unique: true, partialFilterExpression: { status: { $in: ['pending', 'processing'] } } }
);
```

---

### BUG-N03 · `lib/scheduler.ts` → `processPendingCampaigns()`
**Judul:** Status `'paused'` tidak ada di enum WaCampaignQueue — campaign stuck di `'processing'` selamanya  
**Level Risiko:** 🔴 **90%**

**Narasi:**
Ketika terjadi 3 consecutive error saat mengirim pesan blast, scheduler mencoba menge-set status campaign menjadi `'paused'`:

```typescript
// lib/scheduler.ts — processPendingCampaigns()
if (consecutiveErrors >= 3) {
    campaign.status = 'paused';  // ← STATUS TIDAK ADA DI ENUM!
    await campaign.save();       // ← MONGOOSE ValidationError: 'paused' invalid
    break;
}
```

Model `WaCampaignQueue` hanya mendefinisikan:
```typescript
enum: ['pending', 'processing', 'completed', 'failed', 'partially_failed']
// ← 'paused' TIDAK ADA!
```

`campaign.save()` akan melempar `ValidationError`. Error ini **tidak ditangkap** di level loop target — ia hanya ditangkap di outer try-catch tenant, yang hanya mencatat ke console dan melanjutkan ke tenant berikutnya. Campaign tetap berstatus `'processing'` (yang memang sudah di-set sebelumnya).

**Siklus Infinite Loop:**
1. Campaign memiliki target dengan nomor-nomor bermasalah
2. 3 consecutive errors → coba `status = 'paused'` → ValidationError
3. Campaign tetap `'processing'`
4. 5 menit kemudian, stuck-processing reclaim logic menangkap campaign ini kembali
5. `{ status: 'processing', processingAt: { $lt: 5min ago } }` → campaign di-claim ulang
6. Proses dimulai dari target yang `status: 'pending'`... atau dari awal? Karena target yang sudah diproses berstatus `'failed'`, `consecutiveErrors` reset ke 0 dan mulai menghitung lagi
7. Kembali ke step 2 → infinite loop!

**Dampak:** Campaign terus mencoba mengirim ke nomor bermasalah selamanya, menghabiskan kuota Fonnte.

**Solusi:**
```typescript
// Option A: Tambahkan 'paused' ke enum WaCampaignQueue
enum: ['pending', 'processing', 'completed', 'failed', 'partially_failed', 'paused']

// Option B: Ganti 'paused' dengan 'failed' (lebih simpel)
campaign.status = 'failed';
await campaign.save();
```

---

### BUG-N04 · `lib/encryption.ts`
**Judul:** Default `ENCRYPTION_KEY` bukan hex valid — `encrypt()` dan `decrypt()` crash di production tanpa env  
**Level Risiko:** 🔴 **85%**

**Narasi:**
```typescript
// lib/encryption.ts
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY 
    || '64_hex_characters_should_be_here_in_env_file';
    //   ↑ INI BUKAN HEX YANG VALID!

// encrypt() dan decrypt() menggunakannya sebagai hex:
const cipher = crypto.createCipheriv(
    'aes-256-cbc', 
    Buffer.from(ENCRYPTION_KEY, 'hex'),  // ← Buffer.from('64_hex_...', 'hex')
    iv
);
```

`Buffer.from('64_hex_characters_should_be_here_in_env_file', 'hex')` menghasilkan buffer dengan panjang **1 byte** (hanya karakter `6` dan `4` yang membentuk byte `0x64`). AES-256-CBC membutuhkan key tepat **32 bytes**. Node.js akan melempar:

```
Error: Invalid key length
```

**Verifikasi (confirmed):**
```bash
node -e "
const key = '64_hex_characters_should_be_here_in_env_file';
const buf = Buffer.from(key, 'hex');
console.log('Length:', buf.length);  // Output: 1 (bukan 32!)
"
# Output: Length: 1
```

**Catatan Penting:** Fungsi `encryptFonnteToken()` dan `decryptFonnteToken()` menggunakan `getFonnteKey()` yang mengkonversi key sebagai UTF-8 (bukan hex), sehingga fungsi-fungsi ini **tidak crash**. Tapi fungsi `encrypt()` dan `decrypt()` generik **AKAN crash**.

**Dampak:** Jika `ENCRYPTION_KEY` tidak dikonfigurasi di `.env.local` (umum di setup baru atau staging), semua operasi yang memanggil `encrypt()` atau `decrypt()` akan crash dengan unhandled exception.

**Solusi:**
```typescript
// Option A: Gunakan fallback yang valid sebagai hex
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY 
    || 'a'.repeat(64); // Valid hex 32-byte fallback untuk development

// Option B (Lebih aman): Throw error jika tidak dikonfigurasi
if (!process.env.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
}
```

---

## 🟠 HIGH BUGS (65–84%)

---

### BUG-N05 · `app/api/cron/birthday-voucher/route.ts`
**Judul:** `markAsRun` diimport tapi tidak pernah dipanggil — cron dedup tidak aktif  
**Level Risiko:** 🟠 **80%**

**Narasi:**
File birthday-voucher cron mengimport `hasRunToday` dan `markAsRun` dari `lib/cronDedup`, tetapi hanya `hasRunToday` yang sebenarnya bisa digunakan — dan **keduanya tidak pernah dipanggil sama sekali**:

```typescript
// app/api/cron/birthday-voucher/route.ts
import { hasRunToday, markAsRun } from '@/lib/cronDedup'; // ← Import ada
// ↑ TAPI keduanya tidak dipanggil di manapun dalam fungsi!

// Tidak ada: if (await hasRunToday('birthday_voucher', tenantSlug)) { ... }
// Tidak ada: await markAsRun('birthday_voucher', tenantSlug, 'cron_route');
```

Berbanding terbalik dengan `wa-daily-report` yang sudah benar menggunakannya. Jika cron eksternal (cron-job.org, dll) menjalankan endpoint ini dua kali dalam sehari (karena retry, gangguan network, atau konfigurasi overlap), sistem akan mencoba mengirim voucher birthday lagi. Per-customer dedup via `birthdayVoucherSentYear` memang ada, tapi tidak melindungi dari race condition saat dua instance berjalan hampir bersamaan.

**Solusi:**
```typescript
// Tambahkan di awal handler, setelah auth check
if (await hasRunToday('birthday_voucher', tenantSlug)) {
    return NextResponse.json({
        success: true, 
        message: 'Birthday voucher already processed today',
        skipped: true, sent: 0
    });
}

// Di akhir, setelah semua berhasil dikirim:
if (sentCount > 0 || birthdayCustomers.length === 0) {
    await markAsRun('birthday_voucher', tenantSlug, 'cron_route');
}
```

---

### BUG-N06 · `lib/scheduler.ts` → `processAutomations()`
**Judul:** `startOfToday.setHours(0,0,0,0)` menggunakan timezone server (UTC), bukan WIB  
**Level Risiko:** 🟠 **75%**

**Narasi:**
Atomic claim untuk mencegah automation berjalan dua kali dalam sehari menggunakan `startOfToday` yang dibangun dengan `setHours(0, 0, 0, 0)`:

```typescript
// lib/scheduler.ts — processAutomations()
const startOfToday = new Date(now);
startOfToday.setHours(0, 0, 0, 0); // ← MIDNIGHT TIMEZONE SERVER, bukan WIB!
```

`setHours()` tanpa timezone argument menggunakan **local timezone server**. Jika server berjalan di UTC (standar untuk cloud hosting seperti Railway, Render, Digital Ocean), maka `startOfToday` adalah **00:00 UTC = 07:00 WIB**.

Implikasi:
- Automation yang dijadwalkan pukul **21:00 WIB** akan berjalan pada 14:00 UTC
- Setelah berjalan, `lastRunDate` di-set ke now (14:00 UTC)
- Besok, `startOfToday` = 00:00 UTC baru = 07:00 WIB baru
- Pada pukul 00:00-07:00 WIB (17:00-00:00 UTC sebelumnya), `lastRunDate < startOfToday` sudah true
- **Automation bisa berjalan lagi antara jam 00:00-07:00 WIB** pada periode transisi ini

**Solusi:**
```typescript
// Gunakan WIB midnight yang konsisten
const tz = 'Asia/Jakarta';
const year = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric' }).format(now);
const month = new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'numeric' }).format(now);
const day = new Intl.DateTimeFormat('en-US', { timeZone: tz, day: 'numeric' }).format(now);
const startOfToday = new Date(
    `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}T00:00:00.000+07:00`
);
```

---

### BUG-N07 · `lib/scheduler.ts` → `processAutomations()` birthday category
**Judul:** `$month` dan `$dayOfMonth` MongoDB operator bekerja di UTC — birthday dikirim di tanggal salah  
**Level Risiko:** 🟠 **72%**

**Narasi:**
Automation birthday menggunakan MongoDB aggregation operators untuk mencocokkan tanggal lahir:

```typescript
// lib/scheduler.ts
$expr: {
    $and: [
        { $eq: [{ $month: '$birthday' }, month] },      // ← UTC month!
        { $eq: [{ $dayOfMonth: '$birthday' }, day] }     // ← UTC day!
    ]
}
```

MongoDB menyimpan semua tanggal dalam UTC. Operator `$month` dan `$dayOfMonth` juga beroperasi dalam UTC. Variabel `month` dan `day` diambil dari WIB timezone (benar), tapi tanggal yang dibandingkan adalah UTC.

**Skenario nyata:** Customer lahir tanggal 1 Januari. Data tersimpan sebagai `birthday: ISODate("1990-01-01T00:00:00.000+00:00")`. Ini sudah benar. Tapi jika birthday disimpan dengan waktu `T00:00:00+07:00` (WIB midnight), MongoDB menyimpannya sebagai `T17:00:00Z` (UTC tanggal 31 Desember!). Query untuk bulan=1, hari=1 UTC **tidak akan cocok** — customer tidak mendapat pesan birthday.

Sebaliknya, customer yang lahir 1 Februari dan disimpan dengan waktu siang WIB akan dicocokkan dengan tanggal 1 Februari UTC — yang terlihat benar tapi hanya kebetulan.

**Solusi:** Gunakan aggregation dengan timezone support:
```typescript
$expr: {
    $and: [
        { $eq: [
            { $month: { date: '$birthday', timezone: 'Asia/Jakarta' } }, 
            month
        ]},
        { $eq: [
            { $dayOfMonth: { date: '$birthday', timezone: 'Asia/Jakarta' } }, 
            day
        ]}
    ]
}
```

---

### BUG-N08 · `lib/scheduler.ts` → `processPendingCampaigns()`
**Judul:** Daily/hourly limit dihitung dari `WaBlastLog` yang hanya dibuat SETELAH campaign selesai  
**Level Risiko:** 🟠 **68%**

**Narasi:**
Scheduler menghitung berapa pesan yang sudah terkirim hari ini dengan query ke `WaBlastLog`:

```typescript
// lib/scheduler.ts
const sentTodayAgg = await WaBlastLog.aggregate([
    { $match: { createdAt: { $gte: todayStart } } },
    { $group: { _id: null, total: { $sum: '$sentCount' } } }
]);
const totalSentToday = sentTodayAgg[0]?.total || 0;
```

Namun `WaBlastLog` hanya dibuat **setelah semua target selesai diproses** (di blok `pendingTargets.length === 0`). Selama campaign masih aktif diproses (bisa memakan waktu jam-jam karena delay 8-15 detik per pesan), `WaBlastLog` belum ada. 

**Skenario exploit:** Daily limit = 50 pesan.
1. Tick 1: `totalSentToday = 0` → Start campaign A (50 target). Masih processing.
2. Tick 2 (5 menit kemudian, kampanye belum selesai): `totalSentToday = 0` (WaBlastLog belum dibuat!)
3. Jika ada 2 scheduler berjalan (karena frontend ping), keduanya bisa start campaign serentak
4. Hasil: 100 pesan terkirim meski limit = 50

**Tambahan:** Field `sentCount` di `WaBlastLog` adalah jumlah total per campaign. Satu campaign dengan 50 pesan dan 10 gagal akan mencatat `sentCount: 40`. Tapi query `$sum: '$sentCount'` dari semua blast log hari ini tidak memperhitungkan campaign yang masih processing.

**Solusi:** Pindahkan penghitungan ke `WaCampaignQueue` yang diupdate real-time:
```typescript
const sentTodayAgg = await WaCampaignQueue.aggregate([
    { $match: { 
        createdAt: { $gte: todayStart },
        status: { $in: ['processing', 'completed', 'partially_failed'] }
    }},
    { $unwind: '$targets' },
    { $match: { 'targets.status': 'sent' }},
    { $group: { _id: null, total: { $sum: 1 } }}
]);
```

---

### BUG-N09 · `app/api/appointments/send-reminders/route.ts`
**Judul:** Phone number dikirim ke WA tanpa normalisasi + validasi `waEnabled` tidak lengkap  
**Level Risiko:** 🟠 **66%**

**Narasi:**
Pengiriman WA appointment reminder langsung menggunakan `customer.phone` tanpa normalisasi:

```typescript
// app/api/appointments/send-reminders/route.ts
const result = await sendWhatsApp(
    customer.phone,  // ← Tidak dinormalisasi! Bisa "08123..." → Fonnte butuh "628123..."
    waMessage, 
    fonnteToken
);
```

Kondisi `waEnabled` juga berpotensi salah:
```typescript
const waEnabled = !!(fonnteToken || process.env.FONNTE_TOKEN);
```

Jika `fonnteToken` adalah string kosong `""`, ekspresi `!!fonnteToken` adalah `false`, tapi jika `fonnteToken` adalah `undefined` dan `FONNTE_TOKEN` env ada, WA akan dicoba. Masalahnya: jika settings menyimpan token terenkripsi tapi `decryptFonnteToken` gagal (misalnya karena key salah), `fonnteToken` bisa berisi string terenkripsi yang dianggap truthy — reminder terkirim ke Fonnte dengan token salah.

**Solusi:**
```typescript
import { normalizeIndonesianPhone } from '@/lib/phone';
// ...
const normalizedPhone = normalizeIndonesianPhone(customer.phone);
if (!normalizedPhone) { errors.push({ appointmentId: appointment._id, error: 'Invalid phone' }); continue; }
const result = await sendWhatsApp(normalizedPhone, waMessage, fonnteToken);
```

---

## 🟡 MEDIUM BUGS (40–64%)

---

### BUG-N10 · `lib/tenantDb.ts`
**Judul:** `tenantConnections` Map tidak pernah dibersihkan — koneksi stale dikembalikan selamanya  
**Level Risiko:** 🟡 **60%**

**Narasi:**
```typescript
// lib/tenantDb.ts
const tenantConnections = new Map<string, mongoose.Connection>();

export async function getTenantConnection(slug: string) {
    if (tenantConnections.has(slug)) {
        return tenantConnections.get(slug)!;  // ← Langsung return cached connection
    }
    // ... buat koneksi baru
    tenantConnections.set(slug, conn);
    return conn;
}
```

Map ini tidak pernah dibersihkan dan tidak ada pengecekan `readyState`. Jika koneksi MongoDB putus (network hiccup, Atlas maintenance, timeout), koneksi yang di-cache di Map tetap dikembalikan. `conn.readyState` akan menunjukkan `0` (disconnected) atau `3` (disconnecting), tapi kode tidak mengeceknya.

Semua operasi DB selanjutnya akan menggunakan koneksi mati dan timeour setelah `socketTimeoutMS: 10000` — menyebabkan semua API request hang selama 10 detik sebelum gagal.

**Solusi:**
```typescript
export async function getTenantConnection(slug: string) {
    const existing = tenantConnections.get(slug);
    // Cek readyState: 1 = connected
    if (existing && existing.readyState === 1) {
        return existing;
    }
    // Jika ada tapi disconnected, hapus dari cache
    if (existing) {
        tenantConnections.delete(slug);
    }
    // Buat koneksi baru...
}
```

---

### BUG-N11 · `lib/scheduler.ts` + `/api/cron/wa-daily-report` 
**Judul:** Dua sistem dedup yang terpisah — owner berpotensi dapat laporan ganda  
**Level Risiko:** 🟡 **55%**

**Narasi:**
Sistem memiliki **dua jalur paralel** yang bisa mengirim laporan harian WA:

**Jalur 1: WaAutomation rule** (diproses oleh `processAutomations()` di scheduler)
- Dedup via `WaAutomation.lastRunDate` (atomic DB claim)
- Tidak menggunakan `CronDedup` collection

**Jalur 2: Direct cron route** (`/api/cron/wa-daily-report`)
- Dedup via `hasRunToday('daily_report')` di `CronDedup` collection
- Tidak menggunakan `WaAutomation.lastRunDate`

Kedua sistem **tidak saling tahu**. Jika salon memiliki:
1. Rule `WaAutomation` dengan category=`daily_report` yang aktif, DAN
2. Cron eksternal yang memanggil `/api/cron/wa-daily-report` setiap hari

...maka **owner akan menerima dua laporan harian** — satu dari scheduler dan satu dari cron route.

**Solusi:** Unifikasikan dedup. Salah satu opsi: `processAutomations()` mencatat ke `CronDedup` setelah sukses, dan semua cron route cek `CronDedup` sebelum jalan.

---

### BUG-N12 · `lib/rateLimiter.ts`
**Judul:** Rate limiter in-memory tidak efektif di serverless/multi-instance  
**Level Risiko:** 🟡 **45%**

**Narasi:**
```typescript
// lib/rateLimiter.ts
const rateLimitStore = new Map<string, RateLimitRecord>(); // ← IN-MEMORY!
```

Di deployment serverless (Vercel, Netlify), setiap request bisa diproses oleh instance function yang berbeda. Map in-memory ini di-reset setiap kali instance baru dibuat. Akibatnya:

- Setiap serverless invocation baru mulai dengan counter 0
- Rate limiting **sama sekali tidak bekerja** di Vercel deployment
- Meski ada `setInterval` untuk cleanup, interval ini juga hilang di serverless

Ini berarti endpoint WA yang menggunakan rate limiter (jika ada) dapat di-spam tanpa batas.

**Tambahan:** `setInterval(() => {...}, 60000)` di level module adalah anti-pattern di serverless — interval ini tidak pernah dibersihkan dan bisa menyebabkan memory leak di long-running server.

**Solusi:** Gunakan Redis-based rate limiting (Upstash, dll) untuk produksi serverless:
```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
```

---

### BUG-N13 · `lib/scheduler.ts` → `processPendingCampaigns()` + `processAutomations()`
**Judul:** Double query `Settings` per tenant karena `getTenantFonnteToken` sudah query Settings  
**Level Risiko:** 🟡 **42%**

**Narasi:**
Setiap kali satu dari dua fungsi utama scheduler berjalan, Settings di-query **dua kali** untuk setiap tenant:

```typescript
// Untuk SETIAP tenant di processPendingCampaigns():
const token = await getTenantFonnteToken(slug);    // Query 1: Settings.findOne()
const settings = await Settings.findOne() || {};    // Query 2: Settings.findOne() lagi!
```

Dan di `processAutomations()` sama persis:
```typescript
const token = await getTenantFonnteToken(slug);    // Query 1
const settings: any = await Settings.findOne() || {}; // Query 2
```

Untuk deployment dengan 10 tenant aktif, setiap scheduler tick menghasilkan 20 query Settings yang redundan (10 dari kampanye + 10 dari automations). Dengan tick setiap 5 menit = 288 tick/hari = **5.760 redundant DB queries per hari** hanya untuk Settings.

**Solusi:** Merge token retrieval ke dalam settings fetch:
```typescript
const settings: any = await Settings.findOne() || {};
const rawToken = settings.fonnteToken 
    ? decryptFonnteToken(String(settings.fonnteToken).trim()) 
    : (process.env.FONNTE_TOKEN || '');
```

---

## 📊 Flowchart Alur Bug Ronde 2

```
┌─────────────────────────────────────────────────────────────────────────┐
│         ALUR SCHEDULER TICK (lib/scheduler.ts)                           │
└─────────────────────────────────────────────────────────────────────────┘

┌────────────────────┐
│  Scheduler Tick    │  setiap 5 menit (node-cron)
└────────┬───────────┘
         │
         ▼
┌────────────────────────────────────────────────────────┐
│  processPendingWaSchedules()                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 1. getTenantFonnteToken(slug)                   │   │
│  │    [BUG-N01🔴] TIDAK DECRYPT → token = "ENC:..." │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ 2. findOneAndUpdate status='processing'          │   │
│  │    [BUG-N02🔴] 'processing' NOT IN ENUM         │   │
│  │    → Atomic claim GAGAL → duplicate send!       │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ 3. sendWhatsApp(phone, message, "ENC:...")       │   │
│  │    → Fonnte API menolak token                   │   │
│  │    → result.success = false                     │   │
│  │    → WaSchedule status = 'failed'               │   │
│  └─────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────┐
│  processPendingCampaigns()                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 1. [BUG-N13🟡] Double query Settings per tenant │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ 2. [BUG-N08🟠] Daily limit dari WaBlastLog      │   │
│  │    yang belum dibuat → limit tidak ditegakkan   │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ 3. Loop per target:                              │   │
│  │    sendWhatsApp(token="ENC:...") [BUG-N01🔴]    │   │
│  │    → SEMUA GAGAL (token tidak valid)            │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ 4. consecutiveErrors >= 3?                      │   │
│  │    → campaign.status = 'paused' [BUG-N03🔴]    │   │
│  │    → ValidationError (bukan dalam enum)         │   │
│  │    → campaign tetap 'processing'                │   │
│  │    → 5 menit kemudian: diklaim ulang            │   │
│  │    → INFINITE LOOP!                             │   │
│  └─────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────┐
│  processAutomations()                                  │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 1. validTimeSlots dibangun di awal, tapi tenant │   │
│  │    processing bisa lebih dari 5 menit           │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ 2. startOfToday.setHours(0,0,0,0)               │   │
│  │    [BUG-N06🟠] UTC midnight, bukan WIB          │   │
│  │    → Automation bisa jalan 2x di hari WIB baru  │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ 3. Birthday: $month/$dayOfMonth UTC             │   │
│  │    [BUG-N07🟠] Beda dengan WIB timezone         │   │
│  │    → Birthday dikirim di tanggal salah          │   │
│  └─────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│         ALUR CRON JOBS HARIAN                                            │
└─────────────────────────────────────────────────────────────────────────┘

External Cron ──────▶ /api/cron/birthday-voucher
                       [BUG-N05🟠] markAsRun TIDAK DIPANGGIL
                       hasRunToday DIIMPORT TAPI TIDAK DIGUNAKAN
                       → Jika cron jalan 2x: double voucher attempt
                            │
                            ▼
                       Per-customer dedup (birthdayVoucherSentYear) 
                       melindungi dari double send ke customer yang sama
                       TAPI tidak dari race condition concurrent instances

External Cron ──────▶ /api/cron/wa-daily-report
                       hasRunToday('daily_report') ✅ via CronDedup
                            │
                            ▼
Scheduler Tick ──────▶ processAutomations() → daily_report rule
                       WaAutomation.lastRunDate atomic claim ✅
                       TAPI: [BUG-N11🟡] 2 dedup systems TIDAK SALING TAHU
                       → Owner bisa dapat 2 laporan sehari


┌─────────────────────────────────────────────────────────────────────────┐
│         INFRASTRUKTUR                                                    │
└─────────────────────────────────────────────────────────────────────────┘

Request ─▶ getTenantModels(slug)
           ├── [BUG-N10🟡] tenantConnections Map
           │   → readyState tidak dicek
           │   → Stale/closed connection dikembalikan
           │   → Semua DB ops hang 10 detik lalu gagal
           │
           └── lib/rateLimiter.ts
               [BUG-N12🟡] In-memory Map
               → Di Vercel/serverless: TIDAK EFEKTIF
               → setInterval di module level: memory leak
```

---

## 🏆 Top 5 Bug Terkritis (Combined Ronde 1 + 2)

| Rank | Bug ID | Modul | Deskripsi Singkat | Level |
|---|---|---|---|---|
| **#1** | BUG-N01 | `lib/scheduler.ts` | Token Fonnte tidak di-decrypt → scheduler 100% mati | 🔴 99% |
| **#2** | BUG-01 (R1) | Fonnte Webhook | No-auth saat token belum dikonfigurasi | 🔴 95% |
| **#3** | BUG-N02 | `lib/scheduler.ts` | Status 'processing' tidak di enum → duplicate WA | 🔴 95% |
| **#4** | BUG-N03 | `lib/scheduler.ts` | Status 'paused' tidak di enum → infinite loop | 🔴 90% |
| **#5** | BUG-04 (R1) | Cron routes | Tidak ada dedup di membership/package expiry | 🔴 85% |

---

## 🔧 Quick-Fix Checklist (Urutan Prioritas)

```
P0 — HARI INI (production-breaking):
□ lib/scheduler.ts: getTenantFonnteToken() → tambah decryptFonnteToken()
□ models/WaSchedule.ts: tambah 'processing' ke status enum
□ models/WaCampaignQueue.ts: tambah 'paused' ke status enum (atau ganti paused → failed)
□ lib/encryption.ts: perbaiki default ENCRYPTION_KEY atau throw error

P1 — SPRINT INI:
□ app/api/cron/birthday-voucher: tambah hasRunToday + markAsRun
□ lib/scheduler.ts: processAutomations — perbaiki startOfToday ke WIB
□ lib/scheduler.ts: processAutomations birthday — tambah timezone ke $month/$dayOfMonth
□ lib/scheduler.ts: processPendingCampaigns — perbaiki daily limit counting

P2 — SPRINT DEPAN:
□ app/api/appointments/send-reminders: tambah normalizeIndonesianPhone()
□ lib/tenantDb.ts: cek readyState sebelum return cached connection
□ lib/scheduler.ts + cron routes: unifikasi dedup system
□ lib/rateLimiter.ts: migrasi ke Redis untuk production serverless
□ lib/scheduler.ts: eliminasi double Settings query
```

---

## 📝 Catatan Metodologi

Laporan ini dihasilkan dari **analisis statis kode** (`grep`, `node` eval untuk verifikasi runtime behavior pada bug kritis). Konfirmasi lapangan diperlukan untuk:
- BUG-N01: Test dengan Settings yang menyimpan encrypted token
- BUG-N02: Test dengan dua scheduler concurrent (perlu race condition trigger)
- BUG-N04: Konfirmasi behavior default `ENCRYPTION_KEY` di environment production yang sudah terkonfigurasi

*Ronde 1: 19 bug | Ronde 2: 13 bug | **Total: 32 bug teridentifikasi***