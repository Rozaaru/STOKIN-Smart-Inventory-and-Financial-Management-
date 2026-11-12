-- Jalankan SETELAH `prisma migrate dev` (tabel dibuat Prisma) di Supabase SQL Editor.
-- Jika memakai prisma/schema.sql, bagian RLS sudah ada di dalamnya.
ALTER TABLE businesses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE _prisma_migrations ENABLE ROW LEVEL SECURITY;
