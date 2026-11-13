-- Jalankan di Supabase SQL Editor setelah `prisma db push` atau `prisma migrate dev`.
-- Aman dijalankan berulang kali. Prisma tetap bisa akses (role postgres melewati RLS);
-- REST API publik Supabase (anon key) jadi tertutup.
ALTER TABLE businesses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     ENABLE ROW LEVEL SECURITY;

-- Hanya ada jika memakai `prisma migrate` (tidak ada pada `db push`):
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE _prisma_migrations ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- Pengaman stok minus (db push tidak membuat CHECK constraint).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_stock_nonneg') THEN
    ALTER TABLE products ADD CONSTRAINT products_stock_nonneg CHECK (stock >= 0);
    ALTER TABLE products ADD CONSTRAINT products_cost_nonneg  CHECK (cost_price >= 0);
    ALTER TABLE products ADD CONSTRAINT products_sell_nonneg  CHECK (sell_price >= 0);
  END IF;
END $$;
