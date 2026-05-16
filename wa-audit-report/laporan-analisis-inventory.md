# Laporan Analisis: Modul Inventory — Salon Next

**Tanggal Analisis:** 15 Mei 2026  
**Scope:** Modul Inventory dan modul yang berelasi — Products, Purchases, Suppliers, Usage Logs, Stock Alert  
**Dibuat untuk:** Klien (Non-IT)

---

## Pendahuluan

Dokumen ini merangkum hasil analisis mendalam terhadap kode sumber aplikasi Salon Next, khusus pada bagian yang mengelola **stok barang (inventory)**. Analisis mencakup empat area utama:

1. **Products** — halaman daftar dan kelola produk/barang
2. **Purchase Orders** — pembelian barang dari supplier
3. **Suppliers** — data pemasok/supplier
4. **Usage Logs** — pencatatan pemakaian barang internal
5. **Stock Alert** — notifikasi WhatsApp saat stok menipis

Setiap temuan dijelaskan dengan bahasa sederhana: **apa masalahnya**, **dampaknya bagi bisnis**, dan **solusi yang direkomendasikan**.

---

## Ringkasan Eksekutif

Dari hasil analisis, ditemukan **9 temuan** yang terbagi dalam tiga tingkat keparahan:

| Tingkat | Jumlah | Keterangan |
|--------|--------|------------|
| 🔴 **Kritis** | 3 | Bisa menyebabkan data rusak atau hilang |
| 🟡 **Menengah** | 4 | Alur kerja tidak lengkap / data bisa tidak akurat |
| 🟢 **Minor** | 2 | Pengalaman pengguna kurang optimal |

---

## TEMUAN KRITIS 🔴

---

### BUG-01 — Tidak Ada Fitur Edit Purchase Order

**Di mana:** Halaman Purchase Orders → Detail Pembelian

**Apa yang terjadi:**

Saat ini, sebuah Purchase Order (PO) yang sudah dibuat **tidak bisa diedit**. Sistem hanya menyediakan dua aksi: *Lihat Detail* dan *Hapus*. Tidak ada tombol atau fungsi "Edit" sama sekali pada level API maupun tampilan.

Ini berarti jika staf salah memasukkan jumlah barang, harga, atau supplier, satu-satunya pilihan adalah **menghapus PO tersebut dan membuatnya ulang dari awal**.

**Dampak bisnis:**

- Jika PO statusnya sudah "Received" (barang sudah diterima dan stok sudah bertambah), menghapus PO akan **otomatis mengurangi kembali stok** barang-barang tersebut. Ini sangat berisiko karena stok bisa menjadi negatif atau tidak akurat.
- Proses koreksi menjadi panjang dan rawan kesalahan manusia.
- Staf tidak bisa melakukan perubahan kecil (misalnya mengubah catatan atau metode pembayaran) tanpa menghapus seluruh record.

**Solusi yang Direkomendasikan:**

Buat endpoint API baru `PUT /api/purchases/[id]` beserta halaman edit. Halaman edit harus memiliki logika khusus: jika status PO berubah dari "Pending" menjadi "Received", sistem harus menambah stok; jika sebaliknya, stok harus dikurangi. Perubahan pada item (jumlah/produk) juga harus menghitung selisih stok sebelum dan sesudah.

---

### BUG-02 — Stok Bisa Menjadi Negatif Saat Purchase Order Dihapus

**Di mana:** API `DELETE /api/purchases/[id]`

**Apa yang terjadi:**

Ketika sebuah PO dengan status "Received" dihapus, sistem akan **mengurangi stok** setiap produk sebesar jumlah yang ada di PO itu. Namun tidak ada pengecekan apakah stok saat ini cukup untuk dikurangi.

Artinya: jika stok produk A saat ini adalah 3 unit, lalu ada PO lama yang dihapus dengan item 5 unit produk A, maka stok produk A akan menjadi **-2** (minus dua). 

Bahkan komentar dalam kode sendiri mengakui hal ini:
> *"Note: We don't check for negative stock here because a purchase might be deleted for correction"*

Komentar ini menunjukkan pengembang sadar akan masalahnya namun belum memiliki solusi.

**Dampak bisnis:**

- Data stok menjadi tidak valid dan tidak bisa dipercaya.
- Laporan stok akan menampilkan angka negatif yang membingungkan.
- Sistem notifikasi stok rendah bisa menjadi kacau.

**Solusi yang Direkomendasikan:**

Sebelum mengurangi stok, sistem harus memeriksa apakah stok mencukupi. Jika tidak, tampilkan peringatan kepada pengguna dan minta konfirmasi eksplisit. Alternatifnya, blokir penghapusan PO yang sudah "Received" dan arahkan pengguna untuk membuat "Penyesuaian Stok" (stock adjustment) yang terpisah sebagai gantinya.

---

### BUG-03 — Potensi Duplikasi Nomor Purchase Order (Race Condition)

**Di mana:** API `POST /api/purchases` — saat membuat PO baru

**Apa yang terjadi:**

Nomor PO dibuat dengan cara: hitung total jumlah PO yang sudah ada, lalu tambahkan 1. Contoh: jika ada 99 PO, nomor berikutnya adalah `PUR-2026-00100`.

Masalahnya, proses ini **tidak aman jika dua permintaan dikirim bersamaan** (misalnya staf yang klik tombol dua kali, atau dua staf membuat PO di waktu yang hampir bersamaan). Kedua permintaan bisa mendapatkan hitungan yang sama, lalu keduanya mencoba membuat PO dengan nomor yang sama.

Karena nomor PO harus unik (ada aturan di database), salah satu permintaan akan **gagal dengan pesan error teknis** yang tidak ramah pengguna — atau dalam skenario buruk, salah satu data bisa hilang.

**Dampak bisnis:**

- Pengguna mendapat pesan error yang tidak jelas saat membuat PO.
- Potensi kehilangan data jika tidak ditangani dengan benar.
- Sangat mungkin terjadi di lingkungan salon yang sibuk.

**Solusi yang Direkomendasikan:**

Gunakan mekanisme *atomic counter* (penghitung yang aman untuk penggunaan bersamaan) menggunakan fitur `findOneAndUpdate` dengan `$inc` di MongoDB, atau gunakan model Counter yang kemungkinan sudah ada di proyek ini (`models/Counter.ts`). Ini memastikan setiap nomor PO dijamin unik meskipun dibuat secara bersamaan.

---

## TEMUAN MENENGAH 🟡

---

### BUG-04 — Header Toko (`x-store-slug`) Hilang di Beberapa Permintaan Data

**Di mana:** Beberapa halaman frontend

**Apa yang terjadi:**

Aplikasi ini dirancang untuk mendukung **multi-cabang** (multi-tenant). Setiap request ke server harus menyertakan header `x-store-slug` agar server tahu data cabang mana yang harus diambil. Jika header ini tidak ada, server akan **default ke "pusat"**.

Ditemukan beberapa fetch request yang **lupa menyertakan header ini**:

| Halaman | Request yang Bermasalah |
|--------|------------------------|
| Products (`/products`) | `GET /api/products` — saat load daftar produk |
| Products (`/products`) | `PUT /api/products/[id]` — saat update produk |
| Purchases List (`/purchases`) | `GET /api/purchases` — saat load daftar PO |
| Create Purchase (`/purchases/create`) | `GET /api/products/purchase-list` — saat load dropdown produk |
| Usage Logs (`/usage-logs`) | `GET /api/usage-logs` — saat load daftar log |
| Usage Logs (`/usage-logs`) | `POST /api/usage-logs` — saat simpan log baru |
| Usage Logs (`/usage-logs`) | `GET /api/staff/usage-list` — saat load dropdown staf |

**Dampak bisnis:**

- Untuk salon dengan **satu cabang saja**, ini **tidak terasa** karena default "pusat" adalah benar.
- Untuk salon dengan **beberapa cabang**, staf di cabang lain bisa **melihat atau memodifikasi data cabang "pusat"** tanpa disadari. Ini adalah **kebocoran data antar cabang**.
- Data usage log yang dicatat bisa masuk ke cabang yang salah.

**Solusi yang Direkomendasikan:**

Tambahkan `"x-store-slug": slug` di semua fetch request yang belum memilikinya. Idealnya, buat sebuah fungsi helper terpusat (misalnya `fetchWithSlug(url, options)`) yang secara otomatis menyertakan header ini, sehingga tidak ada yang terlewat.

---

### BUG-05 — Menghapus Supplier Tidak Memeriksa Purchase Order Terkait

**Di mana:** API `DELETE /api/suppliers/[id]`

**Apa yang terjadi:**

Ketika seorang supplier dihapus dari sistem, tidak ada pengecekan apakah supplier tersebut **masih memiliki riwayat Purchase Order**. Penghapusan langsung dilakukan tanpa peringatan apapun.

Akibatnya, semua PO yang terkait dengan supplier tersebut akan menampilkan **"Unknown"** atau data kosong pada kolom Supplier — karena data supplier-nya sudah tidak ada.

**Dampak bisnis:**

- Riwayat pembelian menjadi tidak lengkap dan tidak bisa dilacak.
- Laporan keuangan pembelian kehilangan informasi supplier.
- Tidak ada cara untuk mengetahui dari siapa barang-barang tersebut dibeli.

**Solusi yang Direkomendasikan:**

Sebelum menghapus supplier, sistem harus memeriksa apakah ada PO yang menggunakan supplier tersebut. Jika ada, tampilkan peringatan dan **blokir penghapusan** (atau tawarkan opsi "nonaktifkan saja" alih-alih hapus permanen). Ini jauh lebih aman dari segi integritas data.

---

### BUG-06 — Tidak Ada Fitur Edit Usage Log

**Di mana:** Halaman Usage Logs

**Apa yang terjadi:**

Mirip dengan Purchase Order, **Usage Log tidak bisa diedit** — hanya bisa dihapus. Jika staf salah mencatat jumlah pemakaian atau produk yang dipakai, satu-satunya cara adalah menghapus log tersebut (yang akan mengembalikan stok) lalu membuat log baru.

**Dampak bisnis:**

- Proses koreksi tidak efisien.
- Menghapus dan membuat ulang meninggalkan celah dalam audit trail — riwayat perubahan tidak tercatat.
- Staf yang tidak paham alur ini mungkin hanya menghapus tanpa membuat ulang, sehingga stok jadi tidak akurat.

**Solusi yang Direkomendasikan:**

Tambahkan endpoint `PUT /api/usage-logs/[id]` dan tombol Edit di halaman. Logika edit harus menghitung selisih antara kuantitas lama dan baru, lalu menyesuaikan stok secara tepat (tambah atau kurang stok sesuai perbedaan).

---

### BUG-07 — Field `category` Wajib di Database Tapi Tidak Divalidasi di API

**Di mana:** API `POST /api/products` — saat membuat produk baru

**Apa yang terjadi:**

Di definisi database (model Product), field `category` ditandai sebagai **wajib diisi** (`required: true`). Namun di kode validasi API yang memeriksa data sebelum disimpan, `category` **tidak ada dalam daftar field yang wajib**.

Daftar validasi saat ini hanya mewajibkan: `name`, `price`, `costPrice`, `stock`. Field `category` tidak termasuk.

Akibatnya, jika seseorang mengirim request pembuatan produk tanpa mengisi category (misalnya melalui API langsung), sistem akan menghasilkan **error teknis 500** yang tidak ramah — alih-alih pesan yang jelas seperti "Kategori harus diisi".

**Dampak bisnis:**

- Pengguna mendapat pesan error yang membingungkan.
- Jika ada integrasi dengan sistem lain (import produk, dll.) yang melewatkan field category, prosesnya akan gagal dengan pesan yang sulit dipahami.

**Solusi yang Direkomendasikan:**

Tambahkan `'category'` ke dalam daftar `required` di validasi API:
```
required: ['name', 'price', 'costPrice', 'stock', 'category']
```

---

## TEMUAN MINOR 🟢

---

### BUG-08 — Tidak Ada Fitur Ubah Status Purchase Order dari Pending ke Received

**Di mana:** Halaman Purchase Orders

**Apa yang terjadi:**

Saat membuat PO, pengguna bisa memilih status awal: "Pending" (untuk PO yang belum diterima barangnya) atau "Received" (barang langsung diterima). Namun tidak ada cara untuk **mengubah status dari Pending menjadi Received** setelah PO dibuat, karena fitur edit tidak ada (lihat BUG-01).

Ini berarti fitur status "Pending" tidak berguna secara praktis — pengguna tidak bisa mengonfirmasi penerimaan barang nanti, dan stok tidak akan terupdate.

**Dampak bisnis:**

- Alur kerja nyata salon tidak bisa dijalankan: "buat PO dulu, terima barang nanti, konfirmasi penerimaan".
- Pengguna terpaksa selalu memilih "Received" di awal, meskipun barang belum tiba.
- Stok bisa terupdate sebelum barang benar-benar ada di tangan.

**Solusi yang Direkomendasikan:**

Sebagai bagian dari penyelesaian BUG-01 (fitur edit PO), tambahkan tombol khusus **"Konfirmasi Penerimaan Barang"** di halaman detail PO yang statusnya masih Pending. Tombol ini akan mengubah status menjadi Received dan secara otomatis menambah stok semua produk dalam PO tersebut.

---

### BUG-09 — Deposit/Pembayaran PO Tidak Memiliki Pemeriksaan Izin (Permission)

**Di mana:** API `POST /api/purchases/deposits` dan `GET /api/purchases/deposits`

**Apa yang terjadi:**

Fitur "Tambah Deposit" (mencatat pembayaran sebagian untuk PO yang belum lunas) **tidak memiliki pemeriksaan hak akses** (permission check) sama sekali. Siapa pun yang bisa mengakses aplikasi, bahkan dengan peran paling rendah, bisa memanggil endpoint ini langsung.

Seluruh endpoint lain di modul inventory sudah memiliki pemeriksaan seperti `checkPermission(request, 'purchases', 'create')`, namun kedua endpoint deposit ini **tidak memilikinya**.

**Dampak bisnis:**

- Staf yang seharusnya tidak punya akses ke keuangan pembelian bisa menambah atau melihat catatan pembayaran.
- Potensi manipulasi data keuangan yang tidak terdeteksi.
- Inkonsistensi dengan standar keamanan yang sudah diterapkan di fitur lain.

**Solusi yang Direkomendasikan:**

Tambahkan pemeriksaan izin di kedua fungsi:
- `GET /api/purchases/deposits` → wajib `checkPermission(request, 'purchases', 'view')`
- `POST /api/purchases/deposits` → wajib `checkPermission(request, 'purchases', 'create')` atau izin tersendiri

---

## Ringkasan Semua Temuan

| ID | Modul | Judul | Tingkat |
|----|-------|-------|---------|
| BUG-01 | Purchase Orders | Tidak ada fitur Edit PO | 🔴 Kritis |
| BUG-02 | Purchase Orders | Stok bisa negatif saat hapus PO | 🔴 Kritis |
| BUG-03 | Purchase Orders | Potensi duplikasi nomor PO | 🔴 Kritis |
| BUG-04 | Semua Modul Inventory | Header toko hilang di beberapa request | 🟡 Menengah |
| BUG-05 | Suppliers | Hapus supplier tanpa cek riwayat PO | 🟡 Menengah |
| BUG-06 | Usage Logs | Tidak ada fitur Edit usage log | 🟡 Menengah |
| BUG-07 | Products | Field category tidak divalidasi di API | 🟡 Menengah |
| BUG-08 | Purchase Orders | Tidak bisa ubah status Pending→Received | 🟢 Minor |
| BUG-09 | Purchase Deposits | Endpoint deposit tanpa pemeriksaan izin | 🟢 Minor |

---

## Prioritas Pengerjaan yang Disarankan

**Tahap 1 — Perbaiki dulu (Kritis):**
Selesaikan BUG-01, BUG-02, dan BUG-03. Ketiga hal ini berhubungan langsung dengan integritas data stok dan bisa menyebabkan kerusakan data yang sulit dipulihkan.

**Tahap 2 — Perbaiki segera (Menengah):**
BUG-04 paling penting jika salon memiliki lebih dari satu cabang. BUG-05 dan BUG-06 meningkatkan keandalan sistem. BUG-07 adalah perbaikan kecil yang mudah dilakukan.

**Tahap 3 — Perbaiki saat ada kesempatan (Minor):**
BUG-08 akan meningkatkan workflow nyata salon. BUG-09 adalah perbaikan keamanan yang baik untuk dilakukan sebelum sistem berjalan di produksi.

---

## Catatan Positif

Selain temuan di atas, banyak hal yang sudah **diimplementasikan dengan baik** di modul inventory:

- ✅ Sistem notifikasi WA stok rendah bekerja dengan logika yang benar (hanya kirim sekali, reset saat restock).
- ✅ Penghapusan Usage Log sudah mengembalikan stok dengan benar.
- ✅ Halaman daftar produk, PO, dan supplier sudah responsif (mendukung tampilan mobile).
- ✅ Sistem pencarian dan pagination sudah berfungsi di semua halaman utama.
- ✅ Penandaan produk "inactive" alih-alih hapus permanen sudah diterapkan — ini praktik yang baik.
- ✅ Fitur deposit pembayaran bertahap untuk PO sudah ada dan logikanya benar.

---

*Laporan ini dibuat berdasarkan analisis statis kode sumber. Pengujian fungsional langsung di environment development disarankan untuk memverifikasi setiap temuan sebelum perbaikan dilakukan.*
