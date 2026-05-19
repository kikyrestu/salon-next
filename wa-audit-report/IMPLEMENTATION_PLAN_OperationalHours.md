# 📋 Implementation Plan — Dynamic WA Operational Hours

> **Proyek:** SalonNext · **Fitur:** Jam Operasional WA yang Bisa Dikonfigurasi  
> **Tanggal:** Mei 2026 · **Status:** Ready to Implement

---

## 🎯 Ringkasan Tujuan

| | Kondisi Saat Ini | Kondisi Target |
|---|---|---|
| **Campaign / Blast** | ✅ Sudah baca `waOperationalHoursStart/End` dari DB | ✅ Pertahankan |
| **Cron: Daily Report** | ❌ Tidak cek jam operasional | ✅ Cek jam + punya jadwal sendiri |
| **Cron: Membership Expiry** | ❌ Tidak cek jam operasional | ✅ Cek jam operasional |
| **Cron: Package Expiry** | ❌ Tidak cek jam operasional | ✅ Cek jam operasional |
| **Cron: Stock Alert** | ❌ Tidak cek jam operasional | ✅ Cek jam operasional |
| **Cron: Birthday Voucher** | ❌ Tidak cek jam operasional | ✅ Cek jam operasional |
| **processAutomations()** | ❌ Tidak cek jam operasional global | ✅ Respect operational hours |
| **UI Settings** | ⚠️ Input number 0-23 (kaku & tidak intuitif) | ✅ Time picker visual dengan preview |

---

## 🔍 Analisis Kode — Apa yang Sudah Ada

### A. Model `Settings` (models/Settings.ts) — ✅ Schema sudah benar

Field `waOperationalHoursStart` dan `waOperationalHoursEnd` **sudah ada** di schema dengan default yang tepat:

```typescript
// models/Settings.ts — SUDAH ADA, TIDAK PERLU DIUBAH
waOperationalHoursStart: {
    type: Number,
    default: 8,    // ← jam 08.00 WIB
    min: 0,
    max: 23
},
waOperationalHoursEnd: {
    type: Number,
    default: 20,   // ← jam 20.00 WIB
    min: 0,
    max: 23
},
```

### B. `processPendingCampaigns()` (lib/scheduler.ts) — ✅ Sudah benar

Fungsi campaign **sudah membaca dari DB** dan menghentikan pengiriman di luar jam operasional:

```typescript
// lib/scheduler.ts — SUDAH ADA DAN BENAR
const opStart = settings.waOperationalHoursStart ?? 8;
const opEnd   = settings.waOperationalHoursEnd   ?? 20;

if (hourWIB < opStart || hourWIB >= opEnd) {
    console.log(`[CAMPAIGN:${slug}] Outside operational hours...`);
    continue;  // skip — BENAR
}
```

### C. API PUT `/api/settings` — ✅ Sudah accept & simpan field

`waOperationalHoursStart` dan `waOperationalHoursEnd` sudah ada di `ALLOWED_FIELDS`.

### D. Settings Page Frontend — ⚠️ Ada tapi kurang user-friendly

```tsx
// Saat ini: input angka mentah 0-23
<FormInput
    label="Jam Mulai Operasional WA"
    type="number" min="0" max="23"
    value={settings.waOperationalHoursStart?.toString()}
    onChange={...}
    placeholder="8"
/>
```

---

## ❌ GAP ANALYSIS — Yang Belum Ada

### Problem #1: Semua cron route tidak cek jam operasional

Semua cron berikut **langsung kirim WA** kapan saja cron-job.org ping, tanpa cek jam:

| File | Kode yang Bermasalah |
|---|---|
| `app/api/cron/wa-daily-report/route.ts` | Langsung `sendWhatsApp()` tanpa cek jam |
| `app/api/cron/wa-membership-expiry/route.ts` | Loop customer langsung kirim |
| `app/api/cron/wa-package-expiry/route.ts` | Loop package langsung kirim |
| `app/api/cron/wa-stock-alert/route.ts` | Langsung kirim ke admin |
| `app/api/cron/birthday-voucher/route.ts` | Langsung kirim ke customer |

### Problem #2: `processAutomations()` tidak cek jam operasional global

Meski setiap `rule` punya `scheduleTime`, tidak ada pengecekan apakah jam itu ada di dalam window operasional.

### Problem #3: UI tidak intuitif

Input `type="number" 0-23` sulit dimengerti. User tidak tahu ini jam. Tidak ada preview visual kapan WA akan dikirim.

### Problem #4: Tidak ada per-type schedule untuk notifikasi otomatis

`dailyReportTime: '21:00'` ada di schema tapi tidak dipakai secara konsisten. Notifikasi lain (membership, package, stock, birthday) tidak punya jadwal jam sendiri — mereka bergantung pada kapan cron-job.org dipanggil.

---

## 🗺️ Flowchart Sistem

### Flowchart A — Alur Pengiriman WA saat ini vs target

```
┌─────────────────────────────────────────────────────────────────────┐
│  SAAT INI (MASALAH)                                                  │
│                                                                       │
│  cron-job.org ping /api/cron/wa-daily-report                         │
│          │                                                            │
│          ▼                                                            │
│  ┌─────────────────┐                                                  │
│  │  Ambil settings │                                                  │
│  └────────┬────────┘                                                  │
│           │                                                            │
│           ▼                                                            │
│  ┌──────────────────┐     LANGSUNG kirim WA                           │
│  │  sendWhatsApp()  │◄──── tanpa cek jam!                             │
│  └──────────────────┘     ← MASALAH: bisa kirim jam 03.00!            │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  TARGET (SOLUSI)                                                      │
│                                                                       │
│  cron-job.org ping /api/cron/wa-daily-report                         │
│          │                                                            │
│          ▼                                                            │
│  ┌─────────────────┐                                                  │
│  │  Ambil settings │ (waOperationalHoursStart, End, dailyReportTime)  │
│  └────────┬────────┘                                                  │
│           │                                                            │
│           ▼                                                            │
│  ┌──────────────────────────────┐                                     │
│  │  isWithinOperationalHours()  │                                     │
│  └──────────┬───────────────────┘                                     │
│             │                                                          │
│      ┌──────┴──────┐                                                  │
│      │ Jam = 08-20?│                                                  │
│     NO            YES                                                 │
│      │             │                                                  │
│      ▼             ▼                                                  │
│  Return skip   sudah jadwalnya?                                       │
│  (200 OK,       │           │                                         │
│   no send)     YES          NO                                        │
│                 │            │                                         │
│                 ▼        Return skip                                  │
│          sendWhatsApp()  (belum waktunya)                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Implementation Plan — 5 Phase

---

### PHASE 1 — Buat Shared Utility `lib/waOperationalHours.ts`

**Tujuan:** Satu fungsi reusable yang dipakai oleh semua cron route.  
**Effort:** ~30 menit  
**File baru:** `lib/waOperationalHours.ts`

**Narasi:**  
Daripada copy-paste logika pengecekan jam di 5 file yang berbeda, kita buat satu helper yang bisa dipanggil dari mana saja. Helper ini menerima object `settings` dari DB dan `now` (current time), lalu mengembalikan `true` jika saat ini ada di dalam jam operasional WA.

```typescript
// lib/waOperationalHours.ts — FILE BARU

export interface OperationalHoursSettings {
    waOperationalHoursStart?: number; // jam mulai (0-23), default 8
    waOperationalHoursEnd?: number;   // jam selesai (0-23), default 20
    timezone?: string;                // timezone toko, default 'Asia/Jakarta'
}

/**
 * Cek apakah waktu sekarang ada di dalam jam operasional WA.
 * 
 * @param settings - Settings dari DB (hanya perlu 3 field)
 * @param now      - Waktu saat ini (default: new Date())
 * @returns { allowed: boolean; currentHour: number; reason?: string }
 */
export function checkOperationalHours(
    settings: OperationalHoursSettings,
    now: Date = new Date()
): { allowed: boolean; currentHour: number; reason?: string } {
    
    const tz       = settings.timezone || 'Asia/Jakarta';
    const opStart  = settings.waOperationalHoursStart ?? 8;
    const opEnd    = settings.waOperationalHoursEnd   ?? 20;

    // Ambil jam saat ini di timezone toko (bukan UTC)
    const currentHour = parseInt(
        new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            hour: 'numeric',
            hour12: false,
        }).format(now)
    );

    // Edge case: jika start >= end (misalnya start=22, end=4) → overnight window
    // Untuk sekarang kita skip overnight, tapi siapkan untuk masa depan
    if (opStart >= opEnd) {
        return {
            allowed: false,
            currentHour,
            reason: `Invalid operational hours config: start (${opStart}) >= end (${opEnd})`
        };
    }

    const allowed = currentHour >= opStart && currentHour < opEnd;
    
    return {
        allowed,
        currentHour,
        reason: allowed
            ? undefined
            : `Outside operational hours (now: ${currentHour}:xx, allowed: ${opStart}:00-${opEnd}:00 ${tz})`
    };
}

/**
 * Cek apakah sudah melewati waktu jadwal hari ini.
 * Dipakai untuk notifikasi yang punya jam spesifik (misal daily report jam 21:00)
 *
 * @param scheduleTime - string "HH:MM" (misal "21:00")
 * @param settings     - settings dari DB
 * @param now          - waktu sekarang
 * @returns { ready: boolean; scheduledAt: string; reason?: string }
 */
export function checkScheduleTime(
    scheduleTime: string,
    settings: OperationalHoursSettings,
    now: Date = new Date()
): { ready: boolean; scheduledAt: string; reason?: string } {
    
    const tz = settings.timezone || 'Asia/Jakarta';
    const [hh, mm] = scheduleTime.split(':').map(Number);
    
    // Buat Date object untuk scheduled time di timezone toko
    const nowInTz = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    const scheduledToday = new Date(nowInTz);
    scheduledToday.setHours(hh, mm, 0, 0);
    
    const ready = nowInTz.getTime() >= scheduledToday.getTime();
    
    return {
        ready,
        scheduledAt: `${scheduleTime} ${tz}`,
        reason: ready
            ? undefined
            : `Not yet time (scheduled: ${scheduleTime}, now: ${nowInTz.getHours()}:${String(nowInTz.getMinutes()).padStart(2,'0')})`
    };
}
```

---

### PHASE 2 — Update Semua Cron Route

**Tujuan:** Tambah pengecekan jam operasional di setiap cron route.  
**Effort:** ~20 menit per file (total ~2 jam)  
**Files yang berubah:** 5 file

---

#### 2.1 — `app/api/cron/wa-daily-report/route.ts`

**Narasi:**  
Daily report punya keunikan: ia punya jadwal spesifik (`dailyReportTime = '21:00'`). Kita perlu cek DUA hal: (1) apakah sekarang dalam jam operasional, DAN (2) apakah sudah melewati jam jadwal kirim.

```typescript
// Tambahkan import di bagian atas
import { checkOperationalHours, checkScheduleTime } from '@/lib/waOperationalHours';

// Tambahkan SETELAH settings = await Settings.findOne()
// dan SEBELUM hasRunToday check:

// === OPERATIONAL HOURS CHECK ===
const opCheck = checkOperationalHours(settings, now);
if (!opCheck.allowed) {
    return NextResponse.json({
        success: true,
        message: `Skipped: ${opCheck.reason}`,
        sent: 0,
        skipped: true,
    });
}

// === SCHEDULE TIME CHECK (daily report punya jadwal spesifik) ===
const reportTime = settings.dailyReportTime || '21:00';
const schedCheck = checkScheduleTime(reportTime, settings, now);
if (!schedCheck.ready) {
    return NextResponse.json({
        success: true,
        message: `Skipped: ${schedCheck.reason}`,
        sent: 0,
        skipped: true,
    });
}
// === END CHECK ===

// ... lanjut ke hasRunToday() dan logika pengiriman seperti sebelumnya
```

---

#### 2.2 — `app/api/cron/wa-membership-expiry/route.ts`

**Narasi:**  
Membership expiry hanya butuh cek jam operasional. Tidak perlu jadwal spesifik karena ini bukan laporan — ini reminder yang bisa dikirim kapan saja selama jam operasional.

```typescript
// Tambahkan import
import { checkOperationalHours } from '@/lib/waOperationalHours';

// Tambahkan SETELAH settings = await Settings.findOne()
// dan SEBELUM query Customer:

// === OPERATIONAL HOURS CHECK ===
const opCheck = checkOperationalHours(settings, new Date());
if (!opCheck.allowed) {
    return NextResponse.json({
        success: true,
        message: `Skipped: ${opCheck.reason}`,
        sent: 0,
        skipped: true,
    });
}
// === END CHECK ===

// ... lanjut ke Customer.find() dan loop pengiriman
```

---

#### 2.3 — `app/api/cron/wa-package-expiry/route.ts`

**Narasi:** Sama seperti membership expiry — hanya perlu cek jam operasional.

```typescript
// Tambahkan import
import { checkOperationalHours } from '@/lib/waOperationalHours';

// Tambahkan SETELAH settings = await Settings.findOne()
// SEBELUM query CustomerPackage:

// === OPERATIONAL HOURS CHECK ===
const opCheck = checkOperationalHours(settings, new Date());
if (!opCheck.allowed) {
    return NextResponse.json({
        success: true,
        message: `Skipped: ${opCheck.reason}`,
        sent: 0,
        skipped: true,
    });
}
// === END CHECK ===
```

---

#### 2.4 — `app/api/cron/wa-stock-alert/route.ts`

**Narasi:**  
Stock alert agak spesial: idealnya dikirim di jam kerja, bukan tengah malam. Tambah cek jam operasional sebelum kirim ke admin.

```typescript
// Tambahkan import
import { checkOperationalHours } from '@/lib/waOperationalHours';

// Tambahkan SETELAH settings = await Settings.findOne()
// SEBELUM query Product:

// === OPERATIONAL HOURS CHECK ===
const opCheck = checkOperationalHours(settings, new Date());
if (!opCheck.allowed) {
    return NextResponse.json({
        success: true,
        message: `Skipped: ${opCheck.reason}`,
        sent: 0,
        skipped: true,
    });
}
// === END CHECK ===
```

---

#### 2.5 — `app/api/cron/birthday-voucher/route.ts`

**Narasi:**  
Birthday voucher harus dikirim di pagi hari agar customer menerima ucapan saat hari ulang tahunnya. Tambah cek jam operasional.

```typescript
// Tambahkan import
import { checkOperationalHours } from '@/lib/waOperationalHours';

// Tambahkan SETELAH settings = await Settings.findOne()
// SEBELUM Voucher.findById():

// === OPERATIONAL HOURS CHECK ===
const opCheck = checkOperationalHours(settings, new Date());
if (!opCheck.allowed) {
    return NextResponse.json({
        success: true,
        message: `Skipped: ${opCheck.reason}`,
        sent: 0,
        skipped: true,
    });
}
// === END CHECK ===
```

---

### PHASE 3 — Tambah Per-Type Schedule Settings

**Tujuan:** Setiap jenis notifikasi punya jam jadwal sendiri yang bisa dikonfigurasi.  
**Effort:** ~1.5 jam  
**Files yang berubah:** `models/Settings.ts`, `app/api/settings/route.ts`, frontend

**Narasi:**  
Saat ini hanya `dailyReportTime` yang punya jadwal sendiri. Kita tambah field serupa untuk jenis lain sehingga user bisa atur, misal: "kirim reminder membership jam 09:00", "kirim stock alert jam 08:00", dsb.

#### 3.1 — Tambah fields ke `models/Settings.ts`

```typescript
// models/Settings.ts — Tambahkan setelah dailyReportTime

// Jadwal per jenis notifikasi WA
// Format "HH:MM" dalam timezone toko
dailyReportTime: {
    type: String,
    default: '21:00'          // SUDAH ADA
},
waMembershipReminderTime: {
    type: String,
    default: '09:00'          // BARU: jam 09.00 pagi
},
waPackageReminderTime: {
    type: String,
    default: '09:30'          // BARU: jam 09.30 pagi
},
waStockAlertTime: {
    type: String,
    default: '08:00'          // BARU: jam 08.00 pagi (jam buka toko)
},
waBirthdayNotifTime: {
    type: String,
    default: '08:00'          // BARU: jam 08.00 pagi
},
```

#### 3.2 — Tambah ke `ALLOWED_FIELDS` di `app/api/settings/route.ts`

```typescript
// Tambahkan ke array ALLOWED_FIELDS:
'waMembershipReminderTime',
'waPackageReminderTime', 
'waStockAlertTime',
'waBirthdayNotifTime',
```

#### 3.3 — Update cron routes untuk gunakan jadwal per-type

Setelah Phase 2, update cron routes untuk juga cek `scheduleTime`:

```typescript
// Contoh untuk wa-membership-expiry/route.ts:
// Setelah opCheck, tambahkan:

const memberTime = settings.waMembershipReminderTime || '09:00';
const schedCheck = checkScheduleTime(memberTime, settings, now);
if (!schedCheck.ready) {
    return NextResponse.json({
        success: true,
        message: `Skipped: ${schedCheck.reason}`,
        sent: 0,
        skipped: true,
    });
}
```

---

### PHASE 4 — Improve UI Settings Page

**Tujuan:** Ganti input number mentah dengan time picker yang intuitif + preview jadwal.  
**Effort:** ~2-3 jam  
**File yang berubah:** `app/[slug]/(frontend)/settings/page.tsx`

**Narasi:**  
Pengguna awam tidak tahu bahwa angka "8" berarti jam 08:00. Kita ganti dengan komponen yang lebih jelas: time range picker dengan label yang human-friendly, plus preview "Pesan WA akan dikirim antara 08.00 - 20.00 WIB".

#### 4.1 — Tambah interface field baru di TypeScript

```typescript
// Di bagian interface SettingsType (sekitar baris 60-70 settings/page.tsx)
// Tambahkan field baru:
waMembershipReminderTime: string;
waPackageReminderTime: string;
waStockAlertTime: string;
waBirthdayNotifTime: string;
```

#### 4.2 — Tambah default values di initial state

```typescript
// Di bagian useState initializer (sekitar baris 150):
waMembershipReminderTime: '09:00',
waPackageReminderTime: '09:30',
waStockAlertTime: '08:00',
waBirthdayNotifTime: '08:00',
```

#### 4.3 — Tambah ke loadSettings dari API

```typescript
// Di bagian yang memuat data dari API (sekitar baris 290):
waMembershipReminderTime: data.data.waMembershipReminderTime ?? '09:00',
waPackageReminderTime: data.data.waPackageReminderTime ?? '09:30',
waStockAlertTime: data.data.waStockAlertTime ?? '08:00',
waBirthdayNotifTime: data.data.waBirthdayNotifTime ?? '08:00',
```

#### 4.4 — Ganti UI input section (sekitar baris 1257)

**SEBELUM (kode lama):**
```tsx
<FormInput
    label="Jam Mulai Operasional WA"
    type="number" min="0" max="23"
    value={settings.waOperationalHoursStart?.toString()}
    onChange={(e) => setSettings({ ...settings, waOperationalHoursStart: parseInt(e.target.value) || 0 })}
    placeholder="8"
/>
<FormInput
    label="Jam Selesai Operasional WA"
    type="number" min="0" max="23"
    value={settings.waOperationalHoursEnd?.toString()}
    onChange={(e) => setSettings({ ...settings, waOperationalHoursEnd: parseInt(e.target.value) || 0 })}
    placeholder="20"
/>
```

**SESUDAH (kode baru):**
```tsx
{/* ===== OPERATIONAL HOURS - VISUAL TIME RANGE ===== */}
<div className="col-span-2 space-y-4">
    
    {/* Time Range Picker */}
    <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
        <h4 className="text-sm font-bold text-gray-800 mb-3">
            🕐 Jendela Jam Operasional WA
        </h4>
        <p className="text-xs text-gray-500 mb-4">
            WA hanya akan dikirim di antara jam ini (berlaku untuk semua pengiriman otomatis)
        </p>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                    Mulai Operasional
                </label>
                <input
                    type="time"
                    value={`${String(settings.waOperationalHoursStart ?? 8).padStart(2,'0')}:00`}
                    onChange={(e) => {
                        const hour = parseInt(e.target.value.split(':')[0]) || 0;
                        setSettings({ ...settings, waOperationalHoursStart: hour });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm 
                               text-gray-900 bg-white focus:ring-2 focus:ring-green-500"
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                    Selesai Operasional
                </label>
                <input
                    type="time"
                    value={`${String(settings.waOperationalHoursEnd ?? 20).padStart(2,'0')}:00`}
                    onChange={(e) => {
                        const hour = parseInt(e.target.value.split(':')[0]) || 0;
                        setSettings({ ...settings, waOperationalHoursEnd: hour });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm 
                               text-gray-900 bg-white focus:ring-2 focus:ring-green-500"
                />
            </div>
        </div>
        
        {/* Visual Preview Bar */}
        <div className="mt-2">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>23:59</span>
            </div>
            <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
                <div
                    className="absolute h-full bg-green-400 rounded-full transition-all"
                    style={{
                        left: `${((settings.waOperationalHoursStart ?? 8) / 24) * 100}%`,
                        width: `${(((settings.waOperationalHoursEnd ?? 20) - (settings.waOperationalHoursStart ?? 8)) / 24) * 100}%`
                    }}
                />
            </div>
            <p className="text-xs text-green-700 font-medium mt-2 text-center">
                ✅ WA aktif: {String(settings.waOperationalHoursStart ?? 8).padStart(2,'0')}:00 
                &nbsp;—&nbsp; 
                {String(settings.waOperationalHoursEnd ?? 20).padStart(2,'0')}:00
            </p>
        </div>
    </div>

    {/* Per-Type Schedule */}
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <h4 className="text-sm font-bold text-gray-800 mb-3">
            📅 Jadwal Spesifik per Jenis Notifikasi
        </h4>
        <p className="text-xs text-gray-500 mb-3">
            Tentukan jam berapa tepatnya setiap jenis pesan WA akan dikirim 
            (harus dalam rentang jam operasional di atas)
        </p>
        <div className="grid grid-cols-1 gap-3">
            {[
                { key: 'dailyReportTime',           label: '📊 Laporan Harian',         default: '21:00' },
                { key: 'waStockAlertTime',          label: '📦 Alert Stok Rendah',       default: '08:00' },
                { key: 'waMembershipReminderTime',  label: '👑 Reminder Membership',     default: '09:00' },
                { key: 'waPackageReminderTime',     label: '🎁 Reminder Paket',           default: '09:30' },
                { key: 'waBirthdayNotifTime',       label: '🎂 Notifikasi Ulang Tahun',  default: '08:00' },
            ].map(({ key, label, default: def }) => (
                <div key={key} className="flex items-center justify-between gap-4">
                    <label className="text-sm text-gray-700 flex-1">{label}</label>
                    <input
                        type="time"
                        value={(settings as any)[key] || def}
                        onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm 
                                   text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 w-32"
                    />
                </div>
            ))}
        </div>
    </div>
</div>
{/* ===== END OPERATIONAL HOURS ===== */}
```

---

### PHASE 5 — Update `processAutomations()` di `lib/scheduler.ts`

**Tujuan:** Automations yang dijalankan via scheduler juga respect jam operasional.  
**Effort:** ~30 menit  
**File yang berubah:** `lib/scheduler.ts`

**Narasi:**  
`processAutomations()` saat ini menggunakan `rule.scheduleTime` dari database WaAutomation untuk menentukan kapan rule dijalankan. Namun tidak ada pengecekan apakah `scheduleTime` tersebut ada di dalam window jam operasional. Tambahkan pengecekan setelah semua automations diload tapi sebelum loop rule.

```typescript
// lib/scheduler.ts — di dalam processAutomations(), 
// SETELAH: const settings = await Settings.findOne() || {}
// SEBELUM: for (const rule of activeRules)

// Import di bagian atas file:
import { checkOperationalHours } from './waOperationalHours';

// Di dalam loop for (const slug of slugs):
const opCheck = checkOperationalHours({
    waOperationalHoursStart: settings.waOperationalHoursStart,
    waOperationalHoursEnd: settings.waOperationalHoursEnd,
    timezone: settings.timezone,
}, now);

if (!opCheck.allowed) {
    console.log(`[AUTOMATIONS:${slug}] ${opCheck.reason}, skipping all rules`);
    continue;
}

// ...lanjut ke for (const rule of activeRules)
```

---

## 📁 Ringkasan Semua File yang Berubah

| # | File | Jenis Perubahan | Phase |
|---|---|---|---|
| 1 | `lib/waOperationalHours.ts` | ✨ FILE BARU | Phase 1 |
| 2 | `app/api/cron/wa-daily-report/route.ts` | ➕ Tambah import + 2 check | Phase 2 |
| 3 | `app/api/cron/wa-membership-expiry/route.ts` | ➕ Tambah import + 1 check | Phase 2 |
| 4 | `app/api/cron/wa-package-expiry/route.ts` | ➕ Tambah import + 1 check | Phase 2 |
| 5 | `app/api/cron/wa-stock-alert/route.ts` | ➕ Tambah import + 1 check | Phase 2 |
| 6 | `app/api/cron/birthday-voucher/route.ts` | ➕ Tambah import + 1 check | Phase 2 |
| 7 | `models/Settings.ts` | ➕ Tambah 4 field schedule | Phase 3 |
| 8 | `app/api/settings/route.ts` | ➕ Tambah 4 key ke ALLOWED_FIELDS | Phase 3 |
| 9 | `app/[slug]/(frontend)/settings/page.tsx` | 🔄 Ganti UI section operational hours | Phase 4 |
| 10 | `lib/scheduler.ts` | ➕ Tambah import + opCheck di processAutomations | Phase 5 |

**File yang TIDAK perlu diubah:**
- `models/Settings.ts` — field `waOperationalHoursStart/End` sudah ada ✅
- `app/api/settings/route.ts` — field sudah di ALLOWED_FIELDS ✅  
- `lib/scheduler.ts` > `processPendingCampaigns()` — sudah benar ✅

---

## ✅ Testing Checklist

### Unit Test — `lib/waOperationalHours.ts`

```typescript
// Buat file: lib/waOperationalHours.test.ts
import { checkOperationalHours, checkScheduleTime } from './waOperationalHours';

describe('checkOperationalHours', () => {
    const settings = {
        waOperationalHoursStart: 8,
        waOperationalHoursEnd: 20,
        timezone: 'Asia/Jakarta',
    };

    it('allows sending at 10:00 WIB', () => {
        // 10:00 WIB = 03:00 UTC
        const now = new Date('2026-01-01T03:00:00.000Z');
        const result = checkOperationalHours(settings, now);
        expect(result.allowed).toBe(true);
    });

    it('blocks sending at 23:00 WIB', () => {
        // 23:00 WIB = 16:00 UTC
        const now = new Date('2026-01-01T16:00:00.000Z');
        const result = checkOperationalHours(settings, now);
        expect(result.allowed).toBe(false);
    });

    it('blocks sending at 07:59 WIB (before start)', () => {
        const now = new Date('2026-01-01T00:59:00.000Z'); // 07:59 WIB
        const result = checkOperationalHours(settings, now);
        expect(result.allowed).toBe(false);
    });

    it('uses default hours if settings empty', () => {
        const now = new Date('2026-01-01T02:00:00.000Z'); // 09:00 WIB
        const result = checkOperationalHours({}, now);
        expect(result.allowed).toBe(true); // default 8-20
    });
});
```

### Integration Test — Cron Routes

```bash
# Test 1: Panggil cron di luar jam operasional
# Ubah sementara waOperationalHoursEnd = 1 (jam 01.00)
# Lalu hit endpoint, harus dapat response skipped
curl -H "authorization: Bearer YOUR_SECRET" \
     -H "x-store-slug: pusat" \
     http://localhost:3000/api/cron/wa-daily-report

# Expected response:
# { "success": true, "skipped": true, "sent": 0, "message": "Skipped: Outside operational hours..." }

# Test 2: Kembalikan ke normal dan panggil di jam yang benar
# { "success": true, "sent": 1, ... }
```

### Manual Test — Settings UI

1. Buka Settings → Tab WA/Automation
2. Pastikan time picker muncul (bukan input angka 0-23)
3. Ubah jam mulai ke 10:00, jam selesai ke 18:00
4. Lihat preview bar berubah → hijau di range 10-18
5. Klik Save
6. Reload halaman → pastikan jam tersimpan dengan benar

---

## ⚡ Urutan Implementasi yang Disarankan

```
Hari 1 (2-3 jam):
  [x] Phase 1 — Buat lib/waOperationalHours.ts + unit test
  [x] Phase 2 — Update 5 cron routes (copy-paste pattern)

Hari 2 (2-3 jam):
  [x] Phase 3 — Tambah fields ke Settings model + API
  [x] Phase 5 — Update processAutomations() di scheduler

Hari 3 (2-3 jam):
  [x] Phase 4 — UI Time Picker di settings page
  [x] Testing end-to-end
  [x] Deploy & verifikasi di production
```

---

## 🚨 Risiko & Mitigasi

| Risiko | Kemungkinan | Mitigasi |
|---|---|---|
| Cron-job.org ping terlalu jarang → pesan delay | Sedang | Set interval ping setiap 30 menit |
| Jam operasional salah konfigurasi (start > end) | Rendah | Validasi di UI + backend: error jika start >= end |
| Timezone toko berbeda → jam beda | Rendah | Utility sudah pakai `settings.timezone` |
| `hasRunToday` conflict dengan schedule check | Rendah | Urutan: opCheck → scheduleCheck → hasRunToday |

---

## 📝 Catatan Penting

1. **Tidak perlu migration database** — field baru di Settings akan menggunakan `default` value otomatis dari Mongoose saat dokumen diakses pertama kali.

2. **Backward compatible** — semua fallback ke nilai default (`?? 8`, `?? 20`, `|| '21:00'`) memastikan sistem tetap berjalan meskipun field belum ada di DB lama.

3. **Timezone aware** — utility menggunakan `settings.timezone` (bukan hardcode 'Asia/Jakarta') agar multi-tenant dengan timezone berbeda tetap benar.

4. **Urutan check di cron route yang benar:**
   ```
   1. Auth check (CRON_SECRET)
   2. Settings.findOne()
   3. checkOperationalHours()  ← Phase 2
   4. checkScheduleTime()      ← Phase 3 (opsional per route)
   5. hasRunToday()            ← deduplikasi
   6. Logika bisnis & sendWhatsApp()
   ```

---

*Dibuat berdasarkan analisis kode SalonNext · lib/scheduler.ts, models/Settings.ts, app/api/settings/route.ts, dan semua app/api/cron/wa-*/route.ts*