# Update Log - WA Module Audit Fixes

**Tanggal:** 2026-05-15  
**Dikerjakan Oleh:** Antigravity (AI Assistant)

Dokumen ini berisi riwayat perbaikan untuk isu-isu yang ditemukan pada `AUDIT-WA-MODULE.md` dan `WA_Bug_Analysis_Report.md`. Perbaikan difokuskan pada stabilitas, pencegahan pemblokiran WhatsApp, keamanan API, dan kualitas kode.


### 2m. Deduplikasi Scheduler vs Cron Routes (FLOW-04)
- **File:** lib/cronDedup.ts, lib/scheduler.ts, dan semua pp/api/cron/*
- **Sebelumnya:** Pesan bisa terkirim ganda jika 
ode-cron dan eksternal cron berjalan bersamaan.
- **Sesudahnya:** Menggunakan koleksi terpusat CronDedup dengan cek hasRunToday() dan markAsRun().
- **Alasan:** Menyelesaikan masalah duplikasi pesan kronik pada environment VPS tanpa perlu mematikan salah satu mekanisme secara sepihak.


## Batch 3 — Final Enhancements & Security (Selesai)

### 3a. Verifikasi Signature Webhook Fonnte (SEC-02 / BUG-11)
- **File:** pp/api/fonnte/webhook/route.ts
- **Sebelumnya:** Endpoint terbuka untuk umum, siapa saja bisa injeksi payload.
- **Sesudahnya:** Wajib melampirkan Token Fonnte di Header Authorization. Jika token tidak valid, akan ditolak (HTTP 401).

### 3b. Enkripsi Fonnte Token di Database (SEC-03)
- **File:** lib/encryption.ts, pp/api/settings/route.ts, dan file consumer lainnya.
- **Sebelumnya:** Token tersimpan plain text.
- **Sesudahnya:** Token dienkripsi menggunakan algoritma es-256-cbc. Skrip otomatis mendekripsi token di runtime sebelum dikirim ke API Fonnte. Terdapat *backward compatibility* untuk mengakomodir token *plain text* lama.

### 3c. Validasi Nomor Sebelum Blast Campaign (BLOCK-04)
- **File:** pp/api/wa/blast-targets/route.ts
- **Sebelumnya:** Langsung dimasukkan ke *queue* tanpa tahu apakah nomor tersebut valid / terdaftar di WA.
- **Sesudahnya:** Melakukan pengecekan alidateWhatsAppNumber ke API Fonnte dengan concurrency batch of 5. Hanya nomor yang teregistrasi WA yang di-*queue* dengan status pending.

### 3d. Variasi Pesan Lebih Kuat (BLOCK-07)
- **File:** lib/messageVariation.ts
- **Sebelumnya:** Hanya mengubah *greeting* di awal kalimat (Halo/Hai).
- **Sesudahnya:** Menambahkan rotasi salam penutup acak di bagian akhir pesan dan injeksi emoji acak di akhir kalimat tertentu untuk membuat *signature* string pesan benar-benar unik.

### 3e. Konsolidasi Template Daily Report (FLOW-03)
- **File:** lib/scheduler.ts
- **Sebelumnya:** Ada konflik konfigurasi template antara Settings dan Automation Rule.
- **Sesudahnya:** Prioritas utama menggunakan settings.waTemplateDailyReport, fallback ke 
ule.messageTemplate, fallback terakhir ke *hardcoded string*.

---

## Batch 1 — Priority CRITICAL (Selesai)

### 1a. Delay Campaign Blast (BUG-02 / BLOCK-01)
- **File:** `lib/scheduler.ts`
- **Sebelumnya:** Delay 1 detik (`setTimeout(..., 1000)`)
- **Sesudahnya:** Delay acak 8-15 detik (`8000 + Math.random() * 7000`)
- **Alasan:** 1 detik langsung memicu deteksi spam WhatsApp. Delay dinamis mensimulasikan perilaku manusia.

### 1b. Invisible Characters Dihapus (BLOCK-02)
- **File:** `lib/messageVariation.ts`
- **Sebelumnya:** Menyisipkan zero-width space (`\u200B`, `\u200C`, `\u200D`, `\uFEFF`)
- **Sesudahnya:** Array `INVISIBLE_CHARS` dan loop injeksi dihapus total
- **Alasan:** WhatsApp kini mendeteksi zero-width chars sebagai indikator bot spam.

### 1c. Rate Limiter Per Jam (BLOCK-03)
- **File:** `lib/scheduler.ts`
- **Sebelumnya:** Hanya limit harian
- **Sesudahnya:** Agregasi `WaBlastLog` per jam, maks 50 pesan/jam/tenant
- **Alasan:** Mengirim 100 pesan dalam 15 menit sangat berisiko. Hourly limit menyebar traffic.

### 1d. Exponential Backoff & Auto-Pause (BLOCK-06)
- **File:** `lib/scheduler.ts`
- **Sebelumnya:** Error → lanjut target berikutnya dengan delay standar
- **Sesudahnya:** Error → delay 30-60 detik. 3 error berturut → campaign `paused`
- **Alasan:** Memaksa kirim saat API down hanya memperburuk penalti akun.

### 1e. Deduplikasi Reaktif (BUG-01)
- **File:** `lib/scheduler.ts`
- **Sebelumnya:** Cek `WaBlastLog` dikomentari (disabled untuk testing)
- **Sesudahnya:** Cek diaktifkan kembali — skip jika nomor sudah menerima blast dalam 24 jam
- **Alasan:** Menghindari spam ke pelanggan yang sama, mencegah Report Spam.

### 1f. Autentikasi Cron Endpoint (BUG-09 / SEC-01)
- **File:** `app/api/wa/cron/route.ts`
- **Sebelumnya:** Endpoint publik tanpa proteksi
- **Sesudahnya:** Validasi `Authorization: Bearer CRON_SECRET`
- **Alasan:** Mencegah attacker memicu mass WA sending tanpa izin.

---

## Batch 2 — Priority HIGH & MEDIUM (Selesai)

### 2a. Timezone Daily Volume Count (BUG-05)
- **File:** `lib/scheduler.ts`
- **Sebelumnya:** `todayStart.setHours(0,0,0,0)` → pakai UTC server
- **Sesudahnya:** `Intl.DateTimeFormat` dengan `timeZone: 'Asia/Jakarta'` → WIB midnight
- **Alasan:** Di cloud (UTC), daily count dihitung dari 07:00 WIB bukan 00:00 WIB.

### 2b. Birthday Automation Timezone (BUG-06)
- **File:** `lib/scheduler.ts`
- **Sebelumnya:** `now.getMonth() + 1` / `now.getDate()` → pakai UTC
- **Sesudahnya:** `Intl.DateTimeFormat` WIB-aware untuk month dan day
- **Alasan:** Antara 00:00-07:00 WIB, getDate() mengembalikan tanggal kemarin di server UTC.

### 2c. Automation PUT Field Whitelist (BUG-08 / SEC-04)
- **File:** `app/api/wa/automations/[id]/route.ts`
- **Sebelumnya:** `findByIdAndUpdate(id, body)` → menerima raw body
- **Sesudahnya:** Whitelist: `name, category, targetRole, frequency, scheduleDays, scheduleTime, daysBefore, messageTemplate, isActive`. Validasi format `scheduleTime` (HH:MM).
- **Alasan:** Mencegah injection field internal (`lastRunDate`, `_id`, `createdAt`).

### 2d. TTL Index WaGreetingLog (BUG-03 / FLOW-07)
- **File:** `models/WaGreetingLog.ts`
- **Sebelumnya:** Tidak ada TTL — log greeting selamanya tersimpan
- **Sesudahnya:** `index({ firstMessageAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 })`
- **Alasan:** Customer lama yang kembali setelah 30 hari bisa dapat greeting ulang. Koleksi tidak membengkak tanpa batas.

### 2e. Delay Appointment Reminder (BUG-12 / BLOCK-01)
- **File:** `app/api/appointments/send-reminders/route.ts`
- **Sebelumnya:** 0 detik delay antar pengiriman WA
- **Sesudahnya:** 8-15 detik random delay
- **Alasan:** 50 WA sekaligus tanpa jeda = deteksi spam instan.

### 2f. Delay Membership Expiry Cron (BLOCK-01)
- **File:** `app/api/cron/wa-membership-expiry/route.ts`
- **Sebelumnya:** 500ms delay
- **Sesudahnya:** 8-15 detik random delay
- **Alasan:** 500ms masih terlalu cepat untuk pengiriman massal WA.

### 2g. Delay Birthday Voucher Cron (BLOCK-01)
- **File:** `app/api/cron/birthday-voucher/route.ts`
- **Sebelumnya:** 0 detik delay
- **Sesudahnya:** 8-15 detik random delay
- **Alasan:** Tidak ada delay sama sekali → semua WA dikirim serentak.

### 2h. Double checkPermission Fix (BUG-10 dari WA_Bug_Analysis)
- **File:** `app/api/wa/templates/route.ts`
- **Sebelumnya:** 2x `checkPermission()` → 2x `auth()` call
- **Sesudahnya:** `checkPermissionWithSession()` → 1x auth, reuse session
- **Alasan:** Mengurangi overhead latency pada endpoint yang sering dipanggil.

### 2i. Scheduler Interval (FLOW-02)
- **File:** `lib/scheduler.ts`
- **Sebelumnya:** `* * * * *` (setiap 1 menit)
- **Sesudahnya:** `*/5 * * * *` (setiap 5 menit)
- **Alasan:** Mengurangi puluhan query MongoDB per menit per tenant. 5 menit cukup responsif untuk campaign/automation.

### 2j. Opt-Out STOP Mechanism (BLOCK-08)
- **File:** `app/api/fonnte/webhook/route.ts`
- **Sebelumnya:** Tidak ada cara bagi customer untuk berhenti terima pesan promosi
- **Sesudahnya:** Jika customer kirim "STOP", "BERHENTI", atau "UNSUBSCRIBE", sistem otomatis set `waNotifEnabled: false` dan kirim konfirmasi
- **Alasan:** Mengurangi risiko report spam. Mematuhi best practice WA marketing.

### 2k. Max Target Per Campaign (FLOW-08)
- **File:** `app/api/wa/blast-targets/route.ts` dan `app/api/wa/campaigns/route.ts`
- **Sebelumnya:** Tidak ada limit → ribuan target bisa masuk 1 dokumen
- **Sesudahnya:** Maksimal 500 target per campaign
- **Alasan:** Mencegah BSON 16MB limit dan scheduler stuck pada campaign terlalu besar.

### 2l. Message Validator di Scheduler (BUG-10)
- **File:** `lib/scheduler.ts`
- **Sebelumnya:** `validateMessageContent()` hanya dipanggil saat queue (warning saja)
- **Sesudahnya:** Juga dipanggil di scheduler sebelum kirim — log warning jika unsafe
- **Alasan:** Deteksi dini konten berisiko spam sebelum pesan benar-benar dikirim ke WhatsApp.

---

## Ringkasan Status Audit

| Kode Issue | Deskripsi | Status |
|---|---|---|
| BUG-01 | Dedup check disabled | ✅ Fixed |
| BUG-02 | Campaign delay 1 detik | ✅ Fixed |
| BUG-03 | GreetingLog no TTL | ✅ Fixed |
| BUG-04 | Blast log hilang saat crash | ✅ Fixed (incremental save per-target) |
| BUG-05 | Timezone daily volume | ✅ Fixed |
| BUG-06 | Birthday timezone | ✅ Fixed |
| BUG-07 | Campaign claim cross-tenant | ⚪ Safe (DB per tenant) |
| BUG-08 | Automation PUT no validation | ✅ Fixed |
| BUG-09 | Cron no auth | ✅ Fixed |
| BUG-10 | Validator tidak di scheduler | ✅ Fixed |
| BUG-11 | Webhook no signature | ✅ Fixed |
| BUG-12 | Appointment reminder no delay | ✅ Fixed |
| FLOW-01 | Campaign resend setelah crash | ✅ Mitigated (per-target save) |
| FLOW-02 | Scheduler tiap menit | ✅ Fixed (5 menit) |
| FLOW-03 | Template duplikasi | ✅ Fixed |
| FLOW-04 | Duplikasi scheduler+cron | ✅ Fixed (Shared CronDedup) |
| FLOW-05 | Warm-up limit configurable | ⚠️ Enhancement |
| FLOW-06 | Follow-up 1 service only | ⚪ By design |
| FLOW-07 | Greeting no reset | ✅ Fixed (TTL 30 hari) |
| FLOW-08 | No max target limit | ✅ Fixed (500 max) |
| FLOW-09 | 1 campaign per tick | ⚪ Acceptable |
| BLOCK-01 | Delay tidak konsisten | ✅ Fixed (semua 8-15s) |
| BLOCK-02 | Invisible chars | ✅ Fixed (dihapus) |
| BLOCK-03 | No hourly rate limit | ✅ Fixed |
| BLOCK-04 | Nomor tidak divalidasi | ✅ Fixed |
| BLOCK-05 | No warm-up tracking | ⚠️ Enhancement |
| BLOCK-06 | No backoff setelah error | ✅ Fixed |
| BLOCK-07 | Variasi pesan lemah | ✅ Fixed |
| BLOCK-08 | No opt-out mechanism | ✅ Fixed |
| SEC-01 | Cron tanpa auth | ✅ Fixed |
| SEC-02 | Webhook no signature | ✅ Fixed |
| SEC-03 | Token plain text | ✅ Fixed |
| SEC-04 | Automation raw body | ✅ Fixed |
| SEC-05 | WA_TRIGGER_SECRET kosong | ⚪ Acceptable |
| RACE-01 | Campaign overlap | ⚪ Mitigated (atomic claim) |
| RACE-02 | Webhook greeting dup | ⚪ Safe (atomic upsert) |
| RACE-03 | Multi scheduler instance | ⚪ Mitigated (flag + atomic) |
| RACE-04 | Follow-up dup | ⚪ Safe (ordered:false + dedup) |

**Legenda:**
- ✅ Fixed — sudah diperbaiki
- ⚠️ Deferred/Enhancement — ditunda atau butuh keputusan arsitektur
- ⚪ Safe/Acceptable — aman atau by design

---

*Dokumen ini terakhir diperbarui pada 2026-05-15.*
