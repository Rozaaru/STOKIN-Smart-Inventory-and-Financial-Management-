-- STOKIN - skema PostgreSQL setara dengan schema.prisma
-- Pakai ini jika ingin membuat tabel langsung lewat SQL (mis. di Supabase SQL Editor).
-- Jika memakai Prisma, cukup jalankan `npm run db:migrate` dan abaikan file ini.

CREATE TYPE "Role" AS ENUM ('OWNER', 'STAFF');
CREATE TYPE "TransactionType" AS ENUM ('SALE', 'PURCHASE', 'STOCK_ADJUST', 'EXPENSE');
CREATE TYPE "MovementReason" AS ENUM ('INITIAL', 'SALE', 'PURCHASE', 'ADJUSTMENT');
CREATE TYPE "FinancialType" AS ENUM ('INCOME', 'EXPENSE');

CREATE TABLE businesses (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  type       TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  business_id   TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          "Role" NOT NULL DEFAULT 'STAFF',
  created_at    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX users_business_id_idx ON users(business_id);

CREATE TABLE categories (
  id          TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  UNIQUE (business_id, name)
);

CREATE TABLE products (
  id          TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  sku         TEXT,
  unit        TEXT NOT NULL DEFAULT 'pcs',
  cost_price  INTEGER NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  sell_price  INTEGER NOT NULL DEFAULT 0 CHECK (sell_price >= 0),
  stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),   -- stok tidak boleh minus
  min_stock   INTEGER NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (business_id, sku)
);
CREATE INDEX products_business_name_idx ON products(business_id, name);

CREATE TABLE transactions (
  id          TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type        "TransactionType" NOT NULL,
  date        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total       INTEGER NOT NULL DEFAULT 0,
  note        TEXT,
  created_by  TEXT NOT NULL REFERENCES users(id),
  created_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX transactions_business_date_idx ON transactions(business_id, date);
CREATE INDEX transactions_business_type_date_idx ON transactions(business_id, type, date);

CREATE TABLE transaction_items (
  id             TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  product_id     TEXT NOT NULL REFERENCES products(id),
  qty            INTEGER NOT NULL,           -- boleh negatif hanya untuk STOCK_ADJUST
  unit_price     INTEGER NOT NULL,
  cost_price     INTEGER NOT NULL DEFAULT 0, -- snapshot harga pokok saat transaksi
  subtotal       INTEGER NOT NULL
);
CREATE INDEX transaction_items_tx_idx ON transaction_items(transaction_id);
CREATE INDEX transaction_items_product_idx ON transaction_items(product_id);

CREATE TABLE stock_movements (
  id             TEXT PRIMARY KEY,
  product_id     TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
  qty_change     INTEGER NOT NULL,
  stock_after    INTEGER NOT NULL,
  reason         "MovementReason" NOT NULL,
  created_at     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX stock_movements_product_created_idx ON stock_movements(product_id, created_at);

CREATE TABLE financial_records (
  id             TEXT PRIMARY KEY,
  business_id    TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  type           "FinancialType" NOT NULL,
  category       TEXT NOT NULL,  -- PENJUALAN, PEMBELIAN_STOK, LISTRIK, GAJI, SEWA, LAINNYA
  amount         INTEGER NOT NULL CHECK (amount >= 0),
  date           TIMESTAMP(3) NOT NULL,
  created_at     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX financial_records_business_date_idx ON financial_records(business_id, date);
CREATE INDEX financial_records_business_type_cat_idx ON financial_records(business_id, type, category);

CREATE TABLE notifications (
  id          TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  product_id  TEXT REFERENCES products(id) ON DELETE CASCADE,
  message     TEXT NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX notifications_business_read_idx ON notifications(business_id, is_read);

-- ---------------------------------------------------------------
-- Supabase: aktifkan RLS tanpa policy.
-- Supabase membuka REST API otomatis untuk schema public; tanpa RLS siapa pun
-- yang punya anon key bisa membaca tabel. Prisma tetap bisa akses karena
-- koneksinya memakai role postgres (bypass RLS).
-- ---------------------------------------------------------------
ALTER TABLE businesses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     ENABLE ROW LEVEL SECURITY;
