# Salon Next — Update Fitur 4: Implementation Plan
> **DP Masuk**: Rp 600.000 (10 Jun 2026) · **Total Deal**: Rp 1.200.000  
> **Method**: Developer Thinking of Public  
> **Stack**: Next.js 16 App Router · MongoDB/Mongoose · TypeScript · Fonnte WA · Tailwind CSS v4

---

## Developer Thinking of Public (DToP)

> **"DToP"** adalah pendekatan dokumentasi di mana developer menulis semua keputusan teknis secara transparan — bukan hanya "apa yang dikerjakan" tapi **"mengapa diputuskan seperti itu"**, tradeoff apa yang ada, dan alur berpikir dari problem ke solusi. Tidak ada asumsi tersembunyi, tidak ada keputusan mendadak.  
>
> **Ya, method ini digunakan di dokumen ini sepenuhnya.** Setiap feature section di bawah akan berisi "Thinking Block" yang menjelaskan reasoning di balik setiap keputusan teknis.

---

## Feature Decomposition Overview

| # | Feature | Kategori | Complexity | Est. Waktu | Priority |
|---|---------|----------|------------|------------|----------|
| 1 | Komisi "Selling By" Staff | New Feature (Full Stack) | ⭐⭐⭐⭐ Hard | 3–4 hari | P1 |
| 2 | Performance Staff Sort | UI Enhancement | ⭐ Easy | 2–3 jam | P3 |
| 3 | Menu Today di Appointment | UI Enhancement | ⭐ Easy | 1–2 jam | P3 |
| 4 | Bug Fix: Appointment Date | Bug Fix | ⭐⭐ Medium | 3–4 jam | P1 |
| 5 | WA Appointment Reminder | New Feature (Full Stack) | ⭐⭐⭐ Medium | 1–2 hari | P2 |
| 6 | Tombol Kirim Nota ke WA | New Feature (Full Stack) | ⭐⭐⭐ Medium | 4–6 jam | P2 |
| 7 | Link History Customer | New Feature (Full Stack) | ⭐⭐⭐ Medium | 1–2 hari | P2 |
| 8 | Raw Thermal ESC/POS Print | New Feature (Technical) | ⭐⭐⭐⭐⭐ Very Hard | 3–5 hari | P1 |
| 9 | Nomor Customer | Model Enhancement | ⭐ Easy | 3–4 jam | P3 |
| 10 | Dashboard New + Existing Customer | Enhancement | ⭐⭐ Medium | 4–6 jam | P2 |
| 11 | Edit & Delete Paket (Super Admin) | New Feature | ⭐⭐ Medium | 3–4 jam | P2 |

**Total estimasi**: ~12–18 hari kerja · Recommended sprint: 2 sprints × 1 minggu

---

## Architecture Impact Map

### Models yang DIUBAH

```
models/Service.ts           → +sellingByCommissionType, +sellingByCommissionValue
models/Invoice.ts           → items[].sellingBy (ObjectId ref Staff)
models/Customer.ts          → +customerNumber (Number, autoincrement), +publicToken (String)
models/Settings.ts          → +waAppointmentReminderEnabled, +waAppointmentReminderTemplateId,
                              +waAppointmentReminderMinutesBefore, +waNotaTemplate, +waAdminNotaPrefix
models/ServiceBundle.ts     → +sellingByCommissionType, +sellingByCommissionValue
models/ServicePackage.ts    → +sellingByCommissionType, +sellingByCommissionValue
```

### File API BARU

```
app/api/cron/wa-appointment-reminder/route.ts   → Feature 5: cron reminder WA
app/api/invoices/[id]/send-wa/route.ts          → Feature 6: kirim nota ke WA
app/api/customer-packages/[id]/route.ts         → Feature 11: edit/delete paket
app/api/customers/portal-token/route.ts         → Feature 7: generate public token
app/api/invoices/[id]/thermal/route.ts          → Feature 8: generate ESC/POS binary
lib/escpos.ts                                   → Feature 8: ESC/POS builder utility
```

### File API DIMODIFIKASI

```
app/api/appointments/[id]/route.ts              → Feature 4: sync invoice date on edit
app/api/reports/route.ts                        → Feature 1, 2: selling by report + sort
app/api/customers/route.ts                      → Feature 9: auto-assign customerNumber
app/api/invoices/route.ts                       → Feature 1: sellingBy in POS invoice
app/api/dashboard/route.ts (or reports)         → Feature 10: new vs existing customer
```

### File UI BARU

```
app/[slug]/(frontend)/portal/[token]/page.tsx   → Feature 7: public customer history page
```

### File UI DIMODIFIKASI

```
app/[slug]/(frontend)/pos/page.tsx              → Feature 1, 6: selling by dropdown + WA nota
app/[slug]/(frontend)/invoices/print/[id]/      → Feature 6, 8: WA button + thermal print
app/[slug]/(frontend)/appointments/...          → Feature 3: today button
app/[slug]/(frontend)/customers/[id]/page.tsx   → Feature 7, 11: portal link + paket actions
app/[slug]/(frontend)/reports/performance/...   → Feature 1, 2: selling by + sort
app/[slug]/(frontend)/dashboard/...             → Feature 10: customer chart widget
app/[slug]/(frontend)/settings/...              → Feature 5, 6: WA reminder + nota settings
app/[slug]/(frontend)/services/...              → Feature 1: selling by commission field
```

---

## Feature 1 — Komisi "Selling By" Staff

### Thinking Block (DToP)

```
Problem: Klien ingin tracking "siapa yang jual" terpisah dari "siapa yang kerjain".
Contoh real: Kasir (Siti) upsell paket cuci blow ke pelanggan → Siti dapat selling commission.
Stylist (Rini) yang mengerjakan blow-nya → Rini dapat execution commission.
Ini 2 role berbeda, tapi saat ini invoice items hanya punya `staffAssignments` (execution only).

Decision:
1. Tambah field `sellingBy?: ObjectId` di invoice.items (bukan di staffAssignments karena
   staffAssignments sudah dipakai untuk split execution commission).
2. Tambah `sellingByCommissionType` dan `sellingByCommissionValue` di Service, ServiceBundle,
   ServicePackage (per-item config, bukan global).
3. Saat invoice dibuat di POS: kalkulasi sellingByCommission = harga × rate.
4. Di Payroll: pisahkan totalExecutionCommission dan totalSellingByCommission.
5. Di Performance Report: tambah kolom "Komisi Penjualan" (selling by).

Tradeoff yang dipertimbangkan:
- Option A: Satu field commission untuk semua → DITOLAK, tidak bisa distinguish peran
- Option B: Masukkan selling by ke staffAssignments → DITOLAK, staffAssignments untuk split
  commission dan punya validasi total = 100%, akan konflik
- Option C (DIPILIH): Field terpisah sellingBy + sellingByCommission di level item invoice
  → Clean separation, backward compatible
```

### User Flow

```
[Admin] Settings → Master Service → Edit Service → Set "Komisi Penjualan"
  └─ commissionSellingType: percentage | fixed
  └─ commissionSellingValue: angka

[Kasir] POS → Tambah Item Service/Paket/Bundling
  └─ Muncul row: "Dikerjakan oleh" (existing) + "Dijual oleh" (NEW)
  └─ Dropdown staff (optional, bisa kosong)
  └─ Sistem auto-calc sellingByCommission dari commissionSelling di service

[Admin] Reports → Performance Staff
  └─ Kolom baru: "Komisi Penjualan" 
  └─ Aggregate dari invoice items WHERE sellingBy = staff._id

[Admin] Payroll
  └─ Breakdown: Gaji Pokok + Komisi Execution + Komisi Penjualan + Tips + Bonus
```

### Schema Changes

```typescript
// models/Service.ts — tambah field
sellingByCommissionType: {
  type: String,
  enum: ['percentage', 'fixed'],
  default: 'fixed',
},
sellingByCommissionValue: { type: Number, default: 0 },

// models/Invoice.ts — di dalam items[]
sellingBy: { type: Schema.Types.ObjectId, ref: 'Staff' },
sellingByCommission: { type: Number, default: 0 },

// models/Payroll.ts — di breakdown
totalSellingByCommission: { type: Number, default: 0 },
```

### API Changes

```typescript
// app/api/invoices/route.ts — POST handler, saat create invoice
// Setelah calc commission existing, tambah:
for (const item of items) {
  if (item.sellingBy && item.itemModel === 'Service') {
    const service = await Service.findById(item.item).lean();
    if (service?.sellingByCommissionValue > 0) {
      item.sellingByCommission = service.sellingByCommissionType === 'percentage'
        ? (item.total * service.sellingByCommissionValue) / 100
        : service.sellingByCommissionValue * item.quantity;
    }
  }
}

// app/api/reports/route.ts — case 'staff_performance':
// Tambah aggregate sellingByCommission per staff:
const sellingByStats = await Invoice.aggregate([
  { $match: { date: { $gte: start, $lte: end }, status: { $nin: ['cancelled', 'voided'] } } },
  { $unwind: '$items' },
  { $match: { 'items.sellingBy': { $exists: true } } },
  { $group: {
    _id: '$items.sellingBy',
    totalSellingCommission: { $sum: '$items.sellingByCommission' },
    totalSellingCount: { $sum: 1 }
  }}
]);
```

### POS UI Change (Simplified)

```tsx
// Tambah di setiap item row di POS
<select 
  value={item.sellingBy || ''}
  onChange={(e) => updateItem(idx, 'sellingBy', e.target.value)}
  className="text-xs border rounded px-2 py-1"
>
  <option value="">Dijual oleh...</option>
  {staffList.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
</select>
```

---

## Feature 2 — Performance Staff Sort

### Thinking Block (DToP)

```
Problem: Performance staff tidak bisa di-sort. Klien ingin bisa sort seperti di sales report.
Root cause: API reports?type=staff_performance tidak menerima sortBy/sortOrder param.
Fix: Minimal — tambah sortBy dan sortOrder query param, apply di aggregation pipeline.
```

### Code Change

```typescript
// app/api/reports/route.ts — case 'staff_performance':
const sortBy = searchParams.get('sortBy') || 'totalRevenue'; // name|totalRevenue|commission|services
const sortOrder = searchParams.get('sortOrder') === 'asc' ? 1 : -1;

// Setelah aggregate, sort:
staffPerformance.sort((a: any, b: any) => {
  const aVal = a[sortBy] ?? 0;
  const bVal = b[sortBy] ?? 0;
  if (typeof aVal === 'string') return sortOrder * aVal.localeCompare(bVal);
  return sortOrder * (aVal - bVal);
});
```

```tsx
// UI: Tambah sort controls di halaman performance
const [sortBy, setSortBy] = useState('totalRevenue');
const [sortOrder, setSortOrder] = useState<'asc'|'desc'>('desc');

<select value={sortBy} onChange={e => setSortBy(e.target.value)}>
  <option value="name">Nama</option>
  <option value="totalRevenue">Total Revenue</option>
  <option value="totalCommission">Total Komisi</option>
  <option value="servicesCount">Jumlah Servis</option>
</select>
<button onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}>
  {sortOrder === 'desc' ? '↓' : '↑'}
</button>
```

---

## Feature 3 — Menu Today di Appointment

### Thinking Block (DToP)

```
Problem: User harus manual set tanggal ke hari ini. Simple quality-of-life improvement.
Fix: Tambah tombol "Hari Ini" yang set dateFilter ke new Date().
No backend change needed.
```

### Code Change

```tsx
// Tambah button di appointment page header
<button
  onClick={() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setDateFilter(today);  // atau setViewDate(new Date()) kalau pakai calendar view
  }}
  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors
    ${isToday(selectedDate) ? 'bg-purple-50 border-purple-200 text-purple-700' : 
    'border-gray-200 hover:border-gray-300'}`}
>
  Hari Ini
</button>
```

---

## Feature 4 — Bug Fix: Appointment Date Tidak Update di Invoice

### Thinking Block (DToP)

```
Problem: Edit appointment tanggal → invoice tidak ikut update tanggal → revenue
tercatat di tanggal lama → laporan keuangan salah.

Root cause trace:
1. PUT /api/appointments/[id] → update Appointment.date ✓
2. Tapi Invoice yang linked ke appointment.id TIDAK diupdate datenya ✗

Why this matters: Invoice.date dipakai sebagai dasar semua laporan keuangan.
Kalau appointment Senin diedit jadi Selasa, pendapatan harus pindah ke Selasa.

Fix: Setelah update appointment, cari invoice dengan appointment = id, update datenya.
Edge case: Kalau invoice sudah di-VOID/cancelled, jangan update.
```

### Code Fix

```typescript
// app/api/appointments/[id]/route.ts — PUT handler
export async function PUT(request: NextRequest, props: any) {
  // ... existing code ...
  
  const oldDate = appointment.date;
  const newDate = body.date ? new Date(body.date) : undefined;
  
  // Update appointment
  Object.assign(appointment, body);
  await appointment.save();
  
  // [FIX] Sync invoice date kalau tanggal berubah
  if (newDate && oldDate.toDateString() !== newDate.toDateString()) {
    await Invoice.updateMany(
      { 
        appointment: appointment._id,
        status: { $nin: ['cancelled', 'voided'] }
      },
      { $set: { date: newDate } }
    );
  }
  
  return NextResponse.json({ success: true, data: appointment });
}
```

---

## Feature 5 — WA Appointment Reminder

### Thinking Block (DToP)

```
Problem: Sistem reminder saat ini pakai SMS/Email via Twilio/SMTP.
Klien mau WA reminder (Fonnte) yang bisa dikonfigurasi:
1. Template WA (pakai WaTemplate yang sudah ada)
2. Berapa menit/jam sebelum appointment

Design decision:
- Bukan trigger manual (sudah ada di send-reminders), ini auto dari cron
- Cron interval: setiap 15 menit (cukup presisi untuk "1 jam sebelum")
- Field baru di Settings: waAppointmentReminderEnabled, minutesBefore, templateId
- Mark reminderSent di Appointment supaya tidak double-send

Tradeoff:
- Option A: Tambah di cron existing send-reminders → DITOLAK, itu manual trigger
- Option B (DIPILIH): Cron baru yang dedicated, lebih clean
- minutesBefore sebagai single number (mis: 60 = 1 jam sebelum)
```

### Settings Schema Change

```typescript
// models/Settings.ts — tambah section WA Reminder
waAppointmentReminderEnabled: { type: Boolean, default: false },
waAppointmentReminderTemplateId: { 
  type: mongoose.Schema.Types.ObjectId, ref: 'WaTemplate' 
},
waAppointmentReminderMinutesBefore: { type: Number, default: 60 },
// Default template kalau tidak pilih custom:
waAppointmentReminderDefaultTemplate: {
  type: String,
  default: 'Halo {{customerName}} 👋\n\nRemindernya, Anda ada janji di *{{storeName}}* hari ini:\n📅 {{date}} pukul *{{time}}*\nLayanan: {{services}}\nStaff: {{staffName}}\n\nSampai jumpa! 💆'
},
```

### New Cron API

```typescript
// app/api/cron/wa-appointment-reminder/route.ts
import { getTenantModels } from '@/lib/tenantDb';
import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsApp } from '@/lib/fonnte';
import { decryptFonnteToken } from '@/lib/encryption';
import { normalizeIndonesianPhone } from '@/lib/phone';
import { format, addMinutes } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get all tenant slugs (atau per-tenant kalau multi-tenant)
  const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
  const { Settings, Appointment } = await getTenantModels(tenantSlug);

  const settings: any = await Settings.findOne({}).lean();
  if (!settings?.waAppointmentReminderEnabled) {
    return NextResponse.json({ success: true, message: 'Reminder disabled' });
  }

  const minutesBefore = settings.waAppointmentReminderMinutesBefore || 60;
  const fonnteToken = settings.fonnteToken 
    ? decryptFonnteToken(String(settings.fonnteToken).trim()) 
    : process.env.FONNTE_TOKEN;

  if (!fonnteToken) {
    return NextResponse.json({ error: 'Fonnte not configured' }, { status: 500 });
  }

  // Cari appointments yang waktu mulainya = sekarang + minutesBefore (±15 menit tolerance)
  const now = new Date();
  const targetTime = addMinutes(now, minutesBefore);
  const windowStart = addMinutes(targetTime, -8);
  const windowEnd = addMinutes(targetTime, 8);

  const appointments = await Appointment.find({
    date: { $gte: windowStart, $lte: windowEnd },
    status: { $in: ['pending', 'confirmed'] },
    reminderSent: { $ne: true },
  })
    .populate('customer', 'name phone waNotifEnabled')
    .populate('staff', 'name')
    .lean();

  let sent = 0, failed = 0;

  for (const appt of appointments) {
    const customer: any = appt.customer;
    if (!customer?.phone || !customer?.waNotifEnabled) continue;

    const timezone = settings.timezone || 'Asia/Jakarta';
    const zonedDate = toZonedTime(appt.date, timezone);
    const dateStr = format(zonedDate, 'EEEE, dd MMM yyyy', { locale: id });
    const timeStr = appt.startTime;
    const serviceNames = appt.services?.map((s: any) => s.name).join(', ') || '-';

    // Build message from template
    let message = settings.waAppointmentReminderDefaultTemplate;
    if (settings.waAppointmentReminderTemplateId) {
      const { WaTemplate } = await getTenantModels(tenantSlug);
      const tpl: any = await WaTemplate.findById(settings.waAppointmentReminderTemplateId).lean();
      if (tpl?.content) message = tpl.content;
    }

    message = message
      .replace(/{{customerName}}/g, customer.name)
      .replace(/{{storeName}}/g, settings.storeName || 'Salon')
      .replace(/{{date}}/g, dateStr)
      .replace(/{{time}}/g, timeStr)
      .replace(/{{services}}/g, serviceNames)
      .replace(/{{staffName}}/g, (appt.staff as any)?.name || '-');

    try {
      const phone = normalizeIndonesianPhone(customer.phone);
      await sendWhatsApp({ token: fonnteToken, target: phone, message });
      await Appointment.findByIdAndUpdate(appt._id, {
        reminderSent: true,
        reminderSentAt: new Date()
      });
      sent++;
    } catch (err) {
      failed++;
    }
  }

  return NextResponse.json({ success: true, sent, failed });
}
```

---

## Feature 6 — Tombol Kirim Nota ke WA

### Thinking Block (DToP)

```
Problem: Setelah transaksi selesai, kasir harus manual kirim struk. Klien mau ada
tombol langsung kirim nota ke WA customer + tombol kirim ke admin WA.

Design:
- 2 tombol terpisah: "Kirim ke Customer" dan "Kirim ke Admin"
- "Kirim ke Customer": pakai nomor HP customer, format struk ringkas
- "Kirim ke Admin": pakai waAdminNumber dari Settings, bisa tambah teks kustom di awal
- Settings baru: waNotaTemplate (template struk WA), waAdminNotaPrefix (teks tambahan)
- Format nota: teks biasa (bukan gambar), WhatsApp-friendly

Tradeoff:
- Option A: Kirim sebagai gambar (screenshot) → DITOLAK, butuh headless browser, overkill
- Option B (DIPILIH): Kirim sebagai teks terformat → Simple, reliable, readable
```

### Settings Schema Change

```typescript
// models/Settings.ts — tambah
waNotaTemplate: {
  type: String,
  default: '🧾 *NOTA TRANSAKSI*\n*{{storeName}}*\n{{storeAddress}}\n\n'
    + 'No: {{invoiceNumber}}\nTanggal: {{date}}\nKasir: {{staffName}}\n\n'
    + '{{items}}\n\n'
    + 'Subtotal: {{subtotal}}\nDiskon: {{discount}}\n*TOTAL: {{total}}*\n'
    + 'Bayar: {{amountPaid}}\nKembalian: {{change}}\n\n'
    + 'Terima kasih, {{customerName}}! 🙏\n{{receiptFooter}}'
},
waAdminNotaPrefix: {
  type: String,
  default: '📋 *LAPORAN TRANSAKSI BARU*\n'
},
```

### New API: POST /api/invoices/[id]/send-wa

```typescript
// app/api/invoices/[id]/send-wa/route.ts
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
  const { Invoice, Settings } = await getTenantModels(tenantSlug);

  const body = await request.json();
  const { target } = body; // 'customer' | 'admin'

  const invoice: any = await Invoice.findById(params.id)
    .populate('customer', 'name phone')
    .populate('staff', 'name')
    .lean();

  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

  const settings: any = await Settings.findOne({}).lean();
  const fonnteToken = settings?.fonnteToken
    ? decryptFonnteToken(String(settings.fonnteToken).trim())
    : process.env.FONNTE_TOKEN;

  if (!fonnteToken) return NextResponse.json({ error: 'Fonnte not configured' }, { status: 500 });

  // Build items text
  const itemsText = invoice.items
    .map((item: any) => `• ${item.name} x${item.quantity} = ${formatCurrency(item.total)}`)
    .join('\n');

  const change = Math.max(0, invoice.amountPaid - invoice.totalAmount);

  let message = settings?.waNotaTemplate || DEFAULT_NOTA_TEMPLATE;
  message = message
    .replace(/{{storeName}}/g, settings?.storeName || '')
    .replace(/{{storeAddress}}/g, settings?.address || '')
    .replace(/{{invoiceNumber}}/g, invoice.invoiceNumber)
    .replace(/{{date}}/g, format(new Date(invoice.date), 'dd/MM/yyyy HH:mm'))
    .replace(/{{staffName}}/g, invoice.staff?.name || '-')
    .replace(/{{items}}/g, itemsText)
    .replace(/{{subtotal}}/g, formatCurrency(invoice.subtotal))
    .replace(/{{discount}}/g, formatCurrency(invoice.discount || 0))
    .replace(/{{total}}/g, formatCurrency(invoice.totalAmount))
    .replace(/{{amountPaid}}/g, formatCurrency(invoice.amountPaid))
    .replace(/{{change}}/g, formatCurrency(change))
    .replace(/{{customerName}}/g, invoice.customer?.name || 'Pelanggan')
    .replace(/{{receiptFooter}}/g, settings?.receiptFooter || '');

  // Add portal link if customer has publicToken
  if (target === 'customer' && invoice.customer?.publicToken) {
    const baseUrl = process.env.NEXTAUTH_URL || '';
    message += `\n\n📱 Lihat riwayat kunjungan: ${baseUrl}/${tenantSlug}/portal/${invoice.customer.publicToken}`;
  }

  if (target === 'admin') {
    message = (settings?.waAdminNotaPrefix || '') + message;
  }

  const phone = target === 'customer'
    ? normalizeIndonesianPhone(invoice.customer?.phone || '')
    : normalizeIndonesianPhone(settings?.waAdminNumber || '');

  if (!phone) return NextResponse.json({ error: 'Phone not available' }, { status: 400 });

  await sendWhatsApp({ token: fonnteToken, target: phone, message });

  return NextResponse.json({ success: true });
}
```

---

## Feature 7 — Link Halaman History Customer

### Thinking Block (DToP)

```
Problem: Klien mau ada link yang bisa dikirim ke customer untuk lihat riwayat kunjungan.
Data yang ditampilkan (dari screenshot Image 1): membership, loyalty points, total belanja,
sisa paket, saldo wallet, riwayat invoice, riwayat paket.

Security consideration:
- URL harus pakai token unik (UUID), bukan customer ID langsung
- Token bersifat permanent (tidak expire) — klien minta simple
- Halaman READ ONLY, tidak ada fungsi edit apapun
- Tidak perlu login customer

Architecture:
- Customer.publicToken (UUID, generated on first access atau on customer create)
- Public page: /[slug]/portal/[token] → fetch customer data by token
- API: GET /api/customers/portal/[token] (no auth, public)
```

### Customer Model Change

```typescript
// models/Customer.ts — tambah
publicToken: { 
  type: String, 
  trim: true, 
  unique: true, 
  sparse: true,
  default: () => require('crypto').randomUUID()
},
```

### New Public Page

```typescript
// app/[slug]/(frontend)/portal/[token]/page.tsx
// Server component — no auth required
import { getTenantModels } from '@/lib/tenantDb';
import { format } from 'date-fns';

export default async function CustomerPortalPage({ 
  params 
}: { 
  params: { slug: string; token: string } 
}) {
  const { Customer, Invoice, CustomerPackage, Settings } = await getTenantModels(params.slug);
  
  const customer = await Customer.findOne({ publicToken: params.token }).lean();
  if (!customer) return <div>Link tidak valid.</div>;
  
  const settings: any = await Settings.findOne({}).lean();
  
  const invoices = await Invoice.find({ 
    customer: customer._id,
    status: { $nin: ['cancelled', 'voided'] }
  }).sort({ date: -1 }).limit(20).lean();
  
  const activePackages = await CustomerPackage.find({
    customer: customer._id,
    status: 'active'
  }).lean();

  // Render read-only customer history
  return (
    <div className="max-w-md mx-auto p-4 min-h-screen bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border p-5 mb-4">
        <h1 className="font-semibold text-lg">{customer.name}</h1>
        <p className="text-gray-500 text-sm">{settings?.storeName}</p>
        
        {/* Membership, Points, Wallet cards */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <StatCard label="Loyalty Points" value={`${customer.loyaltyPoints} pts`} />
          <StatCard label="Total Belanja" value={formatCurrency(customer.totalPurchases)} />
          <StatCard label="Saldo Wallet" value={formatCurrency(customer.walletBalance)} />
          <StatCard label="Membership" value={customer.membershipTier.toUpperCase()} />
        </div>
      </div>
      
      {/* Active Packages */}
      {activePackages.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border p-5 mb-4">
          <h2 className="font-medium mb-3">Paket Aktif</h2>
          {activePackages.map((pkg: any) => (
            <PackageCard key={pkg._id} pkg={pkg} />
          ))}
        </div>
      )}
      
      {/* Invoice History */}
      <div className="bg-white rounded-2xl shadow-sm border p-5">
        <h2 className="font-medium mb-3">Riwayat Kunjungan</h2>
        {invoices.map((inv: any) => (
          <InvoiceRow key={inv._id} invoice={inv} />
        ))}
      </div>
    </div>
  );
}
```

---

## Feature 8 — Raw Thermal Printing ESC/POS

### Thinking Block (DToP)

```
Problem: Saat ini print nota pakai browser print (window.print()) dengan fixed paper height.
Thermal printer butuh:
1. Paper height otomatis (dynamic, sesuai isi)
2. Raw ESC/POS commands (bukan HTML/PDF)
3. Auto feed dan cut di akhir

Opsi yang dipertimbangkan:
A. WebUSB + escpos library (browser → USB printer langsung)
   PRO: No server needed, modern
   CON: Hanya Chrome, butuh user gesture, security concern
   
B. QZ Tray (desktop bridge app)
   PRO: Compatible semua browser, support network & USB printer
   CON: Harus install QZ Tray di PC kasir, paid license

C. Server-side ESC/POS binary endpoint
   PRO: Server generate binary, client receive dan print
   CON: Client masih perlu bridge untuk print, sama seperti A atau B
   
D. Print via Network Printer (TCP socket, IP:9100)
   PRO: Bisa dari server langsung
   CON: Butuh printer terkoneksi ke LAN, config IP

REKOMENDASI: Implementasi dua path:
- Path 1: WebUSB (untuk Chrome desktop) — zero installation
- Path 2: Fallback ke Window.print() dengan CSS yang dioptimasi untuk thermal

Library: `escpos-buffer` (pure JS, tidak butuh native driver)

CATATAN PENTING: Ini fitur yang paling complex dan butuh testing langsung dengan
hardware printer. Budget yang diminta klien Rp 1.2jt untuk 11 fitur sangat ketat
untuk fitur ini saja. Pastikan klien paham ini butuh waktu testing ekstra.
```

### ESC/POS Utility Library

```typescript
// lib/escpos.ts
// ESC/POS command builder

export const ESC = '\x1B';
export const GS = '\x1D';

export const Commands = {
  INIT: `${ESC}@`,           // Initialize printer
  CENTER: `${ESC}a\x01`,    // Center align
  LEFT: `${ESC}a\x00`,      // Left align
  BOLD_ON: `${ESC}E\x01`,
  BOLD_OFF: `${ESC}E\x00`,
  DOUBLE_HEIGHT: `${ESC}!\x10`,
  NORMAL_SIZE: `${ESC}!\x00`,
  SEPARATOR: '--------------------------------\n',
  FEED_3: `${ESC}d\x03`,    // Feed 3 lines
  CUT: `${GS}V\x01`,        // Partial cut
  FULL_CUT: `${GS}V\x00`,   // Full cut
};

export function buildReceiptBuffer(invoice: any, settings: any): string {
  let buffer = '';
  
  buffer += Commands.INIT;
  buffer += Commands.CENTER;
  buffer += Commands.BOLD_ON;
  buffer += Commands.DOUBLE_HEIGHT;
  buffer += `${settings.storeName}\n`;
  buffer += Commands.NORMAL_SIZE;
  buffer += Commands.BOLD_OFF;
  buffer += `${settings.address}\n`;
  buffer += `${settings.phone}\n`;
  buffer += Commands.SEPARATOR;
  
  buffer += Commands.LEFT;
  buffer += `No   : ${invoice.invoiceNumber}\n`;
  buffer += `Tgl  : ${format(new Date(invoice.date), 'dd/MM/yy HH:mm')}\n`;
  buffer += `Staff: ${invoice.staff?.name || '-'}\n`;
  if (invoice.customer?.name) buffer += `Cust : ${invoice.customer.name}\n`;
  buffer += Commands.SEPARATOR;
  
  for (const item of invoice.items) {
    buffer += `${item.name}\n`;
    buffer += `  ${item.quantity} x ${formatCurrencyShort(item.price)}`;
    buffer += `       ${formatCurrencyShort(item.total)}\n`;
    if (item.discount > 0) buffer += `  Diskon: -${formatCurrencyShort(item.discount)}\n`;
  }
  
  buffer += Commands.SEPARATOR;
  buffer += `Subtotal      ${formatCurrencyShort(invoice.subtotal).padStart(12)}\n`;
  if (invoice.discount > 0) 
    buffer += `Diskon        ${('-'+formatCurrencyShort(invoice.discount)).padStart(12)}\n`;
  buffer += Commands.BOLD_ON;
  buffer += `TOTAL         ${formatCurrencyShort(invoice.totalAmount).padStart(12)}\n`;
  buffer += Commands.BOLD_OFF;
  buffer += `Bayar         ${formatCurrencyShort(invoice.amountPaid).padStart(12)}\n`;
  const change = Math.max(0, invoice.amountPaid - invoice.totalAmount);
  buffer += `Kembali       ${formatCurrencyShort(change).padStart(12)}\n`;
  buffer += Commands.SEPARATOR;
  
  buffer += Commands.CENTER;
  buffer += `${settings.receiptFooter}\n`;
  buffer += Commands.FEED_3;
  buffer += Commands.CUT;
  
  return buffer;
}
```

### Thermal Print API Endpoint

```typescript
// app/api/invoices/[id]/thermal/route.ts
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
  const { Invoice, Settings } = await getTenantModels(tenantSlug);

  const invoice = await Invoice.findById(params.id)
    .populate('customer', 'name phone')
    .populate('staff', 'name')
    .lean();

  const settings = await Settings.findOne({}).lean();
  
  const receiptBuffer = buildReceiptBuffer(invoice, settings);
  
  // Return as binary
  const bytes = Buffer.from(receiptBuffer, 'binary');
  return new Response(bytes, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="receipt-${invoice.invoiceNumber}.bin"`,
    },
  });
}
```

### Frontend WebUSB Implementation

```typescript
// components/ThermalPrintButton.tsx
async function printThermal(invoiceId: string) {
  try {
    // Request USB device (thermal printer, usually vendor 0x04B8 Epson or 0x1CB0)
    const device = await (navigator as any).usb.requestDevice({
      filters: [
        { vendorId: 0x04B8 }, // Epson
        { vendorId: 0x1CB0 }, // Generic thermal
        { vendorId: 0x0483 }, // STM32 based
      ]
    });
    
    await device.open();
    if (device.configuration === null) await device.selectConfiguration(1);
    await device.claimInterface(0);
    
    // Fetch ESC/POS binary from server
    const res = await fetch(`/api/invoices/${invoiceId}/thermal`, {
      headers: { 'x-store-slug': storeSlug }
    });
    const buffer = await res.arrayBuffer();
    
    // Find bulk-out endpoint
    const endpoint = device.configuration.interfaces[0].alternate.endpoints
      .find((e: any) => e.direction === 'out');
    
    await device.transferOut(endpoint.endpointNumber, buffer);
    await device.close();
    
    toast.success('Nota berhasil dicetak!');
  } catch (err: any) {
    if (err.name === 'NotFoundError') {
      toast.error('Printer tidak ditemukan. Pastikan printer USB terhubung.');
    } else {
      // Fallback ke browser print
      window.print();
    }
  }
}
```

---

## Feature 9 — Nomor Customer

### Thinking Block (DToP)

```
Problem: Tidak ada nomor urut customer, susah tracking "pelanggan ke-berapa".
Sudah ada Counter model di codebase — pakai itu untuk auto-increment.
```

### Schema + Counter Logic

```typescript
// models/Customer.ts — tambah
customerNumber: { type: Number, unique: true, sparse: true },

// Di API POST /api/customers — tambah sebelum save
const { Counter } = await getTenantModels(tenantSlug);
const counter = await Counter.findOneAndUpdate(
  { name: 'customerNumber' },
  { $inc: { value: 1 } },
  { upsert: true, new: true }
);
customer.customerNumber = counter.value;
```

---

## Feature 10 — Dashboard New + Existing Customer

### Thinking Block (DToP)

```
Problem: Dashboard tidak menampilkan data akuisisi customer baru vs returning.
Definition:
- New Customer = customer yang transaksi PERTAMANYA ada dalam range tanggal dipilih
- Existing Customer = customer yang transaksi dalam range, tapi sudah pernah transaksi sebelumnya
- Total unique customer = new + existing

Implementasi:
1. Ambil semua customer yang punya invoice dalam range
2. Untuk tiap customer, cek apakah ada invoice SEBELUM range
3. Kalau tidak ada invoice sebelum range → new; kalau ada → existing
```

### API Logic

```typescript
// app/api/reports/route.ts — atau app/api/dashboard/route.ts
// case 'customer_acquisition':
const customersInRange = await Invoice.distinct('customer', {
  date: { $gte: start, $lte: end },
  status: { $nin: ['cancelled', 'voided'] }
});

// Check which ones had invoices BEFORE the range
const existingCustomers = await Invoice.distinct('customer', {
  customer: { $in: customersInRange },
  date: { $lt: start },
  status: { $nin: ['cancelled', 'voided'] }
});

const existingSet = new Set(existingCustomers.map(String));
const newCount = customersInRange.filter(id => !existingSet.has(String(id))).length;
const existingCount = existingCustomers.filter(id => 
  customersInRange.map(String).includes(String(id))
).length;

data = {
  newCustomers: newCount,
  existingCustomers: existingCount,
  totalUniqueCustomers: customersInRange.length,
};
```

### Dashboard Widget

```tsx
// Dashboard widget component
<div className="grid grid-cols-3 gap-3">
  <DashCard 
    label="Customer Baru" 
    value={data.newCustomers}
    icon="👤+" 
    color="green"
  />
  <DashCard 
    label="Customer Kembali" 
    value={data.existingCustomers}
    icon="🔄" 
    color="blue"
  />
  <DashCard 
    label="Total Unik" 
    value={data.totalUniqueCustomers}
    icon="👥" 
    color="purple"
  />
</div>
```

---

## Feature 11 — Edit & Delete Paket (Super Admin Only)

### Thinking Block (DToP)

```
Problem: Admin perlu bisa edit (ubah expiry date, sisa quota) dan delete (cancel) 
paket aktif customer. Tapi ini aksi berbahaya (bisa abuse), jadi hanya super admin.

Dari screenshot Image 3: tombol "Expired date:", "Edit", "Delete" ditampilkan
di bawah info paket aktif di halaman customer detail.

Permission: Gunakan permission packages.delete untuk gate aksi ini.
Super admin sudah punya semua permission. Kasir/staff tidak.

API:
- PUT /api/customer-packages/[id] → update expiresAt dan/atau serviceQuotas remainingQuota
- DELETE /api/customer-packages/[id] → set status = 'cancelled'
```

### New API Endpoint

```typescript
// app/api/customer-packages/[id]/route.ts
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const permissionError = await checkPermission(request, 'packages', 'edit');
  if (permissionError) return permissionError;

  const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
  const { CustomerPackage } = await getTenantModels(tenantSlug);

  const body = await request.json();
  const { expiresAt, serviceQuotas } = body;

  const pkg = await CustomerPackage.findById(params.id);
  if (!pkg) return NextResponse.json({ error: 'Package not found' }, { status: 404 });

  if (expiresAt) pkg.expiresAt = new Date(expiresAt);
  if (serviceQuotas) {
    // Update remaining quotas per service
    for (const update of serviceQuotas) {
      const quota = pkg.serviceQuotas.find(
        (q: any) => String(q.service) === String(update.service)
      );
      if (quota) {
        quota.remainingQuota = Math.max(0, update.remainingQuota);
      }
    }
  }

  await pkg.save();
  return NextResponse.json({ success: true, data: pkg });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const permissionError = await checkPermission(request, 'packages', 'delete');
  if (permissionError) return permissionError;

  const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
  const { CustomerPackage } = await getTenantModels(tenantSlug);

  await CustomerPackage.findByIdAndUpdate(params.id, { status: 'cancelled' });
  return NextResponse.json({ success: true });
}
```

### UI Change — Customer Detail Page

```tsx
// Tambah di customer detail page, di section Paket Aktif
// Hanya tampilkan kalau user punya permission packages.delete

const { hasPermission } = usePermission();
const canManagePackages = hasPermission('packages', 'delete');

{activePackages.map(pkg => (
  <div key={pkg._id} className="border rounded-xl p-4 flex items-center justify-between">
    <div>
      <p className="font-medium">{pkg.packageName}</p>
      {pkg.serviceQuotas.map(q => (
        <span key={q.service} className="badge">
          {q.serviceName}: {q.remainingQuota}/{q.totalQuota}
        </span>
      ))}
      <p className="text-xs text-gray-400">
        Exp: {pkg.expiresAt ? format(new Date(pkg.expiresAt), 'dd MMM yyyy') : '∞'}
      </p>
    </div>
    
    {canManagePackages && (
      <div className="flex gap-2">
        <button 
          onClick={() => openEditPackageModal(pkg)}
          className="btn-sm btn-outline"
        >
          Edit
        </button>
        <button 
          onClick={() => confirmDeletePackage(pkg._id)}
          className="btn-sm btn-danger"
        >
          Delete
        </button>
      </div>
    )}
  </div>
))}
```

---

## Implementation Schedule (Sprint Plan)

### Sprint 1 (Hari 1–7): Foundation + Quick Wins

| Hari | Task |
|------|------|
| 1 | Feature 4 (Bug Fix Date) + Feature 3 (Today Menu) + Feature 9 (No Customer) |
| 2 | Feature 2 (Sort Staff) + Feature 10 (Dashboard Customer) + Feature 11 (Edit/Delete Paket) |
| 3–4 | Feature 5 (WA Reminder) |
| 5–6 | Feature 6 (Kirim Nota WA) + Feature 7 (History Portal) |
| 7 | Testing Sprint 1 + Fix bugs |

### Sprint 2 (Hari 8–14): Heavy Features

| Hari | Task |
|------|------|
| 8–10 | Feature 1 (Komisi Selling By) — Model + API |
| 11 | Feature 1 — POS UI + Report UI |
| 12–14 | Feature 8 (ESC/POS Thermal) — Library + API + WebUSB frontend |
| 14 | Integration testing + UAT prep |

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| ESC/POS tidak compatible dengan printer klien | Medium | High | Test early dengan spesifikasi printer klien |
| Komisi Selling By konflik dengan payroll existing | Medium | High | Test parallel dengan data dummy dulu |
| WA Reminder double-send jika cron overlap | Low | Medium | Guard dengan reminderSent flag + window tolerance |
| Performance berat di Dashboard customer query | Low | Medium | Add index customer+date di Invoice collection |
| publicToken customer bocor (URL sharing) | Low | Medium | Dokument jelas bahwa link bersifat "semi-public" |

---

## Success Metrics per Feature

| # | Feature | Definition of Done |
|---|---------|-------------------|
| 1 | Komisi Selling By | Selling commission terhitung di invoice, tampil di report performance |
| 2 | Performance Sort | Sort by name/revenue/commission berjalan di halaman report |
| 3 | Today Menu | Klik "Hari Ini" → appointment list filter ke tanggal hari ini |
| 4 | Bug Fix Date | Edit appointment date → invoice date ikut update |
| 5 | WA Reminder | Cron kirim WA otomatis X menit sebelum appointment |
| 6 | Kirim Nota WA | Tombol kirim nota ke customer + admin berhasil via Fonnte |
| 7 | History Portal | URL unik bisa diakses tanpa login, tampil data customer |
| 8 | ESC/POS | Nota tercetak dari thermal printer via WebUSB, auto-cut |
| 9 | No Customer | Setiap customer baru dapat nomor urut otomatis |
| 10 | Dashboard Customer | Widget tampil new vs existing customer per range tanggal |
| 11 | Edit/Delete Paket | Super admin bisa edit expiry + quota, atau cancel paket |
