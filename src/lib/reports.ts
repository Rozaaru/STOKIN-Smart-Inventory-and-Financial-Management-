import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { CAT_STOCK_PURCHASE } from "./transactions";

export interface Period {
  from: Date; // inklusif
  to: Date; // eksklusif
}

export async function getFinancialSummary(businessId: string, { from, to }: Period) {
  // Pemasukan & pengeluaran (arus kas)
  const cash = await prisma.financialRecord.groupBy({
    by: ["type", "category"],
    where: { businessId, date: { gte: from, lt: to } },
    _sum: { amount: true },
  });

  let revenue = 0;
  let stockPurchases = 0;
  let operatingExpenses = 0;
  const expenseByCategory: { category: string; amount: number }[] = [];
  for (const r of cash) {
    const amount = r._sum.amount ?? 0;
    if (r.type === "INCOME") revenue += amount;
    else if (r.category === CAT_STOCK_PURCHASE) stockPurchases += amount;
    else {
      operatingExpenses += amount;
      expenseByCategory.push({ category: r.category, amount });
    }
  }

  // HPP: hanya dari barang yang TERJUAL pada periode ini, memakai snapshot harga pokok
  const [cogsRow] = await prisma.$queryRaw<{ cogs: bigint | null }[]>`
    SELECT SUM(ti.qty * ti.cost_price) AS cogs
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    WHERE t.business_id = ${businessId}
      AND t.type = 'SALE'
      AND t.date >= ${from} AND t.date < ${to}`;
  const cogs = Number(cogsRow?.cogs ?? 0);

  // Selisih opname (negatif = kehilangan stok), dilaporkan terpisah agar transparan
  const adj = await prisma.transaction.aggregate({
    where: { businessId, type: "STOCK_ADJUST", date: { gte: from, lt: to } },
    _sum: { total: true },
  });

  const grossProfit = revenue - cogs;
  return {
    revenue,
    cogs,
    grossProfit,
    operatingExpenses,
    netProfit: grossProfit - operatingExpenses,
    stockPurchases, // arus kas keluar untuk beli barang (bukan biaya laba)
    cashNet: revenue - stockPurchases - operatingExpenses,
    stockAdjustmentValue: adj._sum.total ?? 0,
    expenseByCategory: expenseByCategory.sort((a, b) => b.amount - a.amount),
  };
}

export async function getDailySales(businessId: string, { from, to }: Period) {
  // Kelompokkan per hari menurut WIB
  const rows = await prisma.$queryRaw<{ day: string; revenue: bigint }[]>`
    SELECT to_char((date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date, 'YYYY-MM-DD') AS day,
           SUM(amount) AS revenue
    FROM financial_records
    WHERE business_id = ${businessId} AND type = 'INCOME'
      AND date >= ${from} AND date < ${to}
    GROUP BY 1 ORDER BY 1`;
  return rows.map((r) => ({ day: r.day, revenue: Number(r.revenue) }));
}

export async function getTopProducts(businessId: string, { from, to }: Period, limit = 5) {
  const rows = await prisma.$queryRaw<
    { productId: string; name: string; qty: bigint; revenue: bigint }[]
  >`
    SELECT p.id AS "productId", p.name,
           SUM(ti.qty) AS qty, SUM(ti.subtotal) AS revenue
    FROM transaction_items ti
    JOIN transactions t ON t.id = ti.transaction_id
    JOIN products p ON p.id = ti.product_id
    WHERE t.business_id = ${businessId} AND t.type = 'SALE'
      AND t.date >= ${from} AND t.date < ${to}
    GROUP BY p.id, p.name
    ORDER BY qty DESC
    LIMIT ${limit}`;
  return rows.map((r) => ({
    productId: r.productId,
    name: r.name,
    qty: Number(r.qty),
    revenue: Number(r.revenue),
  }));
}

export async function getLowStock(businessId: string) {
  return prisma.$queryRaw<
    { id: string; name: string; unit: string; stock: number; minStock: number }[]
  >`
    SELECT id, name, unit, stock, min_stock AS "minStock"
    FROM products
    WHERE business_id = ${businessId} AND is_active = TRUE AND stock <= min_stock
    ORDER BY (stock::float / NULLIF(min_stock, 0)) ASC NULLS FIRST, name
    LIMIT 50`;
}

export async function getStockValue(businessId: string) {
  const [row] = await prisma.$queryRaw<{ value: bigint | null; items: bigint }[]>`
    SELECT SUM(stock * cost_price) AS value, COUNT(*) AS items
    FROM products WHERE business_id = ${businessId} AND is_active = TRUE`;
  return { value: Number(row?.value ?? 0), items: Number(row?.items ?? 0) };
}

/** Produk yang stoknya ada tapi tidak terjual pada periode (barang lambat). */
export async function getSlowMovers(businessId: string, { from, to }: Period, limit = 5) {
  return prisma.$queryRaw<{ name: string; stock: number; unit: string }[]>`
    SELECT p.name, p.stock, p.unit
    FROM products p
    WHERE p.business_id = ${businessId} AND p.is_active = TRUE AND p.stock > 0
      AND NOT EXISTS (
        SELECT 1 FROM transaction_items ti
        JOIN transactions t ON t.id = ti.transaction_id
        WHERE ti.product_id = p.id AND t.type = 'SALE'
          AND t.date >= ${from} AND t.date < ${to})
    ORDER BY p.stock * p.cost_price DESC
    LIMIT ${limit}`;
}

export async function getDashboard(businessId: string, period: Period) {
  const [summary, daily, top, lowStock, stockValue] = await Promise.all([
    getFinancialSummary(businessId, period),
    getDailySales(businessId, period),
    getTopProducts(businessId, period),
    getLowStock(businessId),
    getStockValue(businessId),
  ]);
  return { summary, daily, top, lowStock, stockValue };
}

/** Riwayat transaksi dengan filter tanggal/tipe. */
export async function listTransactions(
  businessId: string,
  opts: { from?: Date; to?: Date; type?: Prisma.TransactionWhereInput["type"]; take?: number } = {},
) {
  return prisma.transaction.findMany({
    where: {
      businessId,
      type: opts.type,
      date: { gte: opts.from, lt: opts.to },
    },
    orderBy: { date: "desc" },
    take: opts.take ?? 50,
    include: { items: { include: { product: { select: { name: true, unit: true } } } } },
  });
}
