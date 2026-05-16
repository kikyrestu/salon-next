# Update Log - Keseluruhan Sistem

**Tanggal:** 2026-05-15  

Dokumen ini berisi riwayat perbaikan untuk isu-isu dari berbagai laporan audit (WA Module, POS, Inventory, dll). Perbaikan difokuskan pada stabilitas, pencegahan pemblokiran WhatsApp, keamanan API, dan kualitas kode.



## [Baru] Modul Inventory (16 Mei 2026)

### 1. BUG-01++: Cacat Logika Stok Minus di POS (Extra Finding)
- **File:** pos/page.tsx & pi/invoices/route.ts
- **Sebelumnya:** Kasir bisa checkout produk melebihi stok, membuat stok minus tanpa error.
- **Sesudahnya:** Validasi ketat di frontend (UI di-blok) dan backend (API otomatis menolak transaksi jika stok tidak cukup).

### 2. BUG-03: Duplikasi Nomor Purchase Order
- **File:** pi/purchases/route.ts
- **Sebelumnya:** Menggunakan count + 1 yang rawan duplikat jika dua kasir buat PO bersamaan.
- **Sesudahnya:** Menggunakan Counter atomic di MongoDB (models/Counter.ts) untuk memastikan nomor unik 100%.

### 3. BUG-04: Kebocoran Data Antar Cabang (Header x-store-slug)
- **File:** products, purchases, usage-logs
- **Sebelumnya:** etch API tidak mengirim header cabang.
- **Sesudahnya:** Semua etch ke API diinjeksi header x-store-slug.

### 4. BUG-07: Error Validasi Kategori Produk
- **File:** pi/products/route.ts
- **Sebelumnya:** Mengirim produk tanpa category memicu Error 500.
- **Sesudahnya:** category ditambahkan ke validasi input wajib (
equired), error pesan lebih jelas.

### 5. BUG-09: Celah Keamanan Endpoint Deposit PO
- **File:** pi/purchases/deposits/route.ts
- **Sebelumnya:** API deposit terbuka untuk umum.
- **Sesudahnya:** Dilindungi dengan middleware checkPermission('purchases').

---


### 6. BE-02: Conflict Detection Rapuh (String Comparison)
- **File:** `api/appointments/route.ts`
- **Sebelumnya:** Membandingkan waktu `HH:mm` sebagai string pakai operator MongoDB Ã¯Â¿Â½ gagal kalau melewati tengah malam.
- **Sesudahnya:** Semua waktu dikonversi ke **integer menit** (misal `14:30` = `870`) dan dibandingkan secara aritmetika.

### 7. BE-03/BE-08: Counter Invoice Tidak Di-rollback
- **File:** `api/appointments/route.ts`
- **Sebelumnya:** Jika `Invoice.create()` gagal, nomor invoice bolong. generateInvoiceNumber diluar try-catch.
- **Sesudahnya:** Dipindah ke dalam try-catch. Counter otomatis di-rollback saat gagal.

### 8. BE-06: Crash Reminder Saat Staff Dihapus
- **File:** `api/appointments/send-reminders/route.ts`
- **Sebelumnya:** Tidak ada null-check untuk staff Ã¯Â¿Â½ crash jika staff sudah dihapus.
- **Sesudahnya:** Tambah pengecekan `if (!staff)` dengan continue dan log error.

### 9. FE-05: Crash Halaman Saat totalAmount Null
- **File:** `appointments/page.tsx`
- **Sebelumnya:** `apt.totalAmount.toLocaleString()` crash jika null/NaN.
- **Sesudahnya:** Menggunakan `(apt.totalAmount ?? 0).toLocaleString()` untuk null-safety.

### 10. FE-06: Filter Status 'No-show' Tidak Tersedia
- **File:** `appointments/page.tsx`
- **Sebelumnya:** Dropdown status hanya 4 opsi.
- **Sesudahnya:** Ditambahkan opsi `no-show` di filter dan form.

### 11. FE-07: Dead Code timeSlots Dihapus
- **File:** `appointments/page.tsx`
- **Sesudahnya:** Array timeSlots yang tidak terpakai dihapus.

### 12. FE-08: Dead Code taxRate Dihapus
- **File:** `appointments/calendar/page.tsx`
- **Sesudahnya:** State taxRate dan fetchSettings yang tidak terpakai dihapus Ã¯Â¿Â½ mengurangi 1 HTTP request sia-sia.

### 13. FE-09: Typo 'Dayly Schedule'
- **File:** `StaffCalendar.tsx`
- **Sesudahnya:** Menggunakan label map (day=Daily, week=Weekly, month=Monthly).

### 14. FE-10: fetchResources Tanpa Error Handling
- **File:** `appointments/calendar/page.tsx`
- **Sesudahnya:** Dibungkus try-catch.

---

## Modul Financial Reports (16 Mei 2026)

### 15. BE-F01: Filter Staff Sales Tidak Berfungsi `[16 Mei 2026 - 15:50 WIB]`
- **File:** `api/reports/route.ts`
- **Fix:** Cast `staffId` dan `serviceId` ke `ObjectId` sebelum query. Filter sales per staff kini berfungsi. 

### 16. BE-F02: Net Profit Tidak Potong Gaji Karyawan `[16 Mei 2026 - 15:50 WIB]`
- **File:** `api/reports/financial/route.ts`
- **Fix:** Tambah agregasi `Payroll` ke kalkulasi `netProfit` dan `cashFlow`. Profit kini realistis.

---

### 17. BE-F03: Invoice Batal Masuk Laporan `[16 Mei 2026 - 15:56 WIB]`
- **File:** `api/reports/route.ts`
- **Fix:** Tambah filter `status: { $nin: ['cancelled', 'voided'] }` di 7 jenis laporan. Revenue tidak lagi terdistorsi.

### 18. BE-F04: Jumlah Appointment Staf Selalu 0 `[16 Mei 2026 - 15:56 WIB]`
- **File:** `api/reports/route.ts`
- **Fix:** Tambah increment `staffStats[id].appointments += 1` di 3 blok staf. Rapor kinerja staf kini akurat.

---

### 19. FE-F01: Kartu Statistik Tidak Render Trend `[16 Mei 2026 - 16:09 WIB]`
- **File:** `reports/page.tsx`
- **Fix:** Ganti import dari `dashboard/StatCard` ke `reports/StatCard`, ubah prop `trend` dari string ke object.

### 20. BE-F06: Laporan Harian Tampil NaN `[16 Mei 2026 - 16:09 WIB]`
- **File:** `api/reports/route.ts`
- **Fix:** Tambah fallback `(inv.amountPaid || 0)` di kalkulasi `totalCollected`. Aman dari data lama yang kosong.

---

### 21. BE-F05: Revenue Staf Dihitung Ganda `[16 Mei 2026 - 16:27 WIB]`
- **File:** `api/reports/route.ts`
- **Fix:** Revenue di-split rata ke semua staf yang terlibat (`inv.totalAmount / staffCount`). Sebelumnya setiap staf dapat kredit penuh, total jadi 3x lipat.

### 22. BE-F07: Payroll Pakai Tanggal Pembuatan, Bukan Tanggal Bayar `[16 Mei 2026 - 16:27 WIB]`
- **File:** `api/reports/route.ts`, `api/reports/financial/route.ts`
- **Fix:** Ganti filter `createdAt` → `paidDate` + tambah `status: 'paid'`. Payroll kini masuk laporan sesuai tanggal pembayaran aktual.

### 23. FE-F02: Sort Tabel Kacau untuk Mata Uang Indonesia `[16 Mei 2026 - 16:27 WIB]`
- **File:** `reports/page.tsx`
- **Fix:** Ganti regex parser `[^0-9.-]+` → `[^0-9-]+`. Format `Rp 1.500.000` sebelumnya di-parse jadi `1.5`, sekarang benar jadi `1500000`.


### 24. FE-F03: Export Wallet & Daily Menghasilkan Data Mentah `[16 Mei 2026 - 16:33 WIB]`
- **File:** `reports/page.tsx`
- **Fix:** Tambah handler export untuk tab `wallet`, `daily`, `expenses`, dan `inventory`. Data kini terformat rapi di XLSX.

### 25. FE-F04: Staff Drilldown Salah Jika Nama Sama `[16 Mei 2026 - 16:33 WIB]`
- **File:** `reports/page.tsx`, `api/reports/route.ts`
- **Fix:** Backend kini menyertakan `_id` di output staff report. Frontend langsung pakai `_id` untuk fetch drilldown, bukan name-matching.


### 26. FE-F05: Preset Range Bisa Undefined `[16 Mei 2026 - 16:40 WIB]`
- **File:** `reports/page.tsx`
- **Fix:** Tambah `default` case di switch `setPresetRange` → fallback ke bulan ini. Mencegah `start`/`end` undefined.

### 27. BE-F09: AI Report Crash Jika OpenAI Response Kosong `[16 Mei 2026 - 16:41 WIB]`
- **File:** `api/ai-reports/route.ts`
- **Fix:** Tambah null-check `aiData.choices[0]?.message?.content` sebelum akses. Return error 502 jika kosong.

### 28. BE-F10: Low Stock AI Hardcode Threshold 10 `[16 Mei 2026 - 16:41 WIB]`
- **File:** `api/ai-reports/route.ts`
- **Fix:** Ganti `{ stock: { $lte: 10 } }` → `{ $expr: { $lte: ['$stock', '$alertQuantity'] } }`. Sekarang pakai threshold per produk.

### 29. FE-F08: Dead Code SalesChart di Reports `[16 Mei 2026 - 16:41 WIB]`
- **File:** `components/reports/SalesChart.tsx`
- **Fix:** File dihapus. Tidak pernah diimport oleh halaman manapun. Versi aktif ada di `components/dashboard/SalesChart.tsx`.


### 30. FE-F06: Commission Staff Drilldown Di-Kalkulasi Ulang Setiap Render `[16 Mei 2026 - 16:52 WIB]`
- **File:** `reports/page.tsx`
- **Fix:** Menggunakan `useMemo` untuk melakukan kalkulasi total komisi dan revenue pada Staff Drilldown Modal. Mencegah O(n*m*k) execution di setiap re-render.

### 31. FE-F07: Silent Failure di Halaman Financial Reports `[16 Mei 2026 - 16:52 WIB]`
- **File:** `reports/financial/page.tsx`
- **Fix:** Menambahkan `error` state dan error UI ketika API mengembalikan respons gagal atau terjadi kesalahan pada `fetchReport`.


### 32. BE-F12: WA Daily Report Hardcode Timezone Asia/Jakarta `[16 Mei 2026 - 16:56 WIB]`
- **File:** `api/cron/wa-daily-report/route.ts`
- **Fix:** Mengganti hardcoded `Asia/Jakarta` dan offset `+07:00` dengan fungsi `getCurrentDateInTimezone` dan `getUtcRangeForDateRange` dari `dateUtils`, serta mengacu pada `settings.timezone`.


### 33. Feature Request: Customer Filter di Sales Report `[16 Mei 2026 - 17:11 WIB]`
- **File:** `reports/page.tsx`
- **Fix:** Menambahkan fitur filter *Customer* pada halaman Sales Report sesuai *request* klien. *Customer list* diekstrak secara dinamis dari data transaksi (`reportData`) menggunakan `useMemo` agar optimal, lalu diaplikasikan ke *filter logic* di sisi *client*.

### 2m. Deduplikasi Scheduler vs Cron Routes (FLOW-04)
- **File:** lib/cronDedup.ts, lib/scheduler.ts, dan semua pp/api/cron/*
- **Sebelumnya:** Pesan bisa terkirim ganda jika 
ode-cron dan eksternal cron berjalan bersamaan.
- **Sesudahnya:** Menggunakan koleksi terpusat CronDedup dengan cek hasRunToday() dan markAsRun().
- **Alasan:** Menyelesaikan masalah duplikasi pesan kronik pada environment VPS tanpa perlu mematikan salah satu mekanisme secara sepihak.


## Batch 3 Ã¢â‚¬â€ Final Enhancements & Security (Selesai)

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

## Batch 1 Ã¢â‚¬â€ Priority CRITICAL (Selesai)

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
- **Sebelumnya:** Error Ã¢â€ â€™ lanjut target berikutnya dengan delay standar
- **Sesudahnya:** Error Ã¢â€ â€™ delay 30-60 detik. 3 error berturut Ã¢â€ â€™ campaign `paused`
- **Alasan:** Memaksa kirim saat API down hanya memperburuk penalti akun.

### 1e. Deduplikasi Reaktif (BUG-01)
- **File:** `lib/scheduler.ts`
- **Sebelumnya:** Cek `WaBlastLog` dikomentari (disabled untuk testing)
- **Sesudahnya:** Cek diaktifkan kembali Ã¢â‚¬â€ skip jika nomor sudah menerima blast dalam 24 jam
- **Alasan:** Menghindari spam ke pelanggan yang sama, mencegah Report Spam.

### 1f. Autentikasi Cron Endpoint (BUG-09 / SEC-01)
- **File:** `app/api/wa/cron/route.ts`
- **Sebelumnya:** Endpoint publik tanpa proteksi
- **Sesudahnya:** Validasi `Authorization: Bearer CRON_SECRET`
- **Alasan:** Mencegah attacker memicu mass WA sending tanpa izin.

---

## Batch 2 Ã¢â‚¬â€ Priority HIGH & MEDIUM (Selesai)

### 2a. Timezone Daily Volume Count (BUG-05)
- **File:** `lib/scheduler.ts`
- **Sebelumnya:** `todayStart.setHours(0,0,0,0)` Ã¢â€ â€™ pakai UTC server
- **Sesudahnya:** `Intl.DateTimeFormat` dengan `timeZone: 'Asia/Jakarta'` Ã¢â€ â€™ WIB midnight
- **Alasan:** Di cloud (UTC), daily count dihitung dari 07:00 WIB bukan 00:00 WIB.

### 2b. Birthday Automation Timezone (BUG-06)
- **File:** `lib/scheduler.ts`
- **Sebelumnya:** `now.getMonth() + 1` / `now.getDate()` Ã¢â€ â€™ pakai UTC
- **Sesudahnya:** `Intl.DateTimeFormat` WIB-aware untuk month dan day
- **Alasan:** Antara 00:00-07:00 WIB, getDate() mengembalikan tanggal kemarin di server UTC.

### 2c. Automation PUT Field Whitelist (BUG-08 / SEC-04)
- **File:** `app/api/wa/automations/[id]/route.ts`
- **Sebelumnya:** `findByIdAndUpdate(id, body)` Ã¢â€ â€™ menerima raw body
- **Sesudahnya:** Whitelist: `name, category, targetRole, frequency, scheduleDays, scheduleTime, daysBefore, messageTemplate, isActive`. Validasi format `scheduleTime` (HH:MM).
- **Alasan:** Mencegah injection field internal (`lastRunDate`, `_id`, `createdAt`).

### 2d. TTL Index WaGreetingLog (BUG-03 / FLOW-07)
- **File:** `models/WaGreetingLog.ts`
- **Sebelumnya:** Tidak ada TTL Ã¢â‚¬â€ log greeting selamanya tersimpan
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
- **Alasan:** Tidak ada delay sama sekali Ã¢â€ â€™ semua WA dikirim serentak.

### 2h. Double checkPermission Fix (BUG-10 dari WA_Bug_Analysis)
- **File:** `app/api/wa/templates/route.ts`
- **Sebelumnya:** 2x `checkPermission()` Ã¢â€ â€™ 2x `auth()` call
- **Sesudahnya:** `checkPermissionWithSession()` Ã¢â€ â€™ 1x auth, reuse session
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
- **Sebelumnya:** Tidak ada limit Ã¢â€ â€™ ribuan target bisa masuk 1 dokumen
- **Sesudahnya:** Maksimal 500 target per campaign
- **Alasan:** Mencegah BSON 16MB limit dan scheduler stuck pada campaign terlalu besar.

### 2l. Message Validator di Scheduler (BUG-10)
- **File:** `lib/scheduler.ts`
- **Sebelumnya:** `validateMessageContent()` hanya dipanggil saat queue (warning saja)
- **Sesudahnya:** Juga dipanggil di scheduler sebelum kirim Ã¢â‚¬â€ log warning jika unsafe
- **Alasan:** Deteksi dini konten berisiko spam sebelum pesan benar-benar dikirim ke WhatsApp.

---

## Ringkasan Status Audit

| Kode Issue | Deskripsi | Status |
|---|---|---|
| BUG-01 | Dedup check disabled | Ã¢Å“â€¦ Fixed |
| BUG-02 | Campaign delay 1 detik | Ã¢Å“â€¦ Fixed |
| BUG-03 | GreetingLog no TTL | Ã¢Å“â€¦ Fixed |
| BUG-04 | Blast log hilang saat crash | Ã¢Å“â€¦ Fixed (incremental save per-target) |
| BUG-05 | Timezone daily volume | Ã¢Å“â€¦ Fixed |
| BUG-06 | Birthday timezone | Ã¢Å“â€¦ Fixed |
| BUG-07 | Campaign claim cross-tenant | Ã¢Å¡Âª Safe (DB per tenant) |
| BUG-08 | Automation PUT no validation | Ã¢Å“â€¦ Fixed |
| BUG-09 | Cron no auth | Ã¢Å“â€¦ Fixed |
| BUG-10 | Validator tidak di scheduler | Ã¢Å“â€¦ Fixed |
| BUG-11 | Webhook no signature | Ã¢Å“â€¦ Fixed |
| BUG-12 | Appointment reminder no delay | Ã¢Å“â€¦ Fixed |
| FLOW-01 | Campaign resend setelah crash | Ã¢Å“â€¦ Mitigated (per-target save) |
| FLOW-02 | Scheduler tiap menit | Ã¢Å“â€¦ Fixed (5 menit) |
| FLOW-03 | Template duplikasi | Ã¢Å“â€¦ Fixed |
| FLOW-04 | Duplikasi scheduler+cron | Ã¢Å“â€¦ Fixed (Shared CronDedup) |
| FLOW-05 | Warm-up limit configurable | Ã¢Å¡Â Ã¯Â¸Â Enhancement |
| FLOW-06 | Follow-up 1 service only | Ã¢Å¡Âª By design |
| FLOW-07 | Greeting no reset | Ã¢Å“â€¦ Fixed (TTL 30 hari) |
| FLOW-08 | No max target limit | Ã¢Å“â€¦ Fixed (500 max) |
| FLOW-09 | 1 campaign per tick | Ã¢Å¡Âª Acceptable |
| BLOCK-01 | Delay tidak konsisten | Ã¢Å“â€¦ Fixed (semua 8-15s) |
| BLOCK-02 | Invisible chars | Ã¢Å“â€¦ Fixed (dihapus) |
| BLOCK-03 | No hourly rate limit | Ã¢Å“â€¦ Fixed |
| BLOCK-04 | Nomor tidak divalidasi | Ã¢Å“â€¦ Fixed |
| BLOCK-05 | No warm-up tracking | Ã¢Å¡Â Ã¯Â¸Â Enhancement |
| BLOCK-06 | No backoff setelah error | Ã¢Å“â€¦ Fixed |
| BLOCK-07 | Variasi pesan lemah | Ã¢Å“â€¦ Fixed |
| BLOCK-08 | No opt-out mechanism | Ã¢Å“â€¦ Fixed |
| SEC-01 | Cron tanpa auth | Ã¢Å“â€¦ Fixed |
| SEC-02 | Webhook no signature | Ã¢Å“â€¦ Fixed |
| SEC-03 | Token plain text | Ã¢Å“â€¦ Fixed |
| SEC-04 | Automation raw body | Ã¢Å“â€¦ Fixed |
| SEC-05 | WA_TRIGGER_SECRET kosong | Ã¢Å¡Âª Acceptable |
| RACE-01 | Campaign overlap | Ã¢Å¡Âª Mitigated (atomic claim) |
| RACE-02 | Webhook greeting dup | Ã¢Å¡Âª Safe (atomic upsert) |
| RACE-03 | Multi scheduler instance | Ã¢Å¡Âª Mitigated (flag + atomic) |
| RACE-04 | Follow-up dup | Ã¢Å¡Âª Safe (ordered:false + dedup) |

**Legenda:**
- Ã¢Å“â€¦ Fixed Ã¢â‚¬â€ sudah diperbaiki
- Ã¢Å¡Â Ã¯Â¸Â Deferred/Enhancement Ã¢â‚¬â€ ditunda atau butuh keputusan arsitektur
- Ã¢Å¡Âª Safe/Acceptable Ã¢â‚¬â€ aman atau by design

---

*Dokumen ini terakhir diperbarui pada 2026-05-15.*






