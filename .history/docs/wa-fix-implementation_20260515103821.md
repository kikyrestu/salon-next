# Implementasi Perbaikan: Fitur WhatsApp (Fonnte)

> **Dibuat:** 15 Mei 2026  
> **Berdasarkan:** Analisis kode + Dokumentasi resmi Fonnte  
> **Root cause utama:** Format request ke Fonnte API salah — semua WA gagal terkirim secara diam-diam

---

## 🚨 ROOT CAUSE: Semua WA Gagal Karena Format Request Salah

Dokumentasi Fonnte menunjukkan bahwa API mereka **hanya menerima `multipart/form-data`** (FormData), bukan JSON.

```js
// Contoh dari docs.fonnte.com — pakai FormData:
const data = new FormData()
data.append("target", "082227097005")
data.append("message", "kirim pesan")
const response = await fetch("https://api.fonnte.com/send", {
  method: "POST",
  headers: new Headers({ Authorization: "TOKEN" }),
  body: data,   // ← FormData, bukan JSON
});
```

Kode saat ini di `lib/fonnte.ts` mengirim **JSON** dengan `Content-Type: application/json` — format yang tidak dikenali Fonnte, sehingga Fonnte mengembalikan error atau mengabaikan request, dan semua pengiriman WA gagal diam-diam.

---

## PERUBAHAN 1 — `lib/fonnte.ts` (WAJIB, PALING KRITIS)

**Bug:** Format body `JSON.stringify()` + header `Content-Type: application/json`  
**Efek:** 100% WA gagal terkirim  
**Fix:** Ganti ke `FormData` + tambah `countryCode: '62'`

### Kode LAMA (`lib/fonnte.ts`):

```ts
const response = await fetch('https://api.fonnte.com/send', {
    method: 'POST',
    headers: {
        Authorization: token,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        target: phone,
        message,
    }),
});
```

### Kode BARU (`lib/fonnte.ts`):

```ts
const form = new FormData();
form.append('target', phone);
form.append('message', message);
form.append('countryCode', '62');  // default Indonesia — Fonnte butuh ini untuk nomor lokal

const response = await fetch('https://api.fonnte.com/send', {
    method: 'POST',
    headers: {
        // ⚠️ JANGAN set Content-Type manual saat pakai FormData
        // fetch akan otomatis set multipart/form-data + boundary yang benar
        Authorization: token,
    },
    body: form,
});
```

### File lengkap setelah fix (`lib/fonnte.ts`):

```ts
export interface SendWhatsAppResult {
    success: boolean;
    data?: unknown;
    error?: string;
}

/**
 * Send a WhatsApp message via Fonnte API.
 * @param phone - Target phone number
 * @param message - Message body
 * @param fonnteToken - Optional explicit Fonnte API token. When provided, skips DB lookup.
 */
export async function sendWhatsApp(
    phone: string,
    message: string,
    fonnteToken?: string
): Promise<SendWhatsAppResult> {
    const token = (fonnteToken || process.env.FONNTE_TOKEN || '').trim();

    if (!token) {
        return { success: false, error: 'FONNTE_TOKEN is not configured. Pass token or set env variable.' };
    }

    if (!phone || !message) {
        return { success: false, error: 'phone and message are required' };
    }

    try {
        // Fonnte API hanya menerima multipart/form-data, bukan JSON
        const form = new FormData();
        form.append('target', phone);
        form.append('message', message);
        form.append('countryCode', '62');

        const response = await fetch('https://api.fonnte.com/send', {
            method: 'POST',
            headers: {
                // Tidak perlu set Content-Type — fetch otomatis handle boundary untuk FormData
                Authorization: token,
            },
            body: form,
        });

        const text = await response.text();
        let parsed: unknown = text;

        try {
            parsed = text ? JSON.parse(text) : null;
        } catch {
            parsed = text;
        }

        if (!response.ok) {
            return {
                success: false,
                error: `Fonnte request failed with status ${response.status}`,
                data: parsed,
            };
        }

        // Fonnte bisa return HTTP 200 dengan { status: false, reason: "..." }
        if (parsed && typeof parsed === 'object' && 'status' in (parsed as Record<string, unknown>)) {
            const apiStatus = Boolean((parsed as Record<string, unknown>).status);
            if (!apiStatus) {
                const reason = String((parsed as Record<string, unknown>).reason || 'Fonnte API returned status=false');
                return {
                    success: false,
                    error: reason,
                    data: parsed,
                };
            }
        }

        return { success: true, data: parsed };
    } catch (error: any) {
        return {
            success: false,
            error: error?.message || 'Unknown error while sending WhatsApp message',
        };
    }
}
```

---

## PERUBAHAN 2 — `app/api/fonnte/webhook/route.ts`

**Bug:** `payload?.device` diikutkan sebagai fallback kandidat nomor pengirim  
**Efek:** Jika field `sender` kosong, Fonnte mengirim `device` = nomor HP **pemilik device**, bukan customer — greeting akan dikirim balik ke diri sendiri

### Dari docs Fonnte:
> **Device** - Your device number (not connected device)  
> **Sender** - Sender's whatsapp number

`device` adalah nomor WA owner, bukan pengirim pesan masuk.

### Kode LAMA:

```ts
const getInboundPhone = (payload: any): string => {
    const candidates = [
        payload?.sender,
        payload?.from,
        payload?.number,
        payload?.phone,
        payload?.device,   // ❌ INI nomor device owner, bukan sender!
        payload?.chat,
    ];
    const found = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
    return String(found || '').trim();
};
```

### Kode BARU:

```ts
const getInboundPhone = (payload: any): string => {
    const candidates = [
        payload?.sender,   // ✅ Field utama dari Fonnte
        payload?.from,
        payload?.number,
        payload?.phone,
        // payload?.device DIHAPUS — ini nomor device owner, bukan customer
        payload?.chat,
    ];
    const found = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
    return String(found || '').trim();
};
```

---

## PERUBAHAN 3 — `lib/scheduler.ts`: Error handling di `processAutomations()`

**Bug:** Return value dari `sendWhatsApp()` diabaikan di semua automation rules  
**Efek:** Jika WA gagal, `lastRunDate` tetap di-update → automation tidak akan retry di run berikutnya. Kegagalan juga tidak ada log sama sekali.

**Lokasi:** Semua blok `await sendWhatsApp(...)` di dalam `processAutomations()` (baris ~235, ~259, ~285, ~312, ~337)

### Pola LAMA (berlaku di semua rule categories):

```ts
// daily_report:
for (const phone of targetPhones) {
    await sendWhatsApp(phone, message, token);   // ❌ result diabaikan
    await new Promise(r => setTimeout(r, 10000));
}
rule.lastRunDate = now;
await rule.save();

// membership_expiry:
for (const customer of customers) {
    const msg = rule.messageTemplate.replace(/{{nama_customer}}/gi, customer.name);
    await sendWhatsApp(customer.phone, msg, token);   // ❌ result diabaikan
    await new Promise(r => setTimeout(r, 10000));
}
rule.lastRunDate = now;
await rule.save();
```

### Pola BARU — tangkap result dan log error:

```ts
// daily_report:
let allSuccess = true;
for (const phone of targetPhones) {
    const result = await sendWhatsApp(phone, message, token);
    if (!result.success) {
        console.error(`[AUTOMATION:daily_report] Gagal kirim ke ${phone}: ${result.error}`);
        allSuccess = false;
    }
    await new Promise(r => setTimeout(r, 10000));
}
// Hanya update lastRunDate jika minimal 1 berhasil
if (allSuccess) {
    rule.lastRunDate = now;
    await rule.save();
}

// membership_expiry / package_expiry / birthday:
let sentCount = 0;
for (const customer of customers) {
    const msg = rule.messageTemplate.replace(/{{nama_customer}}/gi, customer.name);
    const result = await sendWhatsApp(customer.phone, msg, token);
    if (result.success) {
        sentCount++;
    } else {
        console.error(`[AUTOMATION:${rule.category}] Gagal kirim ke ${customer.name} (${customer.phone}): ${result.error}`);
    }
    await new Promise(r => setTimeout(r, 10000));
}
// Update lastRunDate meski ada sebagian yang gagal,
// supaya tidak spam ulang ke semua orang besok
rule.lastRunDate = now;
await rule.save();
console.log(`[AUTOMATION:${rule.category}] sent: ${sentCount} / ${customers.length}`);
```

---

## PERUBAHAN 4 — `lib/scheduler.ts`: `stock_alert` tidak pakai `lowStockNotifSent`

**Bug:** Automation `stock_alert` di scheduler mengirim notif ke semua produk low stock setiap hari, tapi tidak mengecek atau mengupdate flag `lowStockNotifSent`  
**Efek:** Notif stok rendah dikirim berulang setiap hari meskipun sudah dikirim sebelumnya

Bandingkan dengan `wa-stock-alert/route.ts` yang sudah pakai flag `lowStockNotifSent` dengan benar.

### Kode LAMA (di `processAutomations`, sekitar baris 242):

```ts
else if (rule.category === 'stock_alert') {
    if (targetPhones.length === 0) continue;

    const products = await Product.find({
        status: 'active',
        lowStockAlertEnabled: true,
        $expr: { $lte: ['$stock', '$alertQuantity'] }
    }).lean();

    if (products.length === 0) {
        rule.lastRunDate = now;
        await rule.save();
        continue;
    }

    const itemList = products.map((p: any) => `- ${p.name} (Sisa: ${p.stock})`).join('\n');
    const message = rule.messageTemplate.replace(/{{items}}/gi, itemList);

    for (const phone of targetPhones) {
        await sendWhatsApp(phone, message, token);    // ❌ result diabaikan
        await new Promise(r => setTimeout(r, 10000));
    }

    rule.lastRunDate = now;
    await rule.save();
}
```

### Kode BARU:

```ts
else if (rule.category === 'stock_alert') {
    if (targetPhones.length === 0) continue;

    const products = await Product.find({
        status: 'active',
        lowStockAlertEnabled: true,
        lowStockNotifSent: { $ne: true },   // ✅ hanya yang belum dinotif
        $expr: { $lte: ['$stock', '$alertQuantity'] }
    }).lean();

    if (products.length === 0) {
        rule.lastRunDate = now;
        await rule.save();
        continue;
    }

    const itemList = products.map((p: any) => `- ${p.name} (Sisa: ${p.stock})`).join('\n');
    const message = rule.messageTemplate.replace(/{{items}}/gi, itemList);

    let sent = false;
    for (const phone of targetPhones) {
        const result = await sendWhatsApp(phone, message, token);
        if (result.success) sent = true;
        else console.error(`[AUTOMATION:stock_alert] Gagal kirim ke ${phone}: ${result.error}`);
        await new Promise(r => setTimeout(r, 10000));
    }

    // Tandai produk sebagai sudah dinotif hanya jika WA berhasil terkirim
    if (sent) {
        const ids = products.map((p: any) => p._id);
        await Product.updateMany({ _id: { $in: ids } }, { $set: { lowStockNotifSent: true } });
    }

    rule.lastRunDate = now;
    await rule.save();
}
```

---

## Checklist Implementasi

- [ ] **P1 — WAJIB:** `lib/fonnte.ts` → ganti `JSON.stringify` ke `FormData`, hapus `Content-Type: application/json`, tambah `countryCode: '62'`
- [ ] **P2:** `app/api/fonnte/webhook/route.ts` → hapus `payload?.device` dari `getInboundPhone` candidates
- [ ] **P3:** `lib/scheduler.ts` `processAutomations()` → tambah pengecekan `result.success` di semua pemanggilan `sendWhatsApp()`
- [ ] **P4:** `lib/scheduler.ts` `processAutomations()` `stock_alert` → tambah filter `lowStockNotifSent: { $ne: true }` dan update flag setelah kirim

---

## Tidak Ada Perubahan Di

| File | Status | Alasan |
|---|---|---|
| `wa-membership-expiry/route.ts` | ✅ OK | fonnteToken sudah diambil dari Settings |
| `wa-package-expiry/route.ts` | ✅ OK | fonnteToken sudah diambil dari Settings |
| `wa-daily-report/route.ts` | ✅ OK | Timezone WIB sudah benar |
| `wa-stock-alert/route.ts` | ✅ OK | lowStockNotifSent sudah dipakai |
| `wa/trigger/route.ts` | ✅ OK | Dynamic import sudah benar |

---

## Cara Test Setelah Fix

### Test `fonnte.ts` langsung:
```bash
# Panggil endpoint yang pakai sendWhatsApp, contoh daily report
curl -X GET https://your-domain/api/cron/wa-daily-report \
  -H "x-store-slug: pusat" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Response yang diharapkan:
# { "success": true, "sent": 1, ... }
# Bukan { "sent": 0, "error": "..." }
```

### Test webhook Fonnte:
```bash
# Simulasi payload masuk dari Fonnte
curl -X POST https://your-domain/api/fonnte/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "x-store-slug: pusat" \
  -d "sender=6281234567890&message=halo&name=TestCustomer"

# Response yang diharapkan:
# { "success": true, "greeted": true, "phone": "6281234567890" }
```

---

*Root cause ditemukan dari perbandingan kode `lib/fonnte.ts` dengan contoh resmi di docs.fonnte.com yang selalu menggunakan FormData, bukan JSON body.*
