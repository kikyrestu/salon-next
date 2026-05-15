# 🔍 Laporan Audit Frontend — Salon POS (salon-next)

> **Scope:** Frontend-only audit — semua file `.tsx` di bawah `app/[slug]/(frontend)/`, `app/[slug]/(auth)/`, dan `components/`.
> **Tujuan:** Menemukan bug aktif, error logika, dan cacat alur UX sebelum berdampak ke operasional.

---

## Ringkasan Eksekutif

Dari hasil pembacaan menyeluruh seluruh file frontend, ditemukan **20 temuan** yang dikategorikan ke dalam empat tingkat keparahan. Temuan paling kritis berpusat pada **tiga area utama**: halaman POS (transaksi inti), halaman Appointments, dan konsistensi pengiriman header multi-tenant (`x-store-slug`) di berbagai halaman. Beberapa bug bisa menyebabkan data keuangan ganda atau salah hitung komisi secara diam-diam tanpa pesan error apapun ke pengguna.

| Tingkat | Jumlah | Dampak |
|---|---|---|
| 🔴 Kritis | 4 | Data keuangan/transaksi rusak |
| 🟠 Tinggi | 5 | Fungsi utama terganggu |
| 🟡 Sedang | 7 | UX flow terputus |
| 🔵 Rendah | 4 | Polish & konsistensi |

---

## 🔴 Bug KRITIS

### BUG-01 — POS: Appointment Status Di-update Dua Kali Setelah Checkout

**File:** `app/[slug]/(frontend)/pos/page.tsx`
**Baris:** 2034 dan 2110

**Narasi:**

Ketika kasir menyelesaikan transaksi yang berasal dari sebuah *appointment* (via `?appointmentId=...`), fungsi `handleCheckout` memanggil API `PUT /api/appointments/{id}` dengan status `"completed"` **dua kali secara berurutan** dalam satu eksekusi checkout yang sama.

Pemanggilan pertama terjadi tepat setelah invoice berhasil dibuat di server. Pemanggilan kedua terjadi lagi setelah proses pembuatan deposit selesai — keduanya dalam blok `if (data.success)` yang sama, dipisahkan oleh kode deposit. Komentar di atas pemanggilan pertama bertuliskan `"Auto-complete appointment if we have an appointmentId"` dan komentar di atas pemanggilan kedua berbunyi `"Auto-complete appointment if checkout was initiated from a booking"` — keduanya melakukan hal yang persis sama.

```typescript
// Panggilan PERTAMA (baris ~2034)
if (appointmentId) {
  await fetch(`/api/appointments/${appointmentId}`, {
    method: "PUT",
    body: JSON.stringify({ status: "completed" }),
  });
}

// ... kode deposit di sini ...

// Panggilan KEDUA (baris ~2110) — DUPLIKAT!
if (appointmentId) {
  await fetch(`/api/appointments/${appointmentId}`, {
    method: "PUT",
    body: JSON.stringify({ status: "completed" }),
  });
}
```

**Dampak:** Setiap checkout dari appointment mengirim 2 request PUT ke API. Selain pemborosan resource, jika backend mencatat riwayat status (activity log), record `"completed"` akan muncul dua kali untuk appointment yang sama — mengacaukan audit trail dan laporan aktivitas.

**Perbaikan:** Hapus salah satu dari dua blok `if (appointmentId)` tersebut. Pertahankan hanya pemanggilan terakhir (setelah semua proses deposit selesai) agar urutan operasi lebih terjamin.

---

### BUG-02 — POS: Kalkulasi Referral Discount Selalu Menyimpan Nilai Mentah, Bukan Nominal Diskon

**File:** `app/[slug]/(frontend)/pos/page.tsx`
**Baris:** 436–444

**Narasi:**

Fungsi `applyReferralCode` menyimpan nilai `discountAmount` ke state `referralValidated` menggunakan ternary operator yang kedua cabangnya mengembalikan **nilai yang identik**:

```typescript
const amt =
  settings.referralDiscountType === "percentage"
    ? (settings.referralDiscountValue || 0)   // Branch 1 → misal: 10
    : (settings.referralDiscountValue || 0);   // Branch 2 → misal: 10  ← SAMA PERSIS

setReferralValidated({
  referrerName: referrer.name,
  discountAmount: amt,  // Selalu menyimpan raw value, bukan nominal currency
});
```

Ternary ini sepenuhnya tidak berguna — tidak ada perbedaan logika antara tipe `"percentage"` dan `"fixed"`. Jika tipe diskon adalah `"percentage"` dengan nilai `10`, maka `amt` = 10, yang berarti UI menampilkan konfirmasi diskon `10` (seperti nominal currency Rp10), padahal yang dimaksud adalah 10%.

Komputasi yang benar memang terjadi kemudian di `calculateTotal()`, tapi nilai yang ditampilkan di UI konfirmasi referral (kalimat *"Diskon otomatis 10%"* atau *"Diskon otomatis Rp10"*) bergantung pada `settings.referralDiscountType` langsung, bukan dari `referralValidated.discountAmount`. Ini berarti `discountAmount` yang tersimpan di state tidak pernah merepresentasikan nilai sebenarnya yang akan didiskon — hanya raw setting value. Jika ada kode yang membutuhkan nilai pre-calculated ini di masa depan, akan langsung salah.

**Dampak:** State `referralValidated.discountAmount` menyimpan data yang tidak akurat. Untuk tipe `"percentage"`, properti ini menyimpan angka persentase (misal `10`) bukan nominal diskon (misal `Rp50.000`). Ini menyesatkan untuk maintenance dan rentan salah hitung jika ada fitur baru yang menggunakan nilai ini.

**Perbaikan:** Perbaiki ternary untuk benar-benar menghitung nilai yang berbeda:
```typescript
const amt =
  settings.referralDiscountType === "percentage"
    ? `${settings.referralDiscountValue}% dari total`
    : settings.referralDiscountValue || 0;
```
Atau lebih baik, simpan hanya `referralDiscountType` dan `referralDiscountValue` di state, lalu komputasi nominalnya selalu di `calculateTotal()`.

---

### BUG-03 — Invoice Print: API Deposits Tidak Mengirim Header `x-store-slug`

**File:** `app/[slug]/(frontend)/invoices/print/[id]/page.tsx`
**Baris:** ~30

**Narasi:**

Halaman cetak invoice melakukan 3 request API sekaligus menggunakan `Promise.all`. Dua di antaranya menyertakan header tenant store dengan benar, namun **request ketiga (deposits) tidak menyertakan header tersebut sama sekali**:

```typescript
const [invRes, settingsRes, depositsRes] = await Promise.all([
  fetch(`/api/invoices/${id}`, { headers: { "x-store-slug": slug } }),    // ✅ Ada header
  fetch("/api/settings",       { headers: { "x-store-slug": slug } }),    // ✅ Ada header
  fetch(`/api/deposits?invoiceId=${id}`)                                  // ❌ TIDAK ADA header!
]);
```

**Dampak:** Pada sistem multi-tenant (multi-cabang), ketiadaan header `x-store-slug` menyebabkan API deposit merespons dengan data dari store default, bukan store yang sedang aktif. Hasilnya, struk cetak yang diterima kasir bisa menampilkan data deposit yang **salah** atau **kosong** — kasir melihat pembayaran customer tidak tercatat padahal sudah dibayar, atau melihat deposit dari customer di cabang lain.

**Perbaikan:**
```typescript
fetch(`/api/deposits?invoiceId=${id}`, { headers: { "x-store-slug": slug } })
```

---

### BUG-04 — POS: `max` Loyalty Points di Input Number Menggunakan Satuan yang Salah

**File:** `app/[slug]/(frontend)/pos/page.tsx`
**Baris:** ~3165–3172

**Narasi:**

Input number untuk redemption loyalty points memiliki handler `onChange` yang membatasi nilai yang dapat diinput. Namun batas atas yang digunakan adalah **`payableSubtotal`** (nilai dalam satuan mata uang, misal Rp750.000) alih-alih jumlah **poin maksimal** yang setara:

```typescript
onChange={(e) => {
  const val = parseInt(e.target.value) || 0;
  setLoyaltyPointsToRedeem(
    Math.min(
      val,
      customerLoyaltyPoints,
      payableSubtotal,          // ❌ INI SATUAN RUPIAH, bukan poin!
    ),
  );
}}
```

Misalnya, jika `payableSubtotal = 750000` dan nilai 1 poin = Rp1.000, maka customer yang memiliki 2.000 poin seharusnya bisa redeem maksimal 750 poin (karena 750 × 1.000 = Rp750.000 = subtotal). Namun kode ini mengizinkan input hingga 750.000 poin — nilai yang jauh melampaui yang dimiliki customer. Batas atas yang benar adalah `Math.ceil(payableSubtotal / loyaltyPointValue)`.

Menariknya, batas yang **benar** sudah ada di atribut `max` dari elemen `<input>` itu sendiri:
```typescript
max={Math.min(customerLoyaltyPoints, Math.ceil(payableSubtotal / (settings.loyaltyPointValue || 1)))}
```

Tapi atribut `max` hanya membatasi input via spinner browser — user yang mengetik langsung masih bisa memasukkan angka berapa pun. Hanya `onChange` handler yang efektif membatasi nilai yang tersimpan di state.

**Dampak:** Kasir bisa secara tidak sengaja (atau sengaja) mengisi jumlah poin yang tidak masuk akal (misalnya `999999`). Nilai ini kemudian dikirim ke backend saat checkout. Meski backend mungkin punya validasi tersendiri, UI tidak memberikan *feedback* yang benar dan bisa membingungkan kasir.

**Perbaikan:**
```typescript
setLoyaltyPointsToRedeem(
  Math.min(
    val,
    customerLoyaltyPoints,
    Math.ceil(payableSubtotal / (settings.loyaltyPointValue || 1)), // ✅ Satuan poin
  ),
);
```

---

## 🟠 Bug TINGGI

### BUG-05 — Appointments: Kalkulasi Komisi Mengabaikan Tipe Komisi

**File:** `app/[slug]/(frontend)/appointments/page.tsx`
**Baris:** 304–308

**Narasi:**

Saat membuat atau mengedit appointment, fungsi `handleSubmit` menghitung total komisi untuk semua service yang dipilih. Namun kalkulasinya hanya mengambil nilai mentah `commissionValue` **tanpa memperhatikan `commissionType`** (apakah `"percentage"` atau `"fixed"`):

```typescript
// SALAH: Selalu menambah raw value tanpa memeriksa tipe
let commission = 0;
selectedServices.forEach((svc) => {
  const commValue = Number(svc.commissionValue || 0);
  commission += commValue; // Untuk "percentage", ini akan menjumlahkan angka %, bukan nominalnya!
});
```

Seharusnya:
```typescript
selectedServices.forEach((svc) => {
  if (svc.commissionType === "percentage") {
    commission += svc.price * (Number(svc.commissionValue || 0) / 100);
  } else {
    commission += Number(svc.commissionValue || 0);
  }
});
```

**Dampak:** Untuk service dengan komisi bertipe persentase (misal: 10%), nilai yang tersimpan di appointment adalah `10` (angka persentase) bukan `Rp25.000` (nominal aktual). Data komisi di tabel appointment menjadi tidak bisa dibandingkan antar appointment, dan laporan komisi yang bersumber dari data appointment akan **salah secara finansial**.

---

### BUG-06 — Expenses Page: Fetch Data GET Tidak Menyertakan Header Store

**File:** `app/[slug]/(frontend)/expenses/page.tsx`
**Baris:** 83

**Narasi:**

Fungsi `fetchExpenses` pada halaman Expenses menggunakan fetch tanpa header tenant untuk request GET:

```typescript
const res = await fetch(`/api/expenses?${query.toString()}`);  // ❌ Tanpa x-store-slug
```

Kontras dengan operasi lainnya di file yang sama (POST, PUT, DELETE) yang semuanya sudah menyertakan `{ headers: { "x-store-slug": slug } }`. Ini adalah *oversight* yang konsisten: GET dilupakan, write operations sudah benar.

**Dampak:** Di lingkungan multi-cabang, halaman Expenses akan menampilkan pengeluaran dari store **default** (atau store manapun yang direspons server saat tidak ada slug), bukan cabang yang sedang dibuka. Kasir akan melihat data pengeluaran cabang lain atau data kosong.

---

### BUG-07 — Payroll Page: Tiga API Call Tidak Menyertakan Header Store

**File:** `app/[slug]/(frontend)/payroll/page.tsx`
**Baris:** 90, 91, 117

**Narasi:**

Masalah serupa dengan BUG-06, namun lebih luas cakupannya. Halaman Payroll memiliki tiga fetch yang kehilangan header tenant:

```typescript
// fetchData — GET list payroll dan staff
fetch(`/api/payroll?${queryParams.toString()}`),      // ❌
fetch("/api/staff/payroll-list")                       // ❌

// handleGeneratePayroll — POST generate payroll
const res = await fetch("/api/payroll", {
  method: "POST",
  headers: { "Content-Type": "application/json" },    // ❌ Tidak ada x-store-slug!
  body: JSON.stringify({ staffId, month, year })
});
```

Operasi **generate payroll** adalah yang paling kritis karena ia membuat record baru. Jika slug tidak dikirim, payroll mungkin dibuat di store yang salah.

**Dampak:** Data payroll yang ditampilkan berasal dari store salah, dan jika generate payroll dieksekusi, record payroll mungkin tersimpan di cabang yang tidak sesuai.

---

### BUG-08 — Invoice Print: `useParams()` Dipanggil Dua Kali

**File:** `app/[slug]/(frontend)/invoices/print/[id]/page.tsx`

**Narasi:**

Di bagian atas komponen `PrintInvoicePage`, hook `useParams()` dipanggil **dua kali** dengan variabel yang berbeda:

```typescript
// Pemanggilan PERTAMA
const params = useParams();
const slug = params.slug as string;

// ... lanjutan komponen ...

// Pemanggilan KEDUA — di blok berbeda
const { id } = useParams();
```

Menurut aturan React Hooks, hooks boleh dipanggil beberapa kali asalkan dari level yang sama. Namun ini adalah anti-pattern yang membuat kode tidak efisien dan membingungkan. Lebih buruk lagi, `slug` dan `id` bisa diambil dari satu pemanggilan yang sama:

```typescript
const { slug, id } = useParams();
```

Ini mengindikasikan komponen ditulis/diedit oleh dua orang berbeda atau ada copy-paste yang tidak dibersihkan.

---

### BUG-09 — Appointments: `fetchResources` Tidak Memiliki Error Handling

**File:** `app/[slug]/(frontend)/appointments/page.tsx`
**Baris:** 152–168

**Narasi:**

Fungsi `fetchResources` yang dipanggil saat halaman pertama dimuat tidak menggunakan `try/catch`:

```typescript
const fetchResources = async () => {
  const [staffRes, serviceRes, customerRes] = await Promise.all([
    fetch("/api/staff/appointment-list", { headers }),
    fetch("/api/services?limit=0", { headers }),
    fetch("/api/customers?limit=0", { headers }),
  ]);
  const staffData = await staffRes.json();
  const serviceData = await serviceRes.json();
  const customerData = await customerRes.json();
  // Tidak ada try/catch!
```

Jika salah satu dari tiga request ini gagal (server error 500, timeout, atau response bukan JSON valid), JavaScript akan melempar exception yang tidak tertangkap dan komponen akan **crash total** — menampilkan blank page atau error boundary yang tidak informatif kepada user.

**Dampak:** Kasir yang membuka halaman Appointments saat server sedang bermasalah sementara tidak mendapat feedback apapun yang berguna. Bandingkan dengan `fetchResources` di POS yang sudah menggunakan `safeJson` wrapper dan menampilkan toast warning.

---

## 🟡 Bug SEDANG / UX Flow Cacat

### BUG-10 — POS: Harga Item di Katalog Tidak Diformat (Tanpa Pemisah Ribuan)

**File:** `app/[slug]/(frontend)/pos/page.tsx`
**Baris:** 2383

**Narasi:**

Di grid katalog produk/service, harga ditampilkan menggunakan nilai raw dari JavaScript:

```jsx
<p className="text-blue-900 font-bold text-xs lg:text-sm">
  {settings.symbol}
  {item.price}   {/* ❌ Tanpa toLocaleString */}
</p>
```

Sementara di cart (panel kanan), harga yang sama sudah diformat dengan benar:
```jsx
{settings.symbol}{item.price.toLocaleString("id-ID")}  {/* ✅ Sudah benar di cart */}
```

**Dampak:** Item dengan harga `75000` akan tampil sebagai `Rp75000` di katalog, bukan `Rp75.000`. Untuk harga yang lebih besar seperti `1500000`, ini tampil sebagai `Rp1500000` yang sangat sulit dibaca. Kasir yang membaca harga dari katalog — terutama saat melayani customer — rentan salah baca nominal.

---

### BUG-11 — POS: State `discountType` dan `discountReason` Tidak Di-reset Setelah Checkout Sukses

**File:** `app/[slug]/(frontend)/pos/page.tsx`
**Baris:** ~2118–2133

**Narasi:**

Setelah invoice berhasil dibuat, `handleCheckout` melakukan serangkaian reset state:

```typescript
setCart([]);
setDiscount(0);
setStaffTips({});
setSelectedCustomer("");
// ... berbagai state lain di-reset ...
setLoyaltyPointsToRedeem(0);
setCustomerLoyaltyPoints(0);
setReferralCode("");
// ❌ setDiscountReason("") TIDAK dipanggil!
// ❌ setDiscountType("percentage") TIDAK dipanggil!
```

`discountReason` dan `discountType` tidak pernah di-reset pada path checkout normal. (Catatan: `setDiscountReason("")` sudah ada di path package checkout, tapi tidak di path invoice biasa.)

**Dampak:** Untuk `discountReason`: karena `discount` di-reset ke `0`, field alasan diskon tidak terlihat di UI transaksi berikutnya (hanya muncul saat `discount > 0`). Nilai lama tersimpan di state tapi tersembunyi. Jika kasir memasukkan diskon baru di transaksi berikutnya, kolom alasan akan langsung terisi teks lama dari transaksi sebelumnya — membingungkan dan berpotensi kirim data yang salah ke backend.

Untuk `discountType`: type terakhir yang dipilih (nominal/persentase) akan bertahan ke transaksi berikutnya. Kasir yang terbiasa diskon nominal mungkin terkejut melihat diskon yang dia masukkan dihitung sebagai persentase.

---

### BUG-12 — Appointments: Slot Waktu Tidak Di-refresh Saat Services Berubah

**File:** `app/[slug]/(frontend)/appointments/page.tsx`
**Baris:** ~126–131

**Narasi:**

`useEffect` yang memanggil `fetchAvailableSlots` hanya memiliki dependency pada `[formData.staffId, formData.date, isModalOpen]`:

```typescript
useEffect(() => {
  if (formData.staffId && formData.date && isModalOpen) {
    fetchAvailableSlots();
  } else {
    setAvailableSlots([]);
  }
}, [formData.staffId, formData.date, isModalOpen]);  // ❌ serviceIds tidak di sini!
```

Ketika user menambah atau mengganti service di form appointment, total durasi appointment berubah. Slot yang valid berubah karena end-time menjadi berbeda. Namun karena `formData.serviceIds` tidak ada di dependency array, slots tidak di-refresh.

**Dampak:** User bisa memilih slot jam 15:00 untuk service A (30 menit → selesai 15:30), lalu mengganti ke service B (90 menit → selesai 16:30). Slot yang ditampilkan masih berdasarkan service A. User memesan slot yang akan mengakibatkan konflik jadwal staff tanpa sadar.

---

### BUG-13 — Appointments: Double Fetch Saat Search Berubah

**File:** `app/[slug]/(frontend)/appointments/page.tsx`
**Baris:** ~119, 133

**Narasi:**

Ada dua `useEffect` yang keduanya bisa memanggil `fetchAppointments`:

```typescript
// Effect 1: Mendengarkan perubahan page, filter, dan tanggal
useEffect(() => {
  fetchAppointments();
}, [page, statusFilter, startDate, endDate]);

// Effect 2: Debounce search dengan timer 500ms, kemudian setPage(1)
useEffect(() => {
  const timer = setTimeout(() => {
    setPage(1);           // ← Mengubah 'page', memicu Effect 1
    fetchAppointments();  // ← Juga langsung memanggil
  }, 500);
  return () => clearTimeout(timer);
}, [searchTerm]);
```

Ketika `searchTerm` berubah, Effect 2 akan (setelah 500ms) memanggil `fetchAppointments()` langsung **dan** juga memanggil `setPage(1)` yang kemudian memicu Effect 1 untuk memanggil `fetchAppointments()` lagi.

**Dampak:** Setiap perubahan teks pencarian menghasilkan **dua request** ke backend secara berurutan. Request pertama dikirim dengan nilai `page` yang mungkin masih lama, request kedua dengan `page=1`. Ini menyebabkan UI berpotensi menampilkan data yang salah sesaat (hasil dari request pertama) sebelum dioverwrite oleh hasil request kedua yang benar.

---

### BUG-14 — Login: "Remember Me" Checkbox Tidak Berfungsi

**File:** `app/[slug]/(auth)/login/page.tsx`

**Narasi:**

Halaman login menampilkan checkbox "Remember me" dengan tampilan lengkap, namun checkbox ini tidak memiliki `checked` state binding maupun `onChange` handler:

```jsx
<input
  type="checkbox"
  className="w-4 h-4 rounded border-2 ..."
  // ❌ Tidak ada: checked={rememberMe}
  // ❌ Tidak ada: onChange={(e) => setRememberMe(e.target.checked)}
/>
```

Checkbox ini sepenuhnya adalah UI dekorasi — mengkliknya tidak melakukan apapun. Nilai dari checkbox tidak pernah dikirim ke `signIn()` ataupun disimpan ke `localStorage`/cookies untuk memperpanjang session.

**Dampak:** Pengguna yang mencentang "Remember me" dengan harapan tidak perlu login ulang akan kecewa — sesi tetap berakhir seperti biasa. Ini menciptakan ekspektasi yang tidak terpenuhi (false affordance).

---

### BUG-15 — Login: Fungsi Demo Credentials Tertinggal di Kode Produksi

**File:** `app/[slug]/(auth)/login/page.tsx`

**Narasi:**

Ada fungsi `fillDemoCredentials` yang mendefinisikan hard-coded credentials:

```typescript
const fillDemoCredentials = () => {
  setEmail('admin@example.com');
  setPassword('Admin123!');
};
```

Fungsi ini didefinisikan tapi tidak dipanggil dari UI manapun (tidak ada tombol yang menghubungkannya). Namun keberadaannya di bundle JavaScript final tetap mengekspos credential default yang bisa dibaca siapapun melalui DevTools browser.

**Dampak:** Jika admin tidak mengubah default password saat setup awal, credential ini bisa digunakan untuk masuk ke sistem. Ini juga menandakan sisa kode development yang belum dibersihkan sebelum deployment.

---

### BUG-16 — Cash Drawer: Histori Log Dibatasi 20 Item Tanpa Paginasi

**File:** `app/[slug]/(frontend)/cash-drawer/page.tsx`
**Baris:** ~51

**Narasi:**

Request untuk mengambil log pergerakan kas di-hardcode dengan limit 20:

```typescript
const logsRes = await fetch('/api/cash-drawer/logs?limit=20', { headers: ... });
```

Tidak ada mekanisme pagination, tombol "Load More", atau filter tanggal. Jika salon beroperasi dengan volume transaksi tinggi, histori yang lebih lama dari 20 entri tidak bisa diakses sama sekali dari halaman ini.

**Dampak:** Supervisor yang ingin memverifikasi pergerakan kas dari kemarin atau minggu lalu tidak bisa melakukannya. Audit trail jadi praktis tidak berguna untuk pemeriksaan retrospektif.

---

## 🔵 Bug RENDAH / Masalah Konsistensi

### BUG-17 — Dashboard: Typo "Todays Revenue" (Missing Apostrophe)

**File:** `app/[slug]/(frontend)/dashboard/page.tsx`

**Narasi:**

StatCard di dashboard bertuliskan `title="Todays Revenue"` yang seharusnya adalah `"Today's Revenue"`. Ini adalah typo yang langsung terlihat di tampilan utama yang dibuka setiap hari oleh setiap pengguna.

---

### BUG-18 — POS: Bahasa Pesan Error Tidak Konsisten (Campur Indonesia & Inggris)

**File:** `app/[slug]/(frontend)/pos/page.tsx`

**Narasi:**

Di halaman POS yang merupakan antarmuka utama kasir, pesan-pesan `alert()` menggunakan dua bahasa secara tidak konsisten:

**Bahasa Indonesia:**
- `"Masukkan nominal top-up yang valid"`
- `"Pilih customer terdaftar untuk top-up wallet"`
- `"Peringatan: Kode Referral hanya berlaku jika pemiliknya adalah member VIP aktif!"`

**Bahasa Inggris:**
- `"Please select a customer"`
- `"Cart is empty"`
- `"Please assign at least 1 staff for service \"${item.name}\""`
- `"Insufficient quota for service \"${item.name}\""`

Inkonsistensi ini mengganggu pengalaman kasir yang mayoritas beroperasi dalam konteks Indonesia. Pesan error yang tiba-tiba dalam bahasa Inggris bisa membuat kasir kurang familiar dengan instruksi yang harus diikuti.

---

### BUG-19 — Cash Drawer: Tidak Ada Validasi Source ≠ Destination pada Transfer

**File:** `app/[slug]/(frontend)/cash-drawer/page.tsx`

**Narasi:**

Modal transfer uang memungkinkan user memilih `transferSource` dan `transferDestination` yang bisa bernilai sama (misal: "kasir" → "kasir"). Tidak ada validasi di frontend yang mencegah ini, sehingga user harus menunggu respon error dari API backend.

**Dampak:** UX yang kurang informatif — lebih baik menonaktifkan opsi yang tidak valid secara real-time (misal: jika source dipilih "kasir", hapus "kasir" dari opsi destination).

---

### BUG-20 — Halaman Expenses: Kategori Hardcoded dalam Bahasa Inggris

**File:** `app/[slug]/(frontend)/expenses/page.tsx`

**Narasi:**

Kategori pengeluaran didefinisikan secara hardcoded dalam bahasa Inggris:

```typescript
const EXPENSE_CATEGORIES = [
  "Rent", "Utilities", "Salaries", "Supplies",
  "Marketing", "Maintenance", "Transportation", "Other"
];
```

Sementara seluruh antarmuka halaman Expenses, nama field, dan tombol lainnya sudah dalam bahasa Indonesia atau bilingual. Dropdown kategori ini akan menampilkan opsi seperti "Rent" dan "Utilities" di tengah UI berbahasa Indonesia.

---

## Matriks Prioritas Perbaikan

| ID | Halaman | Isu | Tingkat | Effort Fix |
|----|---------|-----|---------|------------|
| BUG-01 | POS | Duplicate appointment update | 🔴 Kritis | Rendah — hapus 1 blok kode |
| BUG-02 | POS | Referral discount menyimpan nilai salah | 🔴 Kritis | Sedang |
| BUG-03 | Invoice Print | Deposits fetch tanpa store header | 🔴 Kritis | Rendah — tambah 1 header |
| BUG-04 | POS | Loyalty max menggunakan satuan salah | 🔴 Kritis | Rendah — ganti 1 baris |
| BUG-05 | Appointments | Komisi tidak mempertimbangkan tipe | 🟠 Tinggi | Sedang |
| BUG-06 | Expenses | GET fetch tanpa store header | 🟠 Tinggi | Rendah |
| BUG-07 | Payroll | 3 fetch tanpa store header | 🟠 Tinggi | Rendah |
| BUG-08 | Invoice Print | `useParams()` dipanggil 2x | 🟠 Tinggi | Rendah |
| BUG-09 | Appointments | fetchResources tanpa try/catch | 🟠 Tinggi | Rendah |
| BUG-10 | POS | Harga katalog tidak diformat | 🟡 Sedang | Rendah |
| BUG-11 | POS | discountType/Reason tidak di-reset | 🟡 Sedang | Rendah |
| BUG-12 | Appointments | Slot tidak refresh saat service berubah | 🟡 Sedang | Rendah |
| BUG-13 | Appointments | Double fetch pada search | 🟡 Sedang | Sedang |
| BUG-14 | Login | Remember Me tidak berfungsi | 🟡 Sedang | Sedang |
| BUG-15 | Login | Demo credentials di production code | 🟡 Sedang | Rendah |
| BUG-16 | Cash Drawer | Log tanpa paginasi | 🟡 Sedang | Sedang |
| BUG-17 | Dashboard | Typo "Todays Revenue" | 🔵 Rendah | Sangat Rendah |
| BUG-18 | POS | Campur bahasa di pesan error | 🔵 Rendah | Sedang |
| BUG-19 | Cash Drawer | Transfer source = destination | 🔵 Rendah | Rendah |
| BUG-20 | Expenses | Kategori hardcoded bahasa Inggris | 🔵 Rendah | Rendah |

---

## Rekomendasi Strategis

### 1. Quick Wins (dapat diselesaikan dalam 1–2 jam)
BUG-01, BUG-03, BUG-04, BUG-06, BUG-07, BUG-09, BUG-10, BUG-11, BUG-17, BUG-19 — semuanya adalah perubahan 1–5 baris. Lakukan dalam satu sesi.

### 2. Audit Menyeluruh Header Multi-tenant
BUG-03, BUG-06, BUG-07 adalah satu pola yang sama: fetch GET yang lupa menyertakan `x-store-slug`. Rekomendasikan membuat utility function terpusat:
```typescript
// lib/tenantFetch.ts
export const tenantFetch = (url: string, slug: string, options?: RequestInit) =>
  fetch(url, { ...options, headers: { "x-store-slug": slug, ...options?.headers } });
```
Lalu lakukan audit menyeluruh pada **semua** `fetch()` di seluruh halaman frontend untuk memastikan tidak ada lagi yang ketinggalan.

### 3. Standardisasi Bahasa UI
Tetapkan satu bahasa (Indonesia) untuk semua pesan error, label, dan kategori yang user-facing. Buat file konstanta terpusat untuk pesan error dan kategori agar mudah dikelola.

### 4. State Reset Helper
Buat fungsi `resetCheckoutState()` yang memanggil semua `set*` yang perlu di-reset setelah checkout, untuk menghindari situasi seperti BUG-11 di mana sebagian state tertinggal.

---

*Laporan ini dibuat berdasarkan analisis statis kode sumber. Pengujian runtime dan end-to-end testing tetap direkomendasikan untuk memverifikasi dampak aktual dari setiap temuan di atas.*
