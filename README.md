# STOKIN: Smart Inventory & Financial Management

Aplikasi web responsif yang menyatukan stok dan keuangan UMKM dalam satu alur transaksi.
Setiap penjualan/pembelian otomatis mengubah stok, riwayat stok, catatan keuangan, dan notifikasi stok rendah.

## Stack

Next.js 15 (App Router, full-stack) · Tailwind CSS 4 · PostgreSQL + Prisma · jose + bcryptjs (sesi cookie) · zod · Recharts · AI via Anthropic Messages API

## Menjalankan

```bash
npm install
cp .env.example .env        # isi DATABASE_URL, DIRECT_URL, SESSION_SECRET
npx prisma db push
# Supabase: jalankan prisma/rls.sql di SQL Editor (menutup akses REST publik)
npm run db:seed             # opsional: data demo (demo@stokin.test / demo12345)
npm run dev
```

Alternatif tanpa Prisma migrate: jalankan `prisma/schema.sql` langsung di PostgreSQL/Supabase SQL Editor, lalu `npx prisma generate`.

Tes logika murni (tanpa database): `npm run test:pure`

## Memakai Supabase

Supabase hanya dipakai sebagai PostgreSQL (login ditangani aplikasi sendiri).
- `DATABASE_URL`: pooler port 6543 + `?pgbouncer=true` (untuk aplikasi / Vercel)
- `DIRECT_URL`: port 5432 (untuk `prisma migrate`)
- Jalankan `prisma/rls.sql` setelah migrasi. Prisma tetap bisa akses, REST publik Supabase tertutup.
- Paket gratis di-pause setelah seminggu tidak aktif; hidupkan sebelum demo.

## Struktur

```
prisma/schema.prisma      skema (sumber kebenaran)
prisma/schema.sql         SQL setara
prisma/seed.ts            data demo lewat logika inti
src/lib/transactions.ts   INTI: jual, beli, pengeluaran, opname (atomic)
src/lib/money.ts          hitungan murni: HPP rata-rata, laba, zona WIB
src/lib/reports.ts        dashboard, laba rugi, produk terlaris, stok menipis
src/lib/ai.ts             ringkasan data -> LLM
src/lib/csv.ts            impor produk dari CSV
src/lib/auth.ts           sesi + peran OWNER/STAFF
src/app/api/...           endpoint REST
src/app/...               halaman: login, dashboard, catat penjualan
tests/money.test.ts       16 tes
```

## Endpoint

| Method | Path | Akses | Fungsi |
|---|---|---|---|
| POST | `/api/auth/register` | publik | Buat usaha + akun OWNER |
| POST/DELETE | `/api/auth/login` | publik | Masuk / keluar |
| GET | `/api/products?q=&lowStock=1` | semua | Daftar produk |
| POST | `/api/products` | OWNER | Tambah produk |
| POST | `/api/products/import` | OWNER | Impor CSV (`?skipInvalid=1`) |
| POST | `/api/transactions/sale` | semua | Penjualan |
| POST | `/api/transactions/purchase` | semua | Stok masuk |
| POST | `/api/transactions/expense` | OWNER | Biaya operasional |
| POST | `/api/transactions/opname` | OWNER | Koreksi stok fisik |
| GET | `/api/transactions?type=&from=&to=` | semua | Riwayat |
| GET | `/api/dashboard?period=today\|month` | OWNER | Ringkasan keuangan |
| POST | `/api/assistant` | OWNER | Analisis AI |

Contoh penjualan:

```json
POST /api/transactions/sale
{ "items": [ { "productId": "...", "qty": 3 }, { "productId": "...", "qty": 12, "unitPrice": 5500 } ] }
```

## Keputusan desain penting

1. **Atomic.** Satu transaksi database untuk semua efek. Gagal satu langkah, batal semua.
2. **Anti stok minus saat dua kasir bersamaan.** Baris produk dikunci `SELECT ... FOR UPDATE` (urut id). Tabel juga punya `CHECK (stock >= 0)` sebagai pengaman terakhir.
3. **Audit trail.** Setiap perubahan stok tercatat di `stock_movements` beserta `stock_after`.
4. **Laba historis akurat.** `transaction_items.cost_price` menyimpan snapshot harga pokok saat penjualan.
5. **HPP rata-rata tertimbang.** Setiap pembelian memperbarui `products.cost_price`. Contoh: 10 @1.000 + 10 @1.200 menjadi 1.100.
6. **Pembelian stok bukan biaya laba.** Dicatat sebagai arus kas keluar (`PEMBELIAN_STOK`). Laba memakai HPP barang yang terjual:
   - Laba kotor = pendapatan − HPP
   - Laba bersih = laba kotor − biaya operasional
7. **Selisih opname dilaporkan terpisah** (`stockAdjustmentValue`) dan belum masuk laba bersih. Putuskan bersama tim apakah kerugian stok mau dimasukkan sebagai biaya.
8. **AI tidak menghitung.** Backend menghitung ringkasan, LLM hanya menafsirkan. Tanpa `ANTHROPIC_API_KEY`, endpoint tetap mengembalikan angka ringkasan.
9. **Zona waktu WIB.** "Hari ini" dan "bulan ini" dihitung menurut WIB (`jakartaRange`), bukan UTC.
10. **Uang disimpan sebagai Int rupiah.** Tidak ada Float.

## Status

Sudah ada dan teruji (16 tes lolos): hitungan HPP, laba, opname, rentang waktu WIB, parser CSV.

Sudah ditulis tetapi **belum dijalankan terhadap database nyata**: `transactions.ts`, `reports.ts`, route API, halaman UI. Langkah pertama setelah `npm install`: jalankan seed, lalu coba tiap skenario di bawah.

### Skenario uji manual / integrasi yang wajib

- Jual qty > stok: ditolak (409), tidak ada baris tersimpan sama sekali (rollback).
- Dua penjualan bersamaan untuk stok terakhir: satu berhasil, satu ditolak.
- Jual 3 lalu cek: stok −3, satu `stock_movements` (−3), satu `financial_records` INCOME.
- Beli lalu jual: HPP memakai harga rata-rata baru, laba kotor sesuai hitungan manual.
- Opname dengan selisih: stok = hitungan fisik, movement `ADJUSTMENT`, tanpa selisih tidak membuat transaksi.
- STAFF memanggil `/api/dashboard`, `/expense`, `/opname`: 403.

## Belum ada (sengaja di luar MVP)

Halaman produk/pembelian/pengeluaran/opname/laporan, grafik Recharts, ekspor PDF/Excel, pembatalan (void) transaksi, chat AI bebas, manajemen user STAFF, rate limit login. API untuk semuanya (kecuali void, ekspor, dan manajemen user) sudah tersedia, tinggal dibuatkan UI.

Catatan: menghapus transaksi sebaiknya lewat transaksi pembalik (void), bukan `DELETE`, supaya audit trail utuh.
