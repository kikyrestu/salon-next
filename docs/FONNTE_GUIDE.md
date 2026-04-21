# Fonnte WA Integration Guide

> This project uses Fonnte as the WhatsApp gateway for automated notifications.
> Before adding any new WA notification, read this guide fully.

---

## How Fonnte Works

Fonnte sends WhatsApp messages via their API using your connected WA device (phone number).

### Base Endpoint
```
POST https://api.fonnte.com/send
```

### Headers
```
Authorization: YOUR_FONNTE_TOKEN
Content-Type: application/json
```

### Payload
```json
{
  "target": "628xxxxxxxxxx",   // recipient WA number, country code format
  "message": "Hello Kak {{name}}, ...",
  "countryCode": "62"          // Indonesia
}
```

---

## How It's Used in This Project

> ⚠️ Before sending any new notification, check the existing Fonnte utility/helper in the codebase.
> There should already be a wrapper function — use it, do not create a new one.

Look for files like:
```
/lib/fonnte.js
/utils/whatsapp.js
/services/notification.js
```

Use the existing function. Example pattern:
```js
await sendWANotification({
  phone: customer.phone,
  message: `Halo Kak ${customer.name}, ...`
})
```

---

## Notification Types to Implement

### 1. Low Stock Product Alert (Module 6)

**Trigger**: When a product's stock drops to or below `lowStockThreshold` after a POS transaction is completed

**Recipient**: Admin/owner phone number (from system settings)

**Message template**:
```
⚠️ Stok Hampir Habis

Produk: {productName}
Stok saat ini: {currentStock} {unit}
Batas minimum: {threshold} {unit}

Segera lakukan restok.
```

**Important**: Only fire once per threshold crossing.
Reset `lowStockNotified` to `false` when admin restocks the product above threshold.

---

### 2. Appointment Reminder (existing — do not modify)

Already handled by previous developer. Do not touch.

---

### 3. Customer WA Notification (Module 5)

**Trigger**: Various (appointment confirmation, promo, etc.)

**Pre-condition**: ALWAYS check `customer.waNotificationEnabled === true` before sending.
If opt-in is false, skip the notification silently.

```js
if (!customer.waNotificationEnabled) return; // skip
await sendWANotification({ phone: customer.phone, message: '...' })
```

---

## Rules

- ❌ Never hardcode the Fonnte token — read from environment variable (`process.env.FONNTE_TOKEN`)
- ❌ Never send WA to a customer who has `waNotificationEnabled: false`
- ❌ Never block the main process waiting for WA response — use async/fire-and-forget or queue
- ✅ Wrap all Fonnte calls in try/catch — a failed WA must not fail the main transaction
- ✅ Log failed WA attempts (console.error or logging service)
- ✅ Always format phone numbers to Indonesian format: `628xxxxxxxxxx`

---

## Phone Number Formatter

```js
function formatPhone(phone) {
  // Remove non-digits
  let cleaned = phone.replace(/\D/g, '')
  // Replace leading 0 with 62
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1)
  }
  // Add 62 if not present
  if (!cleaned.startsWith('62')) {
    cleaned = '62' + cleaned
  }
  return cleaned
}
```

---

## Environment Variables

```env
FONNTE_TOKEN=your_token_here
ADMIN_WA_NUMBER=628xxxxxxxxxx   # for system notifications like low stock
```
