# Mongo Migration Scripts

Folder ini dipakai untuk migration data MongoDB agar perubahan dari local bisa dijalankan terkontrol ke DB dev/prod.

## Struktur

- `scripts/run-migration.js` -> runner migration
- `scripts/migrations/*.js` -> file migration
- `scripts/_utils/*` -> util env + koneksi Mongo

## Format migration

Setiap file migration harus export dua function:

- `up({ db, mongoose })`
- `down({ db, mongoose })`

## Cara pakai

1. Lihat daftar migration

```bash
npm run migrate:list
```

2. Jalankan migration (apply/up)

```bash
npm run migrate -- --file=2026-04-17-add-customer-source-field.js
```

3. Rollback migration (down)

```bash
npm run migrate -- --file=2026-04-17-add-customer-source-field.js --direction=down
```

4. Pakai env file berbeda (misalnya production)

```bash
npm run migrate -- --file=2026-04-17-add-customer-source-field.js --env=.env.production
```

## Rekomendasi workflow

1. Buat migration baru per perubahan data.
2. Test dulu di DB development.
3. Jalankan di production saat deploy window.
4. Simpan log hasil command untuk audit.

## Catatan

- Migration ini fokus perubahan data dokumen, bukan schema SQL.
- Pastikan `MONGODB_URI` mengarah ke DB yang benar sebelum menjalankan migration.
