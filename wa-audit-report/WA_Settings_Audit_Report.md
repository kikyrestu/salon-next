# 🔍 Laporan Audit — WA Marketing & Notifications di Halaman Settings
### Proyek: `salon-next` | File: `settings/page.tsx` + `api/settings/route.ts` + `models/Settings.ts`
> **Tanggal Audit:** 18 Mei 2026 | **Metode:** Source code cross-reference audit | **Status:** ✅ Tervalidasi

---

## 📊 Ringkasan Temuan

| # | Temuan | Kategori | Severity |
|---|---|---|---|
| S-01 | `dailyReportTime` disimpan ke DB tapi tidak dibaca oleh siapapun | 🧩 Orphaned Field | 🔴 High |
| S-02 | `greetingEnabled` tidak punya UI toggle — tidak bisa dikonfigurasi | 🚫 Missing UI | 🔴 High |
| S-03 | Template variable di UI salah / tidak cocok dengan kode sebenarnya | ⚠️ Variable Mismatch | 🔴 High |
| S-04 | 4 field konfigurasi kritis tidak punya UI sama sekali | 🚫 Missing UI | 🟡 Medium |
| S-05 | `waBlastNumber` disimpan ke DB tapi tidak dipakai di mana pun | 🧩 Dead Field | 🟡 Medium |
| S-06 | Settings PUT tidak punya field whitelist — body diteruskan mentah | 🔒 Security/Logic | 🟡 Medium |
| S-07 | `membershipExpiryReminderDays`/`packageExpiryReminderDays` hanya dibaca oleh cron eksternal, diabaikan oleh scheduler internal | 🔀 Disconnect | 🟡 Medium |
| S-08 | Tombol "Push WA Sekarang" mislabeled — tidak memicu automation rules | 📋 UX Misleading | 🟢 Low |

---

## 🔴 S-01 — `dailyReportTime` Disimpan ke DB, Tapi Tidak Dibaca oleh Kode Mana Pun

### Narasi

Di halaman Settings, ada field **"Daily Report Time"** dengan input bertipe teks (placeholder `21:00`). User bisa mengisinya, klik Save, dan field tersimpan ke DB. Tapi ini sepenuhnya sia-sia karena **tidak ada satu pun baris kode yang membacanya**.

### Bukti Kode

**Model** (ada):
```typescript
// models/Settings.ts
dailyReportTime: {
    type: String,
    default: '21:00'
},
```

**UI** (ada):
```tsx
// settings/page.tsx
<FormInput
    label="Daily Report Time"
    value={settings.dailyReportTime}
    onChange={(e) => setSettings({ ...settings, dailyReportTime: e.target.value })}
    placeholder="21:00"
/>
```

**Scheduler** (tidak membaca `dailyReportTime`):
```typescript
// lib/scheduler.ts — processAutomations()
// Scheduler membaca scheduleTime dari WaAutomation RULE, BUKAN dari settings.dailyReportTime
if (rule.scheduleTime && !validTimeSlots.has(rule.scheduleTime)) continue;
// settings.dailyReportTime tidak pernah diambil di sini
```

**Cron Route** (juga tidak membacanya):
```typescript
// app/api/cron/wa-daily-report/route.ts
// Tidak ada baris yang membaca settings.dailyReportTime
// Cron ini hanya berjalan kapan pun ia dipanggil oleh external scheduler
```

### Dampak

User mengira kalau dia set `21:00` di settings, laporan harian akan otomatis terkirim jam 21:00. Kenyataannya, jam pengiriman diatur dari dua tempat **lain**:
- Automation Rule (tab Automations di WA Marketing): field `scheduleTime` per-rule
- External cron schedule (cron-job.org, Vercel Cron): di-set di dashboard eksternal

Field `dailyReportTime` di settings adalah **dummy field** yang tidak melakukan apa pun, sehingga menyesatkan user.

### Solusi

**Opsi A (Quick Fix):** Hapus field dari UI atau beri label jelas bahwa field ini belum aktif.

**Opsi B (Full Fix):** Hubungkan ke scheduler — baca `settings.dailyReportTime` dan gunakan sebagai default `scheduleTime` untuk automation rule `daily_report`:
```typescript
// Dalam processAutomations(), untuk rule daily_report yang tidak punya scheduleTime:
const effectiveScheduleTime = rule.scheduleTime || settings.dailyReportTime || '21:00';
if (!validTimeSlots.has(effectiveScheduleTime)) continue;
```

---

## 🔴 S-02 — `greetingEnabled` Tidak Punya UI Toggle

### Narasi

Field `greetingEnabled` ada di model, dibaca oleh webhook Fonnte untuk memutuskan apakah greeting otomatis dikirim ke customer baru yang pertama kali chat. Tapi **tidak ada toggle/checkbox di UI settings** — sehingga user tidak bisa mengaktifkan atau menonaktifkan greeting dari UI.

### Bukti Kode

**Model** (ada, default `true`):
```typescript
// models/Settings.ts
greetingEnabled: {
    type: Boolean,
    default: true
},
```

**Frontend interface** (ada tapi tidak di-render):
```typescript
// settings/page.tsx interface
greetingEnabled: boolean;    // ← ada di interface

// Default state
greetingEnabled: false,      // ← tapi default-nya false! (berbeda dengan DB default: true)
```

**Webhook membacanya** (aktif digunakan):
```typescript
// app/api/fonnte/webhook/route.ts
const settings = await Settings.findOne().select('greetingEnabled fonnteToken').lean();
if (settings?.greetingEnabled === false) {
    return null; // Greeting di-disable — TIDAK mengirim greeting
}
```

**UI Settings** (tidak ada toggle):
```bash
# Cek jumlah binding untuk greetingEnabled di UI:
grep -c "value={settings.greetingEnabled\|checked={settings.greetingEnabled" settings/page.tsx
# → 0 (NOL — tidak ada sama sekali di UI)
```

### Dampak

Ada dua masalah berlapis:
1. User tidak bisa mengontrol greeting on/off dari Settings page
2. **Default state di frontend adalah `false`** sementara default di model DB adalah `true`. Artinya setiap kali settings di-save dari page ini, `greetingEnabled` akan ter-overwrite menjadi `false` → **greeting otomatis akan mati setelah settings pertama kali disave!**

### Solusi

```tsx
// Tambahkan toggle di WA Marketing & Notifications section:
<div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-100">
    <input
        type="checkbox"
        id="greetingEnabled"
        checked={settings.greetingEnabled}
        onChange={(e) => setSettings({ ...settings, greetingEnabled: e.target.checked })}
        className="w-4 h-4 text-green-600 rounded"
    />
    <label htmlFor="greetingEnabled" className="text-sm font-medium text-gray-900 cursor-pointer">
        Aktifkan Auto-Reply Greeting WA (Pesan sambutan otomatis ke pelanggan baru)
    </label>
</div>

// Dan perbaiki default state dari false → true:
greetingEnabled: true,   // sesuaikan dengan default di DB model
```

---

## 🔴 S-03 — Template Variable di UI Tidak Cocok dengan Kode Sebenarnya

### Narasi

Di halaman Settings, setiap template message diberi petunjuk variabel yang bisa dipakai (dalam format `{{namaVariabel}}`). Tapi petunjuk yang ditampilkan **tidak cocok** dengan variabel yang sebenarnya di-replace oleh kode. User yang mengikuti petunjuk UI akan mendapat pesan yang kosong atau kacau.

---

### S-03A — Template Stock Alert: Variabel Salah Semua

**UI menampilkan petunjuk variabel:**
```
Variabel: {{storeName}}, {{count}}, {{productList}}
```

**Kode scheduler sebenarnya hanya mengganti:**
```typescript
// lib/scheduler.ts — stock_alert handler
const itemList = products.map((p: any) => `- ${p.name} (Sisa: ${p.stock})`).join('\n');
const message = rule.messageTemplate.replace(/{{items}}/gi, itemList);
// ← Hanya {{items}} yang diganti! {{storeName}}, {{count}}, {{productList}} TIDAK PERNAH diganti
```

**Akibat:** Jika user menulis template `⚠️ Stok {{storeName}} — {{count}} produk:\n{{productList}}`, hasilnya adalah:
```
⚠️ Stok {{storeName}} — {{count}} produk:
{{productList}}
```
Semua variabel muncul mentah karena tidak ada yang menggantinya.

**Pemetaan yang benar:**
| Yang UI Tampilkan | Yang Benar-benar Diganti | Status |
|---|---|---|
| `{{storeName}}` | ❌ Tidak ada | Salah |
| `{{count}}` | ❌ Tidak ada | Salah |
| `{{productList}}` | ❌ Tidak ada | Salah |
| (tidak ditampilkan) | `{{items}}` | ✅ Inilah yang benar |

> **Catatan tambahan:** Cron route `/api/cron/wa-stock-alert` tidak menggunakan `waTemplateStockAlert` sama sekali — pesannya hardcoded. Hanya scheduler automation yang membaca template, tapi dia membaca dari `rule.messageTemplate` (field di WaAutomation), bukan dari `settings.waTemplateStockAlert`.

---

### S-03B — Template Daily Report: Sebagian Besar Variabel Salah

**UI menampilkan petunjuk variabel:**
```
Variabel: {{storeName}}, {{date}}, {{totalAmount}}, {{totalTransactions}}, {{totalCustomers}}
```

**Kode scheduler sebenarnya:**
```typescript
// lib/scheduler.ts — daily_report handler
const templateStr = settings.waTemplateDailyReport || rule.messageTemplate;
const message = templateStr
    .replace(/{{total_revenue}}/gi, formattedRevenue)
    .replace(/{{total_transactions?}}/gi, String(totalTransactions))
    .replace(/{{total_customers?}}/gi, String(totalCustomers));
// {{storeName}} ❌ tidak diganti
// {{date}} ❌ tidak diganti
// {{totalAmount}} ❌ tidak diganti (yang benar: {{total_revenue}})
```

**Pemetaan yang benar:**
| Yang UI Tampilkan | Yang Benar-benar Diganti | Status |
|---|---|---|
| `{{storeName}}` | ❌ Tidak ada | **Salah** |
| `{{date}}` | ❌ Tidak ada | **Salah** |
| `{{totalAmount}}` | ❌ Tidak ada (yang benar `{{total_revenue}}`) | **Salah nama** |
| `{{totalTransactions}}` | `{{total_transactions}}` (berbeda casing) | ⚠️ Perlu test (regex pakai `?`) |
| `{{totalCustomers}}` | `{{total_customers}}` (berbeda casing) | ⚠️ Perlu test |

> **Catatan:** Cron route `/api/cron/wa-daily-report` juga tidak membaca `settings.waTemplateDailyReport` — pesannya dibangun hardcoded dengan template string JS. Jadi template di Settings ini hanya efektif jika automation rule dibuat dari tab Automations.

---

### S-03C — Template Membership & Package Expiry: Variabel Berbeda Antara UI, Cron, dan Scheduler

**UI menampilkan untuk Membership Expiry:**
```
Variabel: {{customerName}}, {{membershipTier}}, {{storeName}}, {{daysLeft}}, {{expiryDate}}
```

**Scheduler sebenarnya hanya mengganti:**
```typescript
// lib/scheduler.ts — membership_expiry
const msg = rule.messageTemplate.replace(/{{nama_customer}}/gi, customer.name);
// Hanya {{nama_customer}}! Semua variabel lain tidak diganti.
```

**Ringkasan Variabel Benar per Konteks:**

| Template | Variabel di UI | Variabel Benar (Scheduler) | Variabel Benar (Cron) |
|---|---|---|---|
| Stock Alert | `{{storeName}}`, `{{count}}`, `{{productList}}` | `{{items}}` | *(hardcoded)* |
| Daily Report | `{{storeName}}`, `{{date}}`, `{{totalAmount}}`, `{{totalTransactions}}`, `{{totalCustomers}}` | `{{total_revenue}}`, `{{total_transactions}}`, `{{total_customers}}` | *(hardcoded)* |
| Membership Expiry | `{{customerName}}`, `{{membershipTier}}`, `{{storeName}}`, `{{daysLeft}}`, `{{expiryDate}}` | `{{nama_customer}}` saja | *(hardcoded)* |
| Package Expiry | `{{customerName}}`, `{{packageName}}`, `{{storeName}}`, `{{daysLeft}}`, `{{expiryDate}}`, `{{remainingQuota}}` | `{{nama_customer}}` saja | *(hardcoded)* |

### Solusi

**Perbaikan cepat:** Update label hint di UI agar sesuai dengan variabel yang benar di kode.

**Perbaikan lengkap:** Update fungsi replace di scheduler untuk mendukung semua variabel yang diiklankan di UI:

```typescript
// Untuk daily_report — tambahkan variabel yang hilang:
const message = templateStr
    .replace(/{{total_revenue}}|{{totalAmount}}/gi, formattedRevenue)
    .replace(/{{total_transactions?}}|{{totalTransactions}}/gi, String(totalTransactions))
    .replace(/{{total_customers?}}|{{totalCustomers}}/gi, String(totalCustomers))
    .replace(/{{storeName}}/gi, settings.storeName || 'Salon')
    .replace(/{{date}}/gi, dateStr);

// Untuk membership_expiry — tambahkan variabel yang hilang:
const msg = rule.messageTemplate
    .replace(/{{nama_customer}}|{{customerName}}/gi, customer.name)
    .replace(/{{membershipTier}}/gi, customer.membershipTier || '')
    .replace(/{{storeName}}/gi, settings.storeName || 'Salon')
    .replace(/{{daysLeft}}/gi, String(daysBefore))
    .replace(/{{expiryDate}}/gi, customer.membershipExpiry?.toLocaleDateString('id-ID') || '');
```

---

## 🟡 S-04 — 4 Field Konfigurasi Kritis Tanpa UI

### Narasi

Ada 4 field di Settings model yang **aktif digunakan oleh scheduler** untuk mengontrol perilaku blast campaign, tapi tidak ada satupun yang bisa dikonfigurasi dari UI. Admin terpaksa mengubahnya langsung di database atau tidak tahu field ini ada.

### Detail Per Field

**Field 1: `waOperationalHoursStart` dan `waOperationalHoursEnd`**
```typescript
// lib/scheduler.ts — processPendingCampaigns()
const opStart = settings.waOperationalHoursStart ?? 8;  // Default jam 8 pagi
const opEnd = settings.waOperationalHoursEnd ?? 20;     // Default jam 8 malam

if (hourWIB < opStart || hourWIB >= opEnd) {
    // BLAST TIDAK DIKIRIM di luar jam operasional!
    continue;
}
```
Tanpa UI, tidak ada cara untuk mengubah jam operasional WA blast. Salon yang buka malam (misalnya sampai jam 22:00) tidak bisa memperpanjang window pengiriman.

**Field 2: `fonnteMaxDailyMessages`**
```typescript
// lib/scheduler.ts
let dailyLimit = settings.fonnteMaxDailyMessages || 0;
if (dailyLimit === 0) {
    // Auto-calculate based on device age (warm-up)
    const registeredAt = settings.fonnteDeviceRegisteredAt;
    // ... kalkulasi warm-up
}
```
Tanpa UI, admin tidak bisa override daily limit secara manual.

**Field 3: `fonnteDeviceRegisteredAt`**
```typescript
// lib/scheduler.ts — digunakan untuk warm-up calculation
const registeredAt = settings.fonnteDeviceRegisteredAt;
if (!registeredAt) {
    dailyLimit = 20; // Konservatif: anggap nomor baru → max 20 pesan/hari
}
```
Tanpa UI, sistem tidak tahu tanggal nomor Fonnte didaftarkan → selalu anggap nomor baru → limit blast sangat rendah (20/hari).

### Solusi

```tsx
// Tambahkan section "WA Advanced Settings" di bawah bagian WA Marketing:
<div className="border-t pt-4 mt-4">
    <h3 className="text-sm font-bold text-gray-800 mb-3">⚙️ Pengaturan Lanjutan WA Blast</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
            label="Jam Mulai Operasional WA"
            type="number" min="0" max="23"
            value={settings.waOperationalHoursStart}
            onChange={(e) => setSettings({ ...settings, waOperationalHoursStart: parseInt(e.target.value) })}
            placeholder="8"
        />
        <FormInput
            label="Jam Selesai Operasional WA"
            type="number" min="0" max="23"
            value={settings.waOperationalHoursEnd}
            onChange={(e) => setSettings({ ...settings, waOperationalHoursEnd: parseInt(e.target.value) })}
            placeholder="20"
        />
        <FormInput
            label="Tanggal Nomor Fonnte Didaftarkan"
            type="date"
            value={settings.fonnteDeviceRegisteredAt?.substring(0, 10) || ''}
            onChange={...}
        />
        <FormInput
            label="Override Limit Pesan Harian (0 = otomatis)"
            type="number" min="0"
            value={settings.fonnteMaxDailyMessages}
            onChange={...}
            placeholder="0"
        />
    </div>
</div>
```

---

## 🟡 S-05 — `waBlastNumber` adalah Dead Field

### Narasi

Field `waBlastNumber` ada di model, ada di frontend interface, ada di state, dibaca dari DB — tapi **tidak pernah digunakan oleh kode mana pun** di seluruh proyek.

```bash
# Hasil pencarian di semua file .ts:
grep -rn "waBlastNumber" . | grep -v "models\|settings/page"
# → 0 hasil
```

Tidak ada route, tidak ada scheduler, tidak ada cron yang membacanya. UI pun tidak menampilkan input untuk field ini (ada di interface tapi tidak di-render di halaman).

### Dampak
Membingungkan developer saat maintenance — field ini terlihat penting tapi tidak melakukan apa pun. Membuat DB row lebih berat secara tidak perlu.

### Solusi
Hapus dari model, interface, dan state — atau dokumentasikan tujuan field ini kalau memang ada rencana penggunaannya.

---

## 🟡 S-06 — Settings PUT Tidak Ada Field Whitelist (Blind Update)

### Narasi

Endpoint `PUT /api/settings` meneruskan seluruh `body` request langsung ke `findOneAndUpdate` tanpa memfilter field mana yang boleh diupdate:

```typescript
// app/api/settings/route.ts
const body = await request.json();

// Hanya sanitasi minimal:
if (body.fonnteToken) body.fonnteToken = encryptFonnteToken(body.fonnteToken);
if (body.birthdayVoucherId === "") body.birthdayVoucherId = null;

// Langsung masukkan ke DB tanpa whitelist:
const settings = await Settings.findOneAndUpdate({}, body, { new: true, upsert: true });
```

### Masalah Konkret

1. **`_id` bisa di-overwrite:** Frontend interface menyertakan `_id: string` dalam type Settings. Saat `JSON.stringify(settings)` dikirim ke backend, `_id` ikut terkirim. Mongoose biasanya menangani ini, tapi praktik ini tetap tidak aman.

2. **Internal tracking field bisa di-reset tanpa sengaja:** Jika frontend secara tidak sengaja mengimport `fonnteDeviceRegisteredAt` sebagai empty string dan save, field ini akan di-reset — merusak kalkulasi warm-up limit.

3. **Tidak ada validasi format:** `dailyReportTime` bisa diisi dengan string apapun ("abc", "25:99") tanpa validasi, sedangkan field serupa di API lain (`WaAutomation.scheduleTime`) sudah divalidasi dengan regex `^([01]\d|2[0-3]):([0-5]\d)$`.

### Solusi

```typescript
// Buat whitelist field yang boleh diupdate
const ALLOWED_FIELDS = [
    'storeName', 'address', 'phone', 'email', 'website', 'taxId',
    'currency', 'timezone', 'taxRate', 'logoUrl', 'businessHours',
    'receiptFooter', 'showStaffOnReceipt', 'fonnteToken',
    'waAdminNumber', 'waOwnerNumber', 'greetingEnabled',
    'membershipExpiryReminderDays', 'packageExpiryReminderDays',
    'dailyReportTime', 'waTemplateStockAlert', 'waTemplateDailyReport',
    'waTemplateMembershipExpiry', 'waTemplatePackageExpiry',
    'waOperationalHoursStart', 'waOperationalHoursEnd',
    // ... field lainnya
];

const safeBody: Record<string, any> = {};
for (const key of ALLOWED_FIELDS) {
    if (key in body) safeBody[key] = body[key];
}
```

---

## 🟡 S-07 — Disconnect: `membershipExpiryReminderDays` Diabaikan oleh Scheduler Internal

### Narasi

Setting `membershipExpiryReminderDays` dan `packageExpiryReminderDays` ada di UI dan DB, dan **memang dibaca** — tapi hanya oleh cron route eksternal, bukan oleh scheduler internal.

**Cron route** (membaca settings ✅):
```typescript
// app/api/cron/wa-membership-expiry/route.ts
const reminderDays = settings?.membershipExpiryReminderDays || 30;
const targetDate = new Date();
targetDate.setDate(targetDate.getDate() + reminderDays);
```

**Scheduler automation** (mengabaikan settings, baca dari rule ❌):
```typescript
// lib/scheduler.ts — processAutomations() membership_expiry handler
const daysBefore = rule.daysBefore || 0;  // ← baca dari WaAutomation rule, BUKAN settings
```

### Dampak

Ada dua jalur pengiriman reminder membership expiry:
- **Jalur Cron Eksternal** (`/api/cron/wa-membership-expiry`): Mengikuti `settings.membershipExpiryReminderDays`
- **Jalur Automation Rule** (scheduler via `/api/wa/cron`): Mengikuti `rule.daysBefore` di WaAutomation

User yang membuat automation rule dan mengubah `membershipExpiryReminderDays` di settings akan bingung karena perubahan settings tidak berpengaruh pada automation rule-nya.

### Solusi

```typescript
// Sync settings ke automation rule saat settings disimpan, ATAU
// Baca settings sebagai fallback di scheduler:
const daysBefore = rule.daysBefore ?? settings.membershipExpiryReminderDays ?? 30;
```

---

## 🟢 S-08 — Tombol "Push WA Sekarang" Mislabeled

### Narasi

Di bagian System Management, ada tombol **"Push WA Sekarang"** dengan deskripsi:
> *"Trigger manual pengiriman WA follow-up yang sudah jatuh tempo"*

Tombol ini memanggil `/api/wa/trigger` yang menjalankan `processPendingWaSchedules()`, `processPendingCampaigns()`, dan `processAutomations()` sekaligus.

**Masalah UX:** Penempatan di "System Management" dan label "Uji Coba Push" menyiratkan ini hanya untuk testing, padahal fungsinya adalah **memproses semua antrian WA aktif** termasuk blast campaigns sungguhan. User mungkin tidak sadar bahwa klik tombol ini akan memicu pengiriman ke ratusan customer.

Selain itu, hasil yang ditampilkan:
```typescript
setWaPushResult(data.data || { total: 0, sent: 0, failed: 0 });
```
Hanya menampilkan result dari `processPendingWaSchedules()` (follow-up service) saja karena `data.data` = `scheduleResult`. Campaign dan automation result tidak ditampilkan.

### Solusi

```tsx
// Perbaiki label dan deskripsi:
<h3>Manual Trigger Scheduler WA</h3>
<p>Jalankan scheduler WA secara manual untuk memproses:
   (1) Follow-up service, (2) Blast campaigns antrian, (3) Automation rules.</p>
<p className="text-red-600 text-xs font-bold">⚠️ Pesan WA sungguhan akan terkirim ke customer.</p>
```

---

## 🗺️ Peta Koneksi: Siapa Membaca Apa

```
Settings Page (UI)
       │
       │ PUT /api/settings (blind update, no whitelist)
       ▼
Settings Model (MongoDB)
       │
       ├── fonnteToken ──────────────────────→ semua route WA ✅
       ├── waAdminNumber ────────────────────→ cron/wa-stock-alert ✅
       │                                      scheduler stock_alert ✅
       ├── waOwnerNumber ────────────────────→ cron/wa-daily-report ✅
       │                                      scheduler daily_report ✅
       ├── greetingEnabled ──────────────────→ fonnte/webhook ✅
       │                                      (tapi tidak ada UI toggle ❌)
       │
       ├── dailyReportTime ──────────────────→ ❌ TIDAK ADA YANG BACA
       ├── waBlastNumber ────────────────────→ ❌ TIDAK ADA YANG BACA
       │
       ├── waOperationalHoursStart/End ──────→ scheduler processPendingCampaigns ✅
       │                                      (tapi tidak ada UI input ❌)
       ├── fonnteDeviceRegisteredAt ─────────→ scheduler warm-up calculation ✅
       │                                      (tapi tidak ada UI input ❌)
       ├── fonnteMaxDailyMessages ───────────→ scheduler daily limit override ✅
       │                                      (tapi tidak ada UI input ❌)
       │
       ├── membershipExpiryReminderDays ─────→ cron/wa-membership-expiry ✅
       │                                      scheduler automation ❌ (diabaikan)
       ├── packageExpiryReminderDays ────────→ cron/wa-package-expiry ✅
       │                                      scheduler automation ❌ (diabaikan)
       │
       ├── waTemplateStockAlert ─────────────→ scheduler (via settings.waTemplateStockAlert)
       │                                      ⚠️ Tapi scheduler baca rule.messageTemplate!
       │                                      Cron tidak baca ini sama sekali.
       ├── waTemplateDailyReport ────────────→ scheduler ✅ (dibaca sebagai fallback)
       │                                      Cron tidak baca ini sama sekali.
       ├── waTemplateMembership/PackageExpiry→ ❌ scheduler tidak baca (baca rule.messageTemplate)
       │                                      ❌ Cron tidak baca (pesan hardcoded)
       └── ...
```

---

## 📋 Action Items Terkonsolidasi

| Priority | Item | Effort |
|---|---|---|
| 🔴 P0 | Fix S-02: Tambah `greetingEnabled` toggle + perbaiki default `false → true` | 15 menit |
| 🔴 P0 | Fix S-03: Update template variable hints di UI agar cocok dengan kode | 30 menit |
| 🟡 P1 | Fix S-01: Hubungkan `dailyReportTime` ke scheduler atau hapus field | 1 jam |
| 🟡 P1 | Fix S-04: Tambah UI untuk 4 field konfigurasi kritis (operational hours, device date, max messages) | 2 jam |
| 🟡 P1 | Fix S-03: Update replace logic di scheduler agar mendukung semua variabel yang diiklankan | 2 jam |
| 🟡 P1 | Fix S-06: Tambah field whitelist di PUT /api/settings | 30 menit |
| 🟡 P2 | Fix S-07: Sinkronisasi `membershipExpiryReminderDays` antara cron dan scheduler automation | 30 menit |
| 🟢 P3 | Fix S-05: Hapus `waBlastNumber` atau dokumentasikan tujuannya | 10 menit |
| 🟢 P3 | Fix S-08: Perbaiki label tombol "Push WA Sekarang" | 10 menit |

---

> **Audit ini dilakukan dengan membandingkan langsung: `models/Settings.ts` (DB schema) × `settings/page.tsx` (UI) × `api/settings/route.ts` (API) × `lib/scheduler.ts` (logic) × semua cron routes.**
> Setiap temuan memiliki referensi baris kode yang spesifik dan dapat diverifikasi.
