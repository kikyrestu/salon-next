# Progress Tracker — Salon Next Customization

**Project Start**: 21 April 2026  
**Deadline**: 21 Mei 2026 (30 hari)  
**Developer**: Kiky (Buildy Web)  
**Last Updated**: 21 April 2026

---

## Overall Progress

| Module | Total Fitur | Selesai | Progress |
|---|---|---|---|
| 1. Appointment | 4 | 4 | 100% |
| 2. Reports | 7 | 7 | 100% |
| 3. POS | 4 | 0 | 0% |
| 4. Layanan / Service | 1 | 0 | 0% |
| 5. Customer | 7 | 0 | 0% |
| 6. Product | 3 | 0 | 0% |
| **Total** | **26** | **11** | **42%** |

---

## Module 1 — Appointment

| # | Fitur | Status | Catatan |
|---|---|---|---|
| 1.1 | Booking → POS flow | ✅ Selesai | Ditambahkan tombol Lanjut ke POS di list appointment |
| 1.2 | Auto-complete booking saat payment selesai | ✅ Selesai | Otomatis call PUT status saat create invoice POST success di POS |
| 1.3 | Warna abu-abu untuk booking completed | ✅ Selesai | Conditional styling di list appointments page |
| 1.4 | Filter tanggal (date range) di list view | ✅ Selesai | Penambahan input date-range & fetch param di API route |

---

## Module 2 — Reports

| # | Fitur | Status | Catatan |
|---|---|---|---|
| 2.1 | Sortable columns di semua tabel laporan | ✅ Selesai | Table hook logic + UI indicator up/down arrow per tab |
| 2.2 | Filter by metode pembayaran | ✅ Selesai | Select payment (Cash, Transfer, Debit, QRIS) di tab Sales |
| 2.3 | Export ke Excel (.xlsx) | ✅ Selesai | Pemasangan library xlsx + file-saver + button ekspor top-bar |
| 2.4 | Custom date range di sales report | ✅ Selesai | Custom input type=date global filter di top-nav (UI & state sync) |
| 2.5 | Top customer by spending | ✅ Selesai | Agregasi totalAmount dari schema Invoice per Customer per period |
| 2.6 | Top service by sales | ✅ Selesai | Data services otomatis tersortir descending (revenue), bisa klik kolom count |
| 2.7 | Top employee by transaction | ✅ Selesai | Rekapitulasi staff transactions dan revenue di reports staff |

---

## Module 3 — POS

| # | Fitur | Status | Catatan |
|---|---|---|---|
| 3.1 | Upload gambar di service / product / paket | ✅ Selesai | Komponen ImageUpload, schema Mongoose, route `/api/upload` dan Integrasi di POS |
| 3.2 | Split payment (multi metode) | ⬜ Belum | |
| 3.3 | Tambah metode bayar: Debit, Kredit, Transfer | ✅ Selesai | Ubah Card/Wallet ke Debit, Credit Card, Transfer di POST page |
| 3.4 | Tab Paket & All di POS | ✅ Selesai | Default tab 'All' dan ubah 'Packages' menjadi 'Paket' |

---

## Module 4 — Layanan / Service

| # | Fitur | Status | Catatan |
|---|---|---|---|
| 4.1 | Service bundling (beberapa jasa dalam 1 paket) | ⬜ Belum | |

---

## Module 5 — Customer

| # | Fitur | Status | Catatan |
|---|---|---|---|
| 5.1 | Membership VIP (tiered) | ⬜ Belum | |
| 5.2 | Loyalty point program | ⬜ Belum | |
| 5.3 | Referral system | ⬜ Belum | |
| 5.4 | Voucher / Gift Card | ⬜ Belum | |
| 5.5 | Customer dashboard lengkap | ⬜ Belum | |
| 5.6 | Foto before-after (auto resize) | ⬜ Belum | |
| 5.7 | WA notification opt-in per customer | ⬜ Belum | |

---

## Module 6 — Product

| # | Fitur | Status | Catatan |
|---|---|---|---|
| 6.1 | Komisi penjualan produk per pegawai | ⬜ Belum | |
| 6.2 | Auto deduct stok saat transaksi selesai | ⬜ Belum | |
| 6.3 | WA notif otomatis stok hampir habis | ⬜ Belum | |

---

## Status Legend

| Icon | Arti |
|---|---|
| ⬜ Belum | Belum dikerjakan |
| 🔄 Proses | Sedang dikerjakan |
| ✅ Selesai | Sudah selesai & tested |
| ❌ Blocked | Ada kendala / butuh info dari klien |

---

## Catatan Harian

### [Tanggal] — Hari ke-X
- ...

---

## Kendala / Pertanyaan untuk Klien

- [ ] ...
