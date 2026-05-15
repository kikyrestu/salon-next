# Audit WhatsApp Module - SalonNext

**Tanggal Audit:** 2026-05-15  
**Auditor:** Claude Code  
**Scope:** Seluruh modul WhatsApp (WA) di project SalonNext  
**Total File Diaudit:** 25+ file  

---

## Daftar Isi

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Arsitektur Modul WA](#2-arsitektur-modul-wa)
3. [Bug & Error Ditemukan](#3-bug--error-ditemukan)
4. [Cacat Logic / User Flow](#4-cacat-logic--user-flow)
5. [Anti-Blocking Strategy (Antisipasi Blokir WA)](#5-anti-blocking-strategy)
6. [Security Issues](#6-security-issues)
7. [Race Condition & Concurrency](#7-race-condition--concurrency)
8. [Rekomendasi Perbaikan Prioritas](#8-rekomendasi-perbaikan-prioritas)
9. [File Reference](#9-file-reference)

---

## 1. Ringkasan Eksekutif

### Status Keseluruhan: **PERLU PERBAIKAN SIGNIFIKAN**

| Kategori | Jumlah Issue |
|----------|-------------|
| Bug / Error | 12 |
| Cacat Logic / User Flow | 9 |
| Anti-Blocking (Risiko Blokir WA) | 8 |
| Security Issues | 5 |
| Race Condition | 4 |
| **TOTAL** | **38** |

### Severity Breakdown

| Severity | Count | Keterangan |
|----------|-------|------------|
| **CRITICAL** | 7 | Bisa menyebabkan blokir WA / data loss |
| **HIGH** | 12 | Berpotensi gagal kirim / logic error |
| **MEDIUM** | 11 | Degradasi performa / UX buruk |
| **LOW** | 8 | Best practice / enhancement |

---

## 2. Arsitektur Modul WA

### Flow Diagram

```
[Frontend UI] --> [API Routes] --> [Queue/Schedule DB] --> [Scheduler (node-cron)] --> [Fonnte API] --> [WhatsApp]
                                                                                           ^
[Cron Jobs (External)] --> [Cron API Routes] --> [Fonnte API] ----------------------------|
                                                                                           ^
[Fonnte Webhook] --> [Webhook Handler] --> [Auto Greeting] --> [Fonnte API] ---------------|
```

### Komponen Utama

| Komponen | File | Fungsi |
|----------|------|--------|
| Fonnte Client | `lib/fonnte.ts` | HTTP client ke Fonnte API |
| Scheduler | `lib/scheduler.ts` | node-cron, proses campaign/automation/schedule |
| Follow-Up | `lib/waFollowUp.ts` | Jadwal follow-up setelah transaksi |
| Message Validator | `lib/messageValidator.ts` | Validasi konten pesan anti-spam |
| Message Variation | `lib/messageVariation.ts` | Variasi pesan anti-spam detection |
| Webhook | `app/api/fonnte/webhook/route.ts` | Handle inbound WA message |
| Campaign API | `app/api/wa/campaigns/route.ts` | CRUD campaign |
| Blast Targets | `app/api/wa/blast-targets/route.ts` | Filter & queue blast |
| Automation API | `app/api/wa/automations/route.ts` | CRUD automation rules |
| Template API | `app/api/wa/templates/route.ts` | CRUD WA templates |
| Trigger API | `app/api/wa/trigger/route.ts` | Manual trigger scheduler |
| Cron Routes | `app/api/cron/wa-*/route.ts` | Cron-based WA jobs |

---

## 3. Bug & Error Ditemukan

### BUG-01: Dedup Check Dinonaktifkan pada Campaign Blast [CRITICAL]

**File:** `lib/scheduler.ts:203-205`  
**Kode:**
```typescript
// BLAST-04: Dedup check removed temporarily as requested for testing
// (The block checking WaBlastLog has been deleted)
```

**Dampak:** Customer bisa menerima pesan yang sama berkali-kali dari campaign yang berbeda. Tidak ada pengecekan apakah nomor yang sama sudah pernah dikirimi pesan serupa dalam periode waktu tertentu.

**Risiko:** 
- Customer annoyed, report spam
- WhatsApp mendeteksi pola spam -> **BLOKIR NOMOR**

**Solusi:**
```typescript
// Cek apakah customer sudah dikirimi blast dalam 24 jam terakhir
const recentBlast = await WaBlastLog.findOne({
    'recipients.phone': target.phone,
    'recipients.status': 'sent',
    createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60_000) }
});
if (recentBlast) {
    target.status = 'failed';
    target.error = 'Already received blast within 24h';
    continue;
}
```

---

### BUG-02: Delay Antar Pesan Terlalu Pendek pada Campaign (1 detik) [CRITICAL]

**File:** `lib/scheduler.ts:242`  
**Kode:**
```typescript
await new Promise((resolve) => setTimeout(resolve, 1000));
```

**Dampak:** Delay 1 detik antar pesan SANGAT berbahaya untuk WhatsApp. Platform WA memiliki rate limiting yang ketat dan mendeteksi pengiriman pesan massal.

**Konteks:** 
- Delay di automation: 10 detik (line 358, 389, 426, 461, 492) — ini sudah benar
- Delay di campaign: HANYA 1 detik — **ini berbahaya**
- Delay di cron membership expiry: 500ms (line 80) — **ini juga berbahaya**

**Risiko:**
- Fonnte API mengembalikan "Too Many Requests"
- Nomor WA di-flag sebagai spammer
- **Akun Fonnte bisa di-suspend**

**Solusi:** Minimal delay 8-15 detik antar pesan, dengan random jitter.

---

### BUG-03: WaGreetingLog Tidak Punya TTL/Expiry [HIGH]

**File:** `models/WaGreetingLog.ts`  
**Kode:** Schema tidak memiliki TTL index.

**Dampak:** Setelah customer pertama kali chat dan mendapat greeting, mereka TIDAK AKAN PERNAH mendapat greeting lagi, bahkan setelah berbulan-bulan tidak aktif. Tabel juga akan terus membesar tanpa batas.

**Solusi:**
```typescript
// Tambahkan TTL index — hapus log setelah 30 hari
waGreetingLogSchema.index({ firstMessageAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });
```

---

### BUG-04: Campaign Blast Log Ditulis Hanya Saat Semua Target Selesai [HIGH]

**File:** `lib/scheduler.ts:147-163`

**Dampak:** Jika server crash di tengah pengiriman campaign, blast log tidak akan pernah ditulis. Data pengiriman hilang dan tidak bisa di-audit.

**Solusi:** Tulis blast log secara incremental, atau update atomik per target.

---

### BUG-05: `todayStart` Pakai Local Timezone, Bukan WIB [HIGH]

**File:** `lib/scheduler.ts:83-84`  
**Kode:**
```typescript
const todayStart = new Date(now);
todayStart.setHours(0, 0, 0, 0);
```

**Dampak:** `setHours(0,0,0,0)` menggunakan timezone server (UTC di cloud). Jadi daily volume count bisa salah — menghitung dari jam 00:00 UTC (07:00 WIB) bukan 00:00 WIB.

**Solusi:** Gunakan timezone-aware calculation:
```typescript
const tz = 'Asia/Jakarta';
const year = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric' }).format(now);
const month = new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'numeric' }).format(now);
const day = new Intl.DateTimeFormat('en-US', { timeZone: tz, day: 'numeric' }).format(now);
const todayStart = new Date(`${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}T00:00:00+07:00`);
```

---

### BUG-06: Automation `processAutomations` Birthday Pakai `now.getMonth()`/`now.getDate()` tanpa Timezone [MEDIUM]

**File:** `lib/scheduler.ts:467-468`  
**Kode:**
```typescript
const month = now.getMonth() + 1;
const day = now.getDate();
```

**Dampak:** Di server UTC, antara jam 00:00-07:00 WIB, `getMonth()` dan `getDate()` masih mengembalikan tanggal kemarin. Customer yang ulang tahun hari ini bisa TIDAK mendapat ucapan, atau yang ulang tahun besok malah dapat.

---

### BUG-07: `WaCampaignQueue.findOneAndUpdate` Bisa Claim Campaign dari Tenant Lain [MEDIUM]

**File:** `lib/scheduler.ts:116-126`

**Dampak:** Query tidak memfilter berdasarkan apapun selain status dan scheduledAt. Karena setiap tenant punya DB sendiri, ini sebenarnya aman — tapi jika ada migration ke shared DB, ini akan jadi critical bug.

**Status:** Safe untuk sekarang (database-per-tenant), tapi perlu di-note.

---

### BUG-08: Automation PUT Endpoint Menerima Body Langsung tanpa Validasi [HIGH]

**File:** `app/api/wa/automations/[id]/route.ts:21`  
**Kode:**
```typescript
const automation = await WaAutomation.findByIdAndUpdate(id, body, { new: true });
```

**Dampak:** User bisa mengirim field apapun, termasuk `lastRunDate`, `_id`, `createdAt`, dll. Ini bisa memanipulasi state automation.

**Solusi:** Whitelist field yang boleh di-update:
```typescript
const { name, category, targetRole, frequency, scheduleDays, scheduleTime, daysBefore, messageTemplate, isActive } = body;
const update = { name, category, targetRole, frequency, scheduleDays, scheduleTime, daysBefore, messageTemplate, isActive };
```

---

### BUG-09: Cron Endpoint `/api/wa/cron` Tidak Ada Auth [HIGH]

**File:** `app/api/wa/cron/route.ts`

**Kode:**
```typescript
export async function GET(req: Request) {
    try {
        await connectToDB();
        processPendingCampaigns().catch(console.error);
        processAutomations().catch(console.error);
        return NextResponse.json({ success: true, message: 'Scheduler triggered successfully' });
```

**Dampak:** Siapapun bisa hit endpoint ini dan trigger pengiriman WA massal. Tidak ada CRON_SECRET check, tidak ada permission check.

**Solusi:** Tambahkan auth check:
```typescript
const authHeader = req.headers.get('authorization');
const cronSecret = process.env.CRON_SECRET;
if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
}
```

---

### BUG-10: `validateMessageContent` Tidak Digunakan di Campaign Scheduler [MEDIUM]

**File:** `lib/messageValidator.ts` vs `lib/scheduler.ts`

**Dampak:** `validateMessageContent()` dipanggil di `blast-targets/route.ts` POST tapi HANYA sebagai warning (response tetap sukses). Di `scheduler.ts` (proses kirim sebenarnya), validasi ini **tidak dipanggil sama sekali**.

**Solusi:** Panggil `validateMessageContent` di scheduler sebelum kirim, dan block jika `safe === false`.

---

### BUG-11: Fonnte Webhook Tidak Verifikasi Signature/Token [MEDIUM]

**File:** `app/api/fonnte/webhook/route.ts`

**Dampak:** Endpoint webhook tidak memverifikasi bahwa request benar-benar berasal dari Fonnte. Siapapun bisa POST ke endpoint ini dan trigger auto-greeting ke nomor arbitrary.

**Solusi:** Verifikasi Fonnte webhook signature atau token.

---

### BUG-12: Appointment Reminder Tidak Ada Delay Antar Pesan [MEDIUM]

**File:** `app/api/appointments/send-reminders/route.ts:102`

**Dampak:** Pengiriman reminder dilakukan dalam loop tanpa delay. Jika ada 50 appointment, 50 WA dikirim sekaligus tanpa jeda.

---

## 4. Cacat Logic / User Flow

### FLOW-01: Campaign Dikirim Ulang Jika Server Restart [CRITICAL]

**File:** `lib/scheduler.ts:249-253`

**Logic:** Setelah batch selesai tapi masih ada target pending, campaign di-set kembali ke `pending`. Namun target yang sudah `sent` tidak berubah.

**Masalah:** Jika campaign berhenti di tengah jalan (crash) dan status masih `processing`, setelah 5 menit campaign akan di-reclaim (line 121). Target yang sudah `sent` aman, TAPI blast log belum ditulis (karena log ditulis di akhir).

**Flow Cacat:**
1. Campaign mulai, kirim 30 dari 100 target
2. Server crash
3. 5 menit kemudian, campaign di-reclaim 
4. 70 target pending dikirim ulang (OK)
5. Tapi blast log untuk 30 pertama HILANG selamanya

---

### FLOW-02: Scheduler Berjalan Setiap Menit — Terlalu Agresif [HIGH]

**File:** `lib/scheduler.ts:9`  
**Kode:**
```typescript
const DEFAULT_SCHEDULER_CRON = '* * * * *';
```

**Dampak:** Setiap menit, scheduler melakukan:
1. Query semua tenant slugs dari master DB
2. Untuk setiap tenant: query Settings, WaCampaignQueue, WaAutomation, WaSchedule
3. Ini berarti puluhan query MongoDB per menit per tenant

**Solusi:** Ubah ke `*/5 * * * *` (setiap 5 menit) — cukup untuk kebanyakan use case.

---

### FLOW-03: Automation Daily Report Tidak Pakai Template dari Settings [MEDIUM]

**File:** `lib/scheduler.ts:345-348` vs `models/Settings.ts:153`

**Dampak:** Settings model punya `waTemplateDailyReport` field, tapi `processAutomations` di scheduler menggunakan `rule.messageTemplate` dari WaAutomation collection. Ini berarti ada DUA tempat template disimpan, membingungkan user.

Cron endpoint `wa-daily-report` juga punya template SENDIRI yang di-hardcode (line 97-105). Jadi ada **TIGA versi** template daily report yang bisa berbeda.

---

### FLOW-04: Duplikasi Logic antara Cron Routes dan Scheduler Automations [HIGH]

**Dampak:** Ada dua cara menjalankan notification WA yang sama:

| Notifikasi | Via Scheduler (`processAutomations`) | Via Cron Route |
|-----------|--------------------------------------|----------------|
| Daily Report | `scheduler.ts` category=daily_report | `cron/wa-daily-report/route.ts` |
| Stock Alert | `scheduler.ts` category=stock_alert | `cron/wa-stock-alert/route.ts` |
| Membership Expiry | `scheduler.ts` category=membership_expiry | `cron/wa-membership-expiry/route.ts` |
| Package Expiry | `scheduler.ts` category=package_expiry | `cron/wa-package-expiry/route.ts` |
| Birthday | `scheduler.ts` category=birthday | `cron/birthday-voucher/route.ts` |

**Masalah:** Jika keduanya aktif bersamaan, customer bisa dapat **DOUBLE MESSAGE**. Scheduler mengecek `lastRunDate`, tapi cron route TIDAK. Tidak ada koordinasi antar keduanya.

**Solusi:** Pilih SATU mekanisme (scheduler ATAU cron), bukan keduanya. Atau tambahkan dedup check.

---

### FLOW-05: Warm-up Limit Terlalu Agresif [MEDIUM]

**File:** `lib/scheduler.ts:97-104`  
**Kode:**
```typescript
if (ageDays <= 7) dailyLimit = 10;
else if (ageDays <= 14) dailyLimit = 20;
else if (ageDays <= 30) dailyLimit = 50;
else dailyLimit = 100;
```

**Dampak:** Bahkan nomor yang sudah 1 tahun, daily limit hanya 100 pesan. Ini mungkin terlalu rendah untuk salon besar, tapi juga bisa dianggap terlalu tinggi untuk Fonnte free plan.

**Masalah:** Tidak ada perbedaan limit berdasarkan jenis Fonnte plan (free, basic, premium). Limit harusnya configurable dan mengikuti ketentuan Fonnte.

---

### FLOW-06: Follow-Up Hanya Pilih 1 Service (Prioritas Tertinggi) [LOW]

**File:** `lib/waFollowUp.ts:159-164`

**Dampak:** Jika customer melakukan 3 service dalam 1 transaksi, hanya service dengan harga tertinggi yang mendapat follow-up. Service lain ditandai `failed` (line 214).

**Masalah:** Ini mungkin by design, tapi dari sisi customer UX, follow-up yang hanya menyebut 1 dari 3 service terasa aneh.

---

### FLOW-07: Greeting Log Tidak Punya Mekanisme Reset Periodik [MEDIUM]

**File:** `app/api/fonnte/webhook/route.ts:128-141`

**Dampak:** Customer lama yang kembali setelah berbulan-bulan tidak akan mendapat greeting karena log-nya masih ada. Satu-satunya cara reset adalah manual DELETE via API.

**Solusi:** Implementasi TTL index (lihat BUG-03) atau cron job untuk bersihkan log lama.

---

### FLOW-08: Campaign Queue Tidak Ada Max Target Limit [MEDIUM]

**File:** `app/api/wa/blast-targets/route.ts:146-150` dan `app/api/wa/campaigns/route.ts:69-73`

**Dampak:** User bisa membuat campaign dengan ribuan target. Semua masuk ke satu document MongoDB sebagai embedded array. Ini bisa:
- Melebihi 16MB BSON limit
- Menyebabkan slow queries
- Membuat scheduler stuck di satu campaign yang besar

**Solusi:** Limit max target per campaign (misal 500), dan split campaign yang lebih besar.

---

### FLOW-09: `processAutomations` Tidak Proses Semua Campaign per Tick [LOW]

**File:** `lib/scheduler.ts:116-126`

**Kode:** `findOneAndUpdate` hanya claim SATU campaign per tenant per tick.

**Dampak:** Jika ada 5 campaign pending, dibutuhkan minimal 5 menit (5 tick) untuk memproses semuanya, bahkan jika masing-masing hanya punya 1 target.

---

## 5. Anti-Blocking Strategy

### Risiko Blokir WhatsApp dan Antisipasi

WhatsApp sangat agresif dalam mendeteksi dan memblokir akun yang melakukan pengiriman massal. Berikut analisis dan rekomendasi:

### BLOCK-01: Delay Antar Pesan Tidak Konsisten [CRITICAL]

| Komponen | Delay | Status |
|----------|-------|--------|
| Campaign blast (`scheduler.ts:242`) | 1 detik | **BERBAHAYA** |
| Automation (`scheduler.ts:358,389,426,461,492`) | 10 detik | OK |
| Cron membership-expiry (`route.ts:80`) | 500ms | **BERBAHAYA** |
| Cron package-expiry (`route.ts:77`) | 10 detik | OK |
| Appointment reminder (`route.ts:72-103`) | 0 detik | **BERBAHAYA** |
| Birthday voucher (`route.ts:69-93`) | 0 detik | **BERBAHAYA** |

**Rekomendasi Standard Delay:**
```
Minimum: 8 detik
Optimal: 10-15 detik
Dengan random jitter: baseDelay + Math.random() * 7000 (8-15 detik)
```

**Implementasi yang direkomendasikan:**
```typescript
// lib/waDelay.ts
export async function safeWaDelay(): Promise<void> {
    const baseDelay = 8000;
    const jitter = Math.floor(Math.random() * 7000);
    await new Promise(resolve => setTimeout(resolve, baseDelay + jitter));
}
```

---

### BLOCK-02: Invisible Character Injection Bisa Backfire [HIGH]

**File:** `lib/messageVariation.ts:16-22`  
**Kode:**
```typescript
const INVISIBLE_CHARS = [
    '​', // zero-width space
    '‌', // zero-width non-joiner
    '‍', // zero-width joiner
    '﻿', // zero-width no-break space
];
```

**Masalah:** WhatsApp **SUDAH** mendeteksi invisible characters sebagai taktik spam avoidance. Penggunaan zero-width chars justru MENINGKATKAN risiko blokir, bukan menguranginya.

**Dampak:** 
- WA bisa mendeteksi pattern invisible chars dan langsung flag akun
- Pesan bisa ditampilkan aneh di beberapa device

**Solusi:** Hapus invisible character injection. Gunakan variasi NATURAL saja:
```typescript
export function addMessageVariation(message: string): string {
    let varied = message;
    
    // 1. Variasi greeting
    const greetingMatch = varied.match(/^(Halo|Hai|Hi|Hallo)\b/i);
    if (greetingMatch) {
        const randomGreeting = GREETING_VARIATIONS[Math.floor(Math.random() * GREETING_VARIATIONS.length)];
        varied = varied.replace(greetingMatch[0], randomGreeting);
    }
    
    // 2. Variasi closing (ganti closing variations)
    // 3. Tambahkan timestamp atau personalisasi alami
    // 4. Randomize emoji
    
    // JANGAN gunakan invisible characters!
    return varied;
}
```

---

### BLOCK-03: Tidak Ada Global Rate Limiter [CRITICAL]

**Dampak:** Saat ini rate limiting hanya berdasarkan daily count. Tidak ada per-hour atau per-minute rate limiting. Jika 100 pesan dikirim dalam 10 menit (daily limit 100 dengan 1 detik delay), ini sangat suspicious bagi WhatsApp.

**Rekomendasi:**
```typescript
// Rate limits per time window
const RATE_LIMITS = {
    perMinute: 3,     // Max 3 pesan per menit
    perHour: 20,      // Max 20 pesan per jam
    perDay: 100,      // Max 100 pesan per hari (configurable)
};
```

---

### BLOCK-04: Tidak Ada Pengecekan Nomor Valid Sebelum Blast [HIGH]

**File:** `lib/fonnte.ts:84-110` — fungsi `validateWhatsAppNumber` ada tapi TIDAK digunakan di manapun.

**Dampak:** Blast dikirim ke nomor yang mungkin:
- Tidak terdaftar di WhatsApp
- Sudah tidak aktif
- Salah format

Mengirim ke banyak nomor invalid meningkatkan risiko blokir.

**Solusi:** Validasi nomor sebelum blast:
```typescript
// Di blast-targets POST, validasi sebelum queue
for (const target of targets) {
    const { registered } = await validateWhatsAppNumber(target.phone, token);
    if (!registered) {
        target.status = 'invalid';
    }
    await safeWaDelay(); // delay antar validasi juga
}
```

---

### BLOCK-05: Tidak Ada Session/Warm-up Tracking [HIGH]

**Dampak:** Tidak ada tracking berapa pesan sudah dikirim per jam/per session. Warm-up logic hanya berdasarkan umur device (`fonnteDeviceRegisteredAt`), bukan berdasarkan actual sending pattern.

**Best Practice Warm-Up WA:**
```
Minggu 1: Max 5-10 pesan/hari, manual dulu
Minggu 2: Max 20 pesan/hari
Minggu 3: Max 30-50 pesan/hari  
Minggu 4+: Gradual increase max 100/hari
Bulan 3+: Bisa sampai 200-300/hari (tergantung engagement rate)
```

---

### BLOCK-06: Tidak Ada Cooldown Setelah Error [HIGH]

**File:** `lib/scheduler.ts:213-227`

**Dampak:** Jika Fonnte API mengembalikan error (rate limit, blocked, dll), scheduler langsung lanjut ke target berikutnya dengan delay yang sama. Seharusnya ada exponential backoff.

**Solusi:**
```typescript
// Jika gagal, tunggu lebih lama sebelum coba target berikutnya
if (!result.success) {
    const backoffDelay = 30000 + Math.random() * 30000; // 30-60 detik
    await new Promise(resolve => setTimeout(resolve, backoffDelay));
    
    // Jika error berturut-turut, stop campaign
    consecutiveErrors++;
    if (consecutiveErrors >= 3) {
        campaign.status = 'paused';
        await campaign.save();
        break;
    }
} else {
    consecutiveErrors = 0;
}
```

---

### BLOCK-07: Pesan Identik Dikirim ke Banyak Nomor [MEDIUM]

**Dampak:** Meskipun ada `addMessageVariation()`, variasi yang dihasilkan sangat minimal (ganti greeting + invisible chars). WhatsApp bisa mendeteksi pesan yang "hampir identik" dikirim ke banyak nomor.

**Rekomendasi Variasi Lebih Kuat:**
1. Randomize urutan paragraf (jika memungkinkan)
2. Gunakan sinonim random untuk kata-kata umum
3. Tambahkan personalisasi yang berbeda per customer (nama, service terakhir, dll)
4. Variasi emoji
5. Variasi tanda baca (titik vs tanpa titik, dll)

---

### BLOCK-08: Tidak Ada Opt-Out/Unsubscribe Mechanism yang Jelas [MEDIUM]

**Dampak:** Setiap pesan blast seharusnya menyertakan cara untuk unsubscribe. Ini bukan hanya best practice, tapi juga mengurangi risiko report spam oleh customer.

**Solusi:** Tambahkan footer unsubscribe di setiap blast:
```
Balas "STOP" jika tidak ingin menerima pesan promosi.
```

Dan handle "STOP" di webhook:
```typescript
if (message.toLowerCase().includes('stop')) {
    await Customer.updateOne(
        { phone: normalizedPhone },
        { $set: { waNotifEnabled: false } }
    );
}
```

---

## 6. Security Issues

### SEC-01: Cron Endpoint `/api/wa/cron` Tanpa Autentikasi [CRITICAL]

**File:** `app/api/wa/cron/route.ts`

Endpoint bisa diakses publik tanpa token/secret. Attacker bisa trigger mass WA sending.

---

### SEC-02: Webhook Endpoint Tanpa Signature Verification [HIGH]

**File:** `app/api/fonnte/webhook/route.ts`

Tidak ada verifikasi bahwa request berasal dari Fonnte. Attacker bisa inject fake inbound messages.

---

### SEC-03: Fonnte Token Disimpan Tanpa Enkripsi [MEDIUM]

**File:** `models/Settings.ts:87-89`

`fonnteToken` disimpan plain text di database. Jika DB compromised, token terexpose.

**Solusi:** Gunakan `lib/encryption.ts` yang sudah ada:
```typescript
import { encrypt, decrypt } from '@/lib/encryption';
// Saat simpan: encrypt(fonnteToken)
// Saat baca: decrypt(encryptedToken)
```

---

### SEC-04: Automation Update Terima Raw Body [HIGH]

**File:** `app/api/wa/automations/[id]/route.ts:21`

`findByIdAndUpdate(id, body)` — user bisa inject arbitrary fields.

---

### SEC-05: `WA_TRIGGER_SECRET` Bisa Kosong [MEDIUM]

**File:** `app/api/wa/trigger/route.ts:5-6`
```typescript
if (!configuredSecret) return false;
```

Jika `WA_TRIGGER_SECRET` tidak di-set, endpoint tidak bisa diakses via secret. Tapi juga berarti permission check tetap jalan — ini OK tapi bisa membingungkan.

---

## 7. Race Condition & Concurrency

### RACE-01: Campaign Processing Overlap [HIGH]

**File:** `lib/scheduler.ts:116-126`

**Skenario:** Scheduler berjalan setiap menit. Jika processing campaign memakan waktu > 1 menit:

1. Tick 1: Claim campaign A (status -> processing)
2. Tick 2: Campaign A masih processing, tapi sudah > 5 menit? 
   - Jika ya, claim ulang (bisa double process)
   - Jika tidak, skip (OK)

**Mitigasi yang sudah ada:** `processingAt` check dengan 5 menit timeout. TAPI jika processing memakan waktu tepat di ambang 5 menit, ada window race condition.

---

### RACE-02: Webhook Greeting Duplicate Send [MEDIUM]

**File:** `app/api/fonnte/webhook/route.ts:129-137`

**Skenario:** Customer mengirim 2 pesan dalam waktu < 100ms:
1. Request 1: `findOneAndUpdate` — upsert, `existingGreeting = null`
2. Request 2: `findOneAndUpdate` — find existing, `existingGreeting != null`

**Status:** Sudah di-handle dengan atomic upsert. Aman.

---

### RACE-03: Multiple Scheduler Instances [MEDIUM]

**File:** `lib/scheduler.ts:586-647`

**Skenario:** Di development, hot-reload bisa membuat multiple scheduler instances. `schedulerStarted` flag hanya berlaku per-process, bukan cross-process.

**Mitigasi:** Sudah ada `schedulerStarted` flag, tapi ini tidak persist across hot-reload. Campaign atomic claim (`findOneAndUpdate`) memberikan protection tambahan.

---

### RACE-04: Follow-Up Schedule Duplicate [LOW]

**File:** `lib/waFollowUp.ts:259-260`

**Status:** Sudah di-handle dengan `insertMany({ ordered: false })` dan duplicate key detection. Error 11000 ditangkap dan diabaikan. Aman.

---

## 8. Rekomendasi Perbaikan Prioritas

### Priority 1 - CRITICAL (Harus Segera)

| # | Issue | Aksi |
|---|-------|------|
| 1 | BUG-02: Delay campaign 1 detik | Ubah ke 10-15 detik + random jitter |
| 2 | BLOCK-02: Invisible chars injection | Hapus, gunakan variasi natural saja |
| 3 | BUG-09: Cron endpoint tanpa auth | Tambahkan CRON_SECRET check |
| 4 | BLOCK-03: Tidak ada rate limiter | Implementasi per-hour rate limit |
| 5 | BUG-01: Dedup check dinonaktifkan | Re-enable atau buat mekanisme baru |
| 6 | BLOCK-06: Tidak ada backoff setelah error | Implementasi exponential backoff |
| 7 | FLOW-04: Duplikasi scheduler+cron | Pilih satu mekanisme, disable yang lain |

### Priority 2 - HIGH (Minggu Ini)

| # | Issue | Aksi |
|---|-------|------|
| 8 | BUG-05: Timezone daily volume | Gunakan WIB-aware date calculation |
| 9 | BUG-08: Automation PUT no validation | Whitelist fields |
| 10 | BUG-11: Webhook no signature check | Implementasi Fonnte signature verification |
| 11 | BLOCK-04: Nomor tidak divalidasi | Gunakan `validateWhatsAppNumber` sebelum blast |
| 12 | BLOCK-01: Delay inconsistent | Standarisasi delay ke 10-15 detik di semua endpoint |
| 13 | BUG-12: Appointment reminder no delay | Tambahkan delay |
| 14 | SEC-03: Token plain text | Enkripsi dengan `lib/encryption.ts` |

### Priority 3 - MEDIUM (Bulan Ini)

| # | Issue | Aksi |
|---|-------|------|
| 15 | BUG-03: GreetingLog no TTL | Tambahkan TTL index 30 hari |
| 16 | BUG-04: Blast log hilang saat crash | Tulis log incremental |
| 17 | FLOW-02: Scheduler tiap menit | Ubah ke per 5 menit |
| 18 | FLOW-03: Template duplikasi | Consolidate ke 1 tempat |
| 19 | FLOW-08: No max target limit | Limit 500 target per campaign |
| 20 | BLOCK-08: No opt-out mechanism | Handle "STOP" keyword |
| 21 | BUG-10: Validator tidak dipakai di scheduler | Integrasikan validator |

### Priority 4 - LOW (Enhancement)

| # | Issue | Aksi |
|---|-------|------|
| 22 | FLOW-06: Follow-up hanya 1 service | Consider multi-service follow-up |
| 23 | FLOW-09: 1 campaign per tick | Process multiple campaigns jika quota tersedia |
| 24 | BLOCK-05: Better warm-up tracking | Track hourly sending volume |
| 25 | BLOCK-07: Variasi pesan lebih kuat | Implementasi smart message variation |

---

## 9. File Reference

### Library Files

| File | Lines | Purpose | Issues Found |
|------|-------|---------|-------------|
| `lib/fonnte.ts` | 111 | Fonnte API client | `validateWhatsAppNumber` tidak dipakai |
| `lib/scheduler.ts` | 647 | Campaign/automation/schedule processor | 8 issues |
| `lib/waFollowUp.ts` | 272 | Follow-up scheduling | 1 issue |
| `lib/messageValidator.ts` | 45 | Spam content checker | Tidak digunakan di scheduler |
| `lib/messageVariation.ts` | 48 | Message anti-spam variation | Invisible chars berbahaya |

### API Routes

| File | Method | Purpose | Issues Found |
|------|--------|---------|-------------|
| `app/api/wa/campaigns/route.ts` | GET/POST/DELETE | Campaign CRUD | - |
| `app/api/wa/campaigns/[id]/route.ts` | GET | Campaign detail | - |
| `app/api/wa/blast-targets/route.ts` | GET/POST | Filter & queue blast | Warning tidak blocking |
| `app/api/wa/trigger/route.ts` | GET/POST | Manual scheduler trigger | - |
| `app/api/wa/templates/route.ts` | GET/POST | Template CRUD | - |
| `app/api/wa/templates/[id]/route.ts` | PUT/DELETE | Template update/delete | - |
| `app/api/wa/automations/route.ts` | GET/POST | Automation CRUD | - |
| `app/api/wa/automations/[id]/route.ts` | PUT/DELETE | Automation update/delete | Body tidak divalidasi |
| `app/api/wa/blast-logs/route.ts` | GET | Blast history | - |
| `app/api/wa/follow-up-sessions/route.ts` | GET/PATCH | Follow-up contacts | - |
| `app/api/wa/greeting-logs/route.ts` | GET/DELETE | Greeting log management | - |
| `app/api/wa/cron/route.ts` | GET | Manual cron trigger | **TANPA AUTH** |
| `app/api/fonnte/webhook/route.ts` | GET/POST | Inbound WA handler | No signature verification |
| `app/api/appointments/send-reminders/route.ts` | GET/POST | Appointment WA reminder | No delay between sends |
| `app/api/cron/wa-daily-report/route.ts` | GET | Daily report cron | Duplikasi dengan scheduler |
| `app/api/cron/wa-membership-expiry/route.ts` | GET | Membership expiry cron | Delay 500ms (terlalu pendek) |
| `app/api/cron/wa-package-expiry/route.ts` | GET | Package expiry cron | Duplikasi dengan scheduler |
| `app/api/cron/wa-stock-alert/route.ts` | GET | Stock alert cron | Duplikasi dengan scheduler |
| `app/api/cron/birthday-voucher/route.ts` | GET | Birthday voucher cron | No delay between sends |

### Models

| File | Purpose | Issues Found |
|------|---------|-------------|
| `models/WaCampaignQueue.ts` | Campaign queue schema | No max targets limit |
| `models/WaGreetingLog.ts` | Greeting dedup log | No TTL index |
| `models/WaSchedule.ts` | Follow-up schedule | OK (has partial unique index) |
| `models/WaAutomation.ts` | Automation rules | - |
| `models/WaBlastLog.ts` | Blast history log | - |
| `models/WaTemplate.ts` | Message templates | - |
| `models/WaFollowUpContact.ts` | Follow-up contacts | - |
| `models/Settings.ts` | Tenant settings | Token plain text |

---

## Lampiran: Recommended Safe WA Sending Configuration

```typescript
// Konfigurasi yang direkomendasikan untuk menghindari blokir WA

const WA_SAFE_CONFIG = {
    // Delay antar pesan
    minDelayMs: 8000,           // 8 detik minimum
    maxDelayMs: 15000,          // 15 detik maximum
    errorBackoffMs: 30000,      // 30 detik setelah error
    
    // Rate limits
    maxPerMinute: 3,
    maxPerHour: 20,
    maxPerDay: {
        week1: 10,              // Nomor baru
        week2: 20,
        month1: 50,
        month3: 100,
        mature: 200,            // Nomor > 3 bulan
    },
    
    // Operational hours (WIB)
    opHoursStart: 8,
    opHoursEnd: 20,
    
    // Safety
    maxConsecutiveErrors: 3,    // Pause setelah 3 error berturut
    failRateThreshold: 0.2,    // Stop jika fail rate > 20%
    maxTargetsPerCampaign: 500, // Split campaign yang lebih besar
    
    // Content
    noInvisibleChars: true,     // Jangan pakai zero-width chars
    requireOptOut: true,        // Wajib ada "Balas STOP" di setiap blast
    validateNumberFirst: true,  // Validasi nomor sebelum blast
    
    // Warm-up (pesan pertama ke nomor baru)
    warmUpEnabled: true,
    warmUpDays: 7,              // Kirim manual dulu 7 hari
};
```

---

*Dokumen ini di-generate oleh Claude Code pada 2026-05-15. Review berkala disarankan setiap bulan.*
