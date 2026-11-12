/**
 * INTI STOKIN: transaksi terpadu.
 *
 * Setiap fungsi di sini berjalan dalam SATU database transaction (atomic):
 * stok, riwayat pergerakan stok, catatan keuangan, dan notifikasi berubah bersama,
 * atau dibatalkan bersama jika ada satu langkah yang gagal.
 *
 * Konkurensi: baris produk dikunci dengan SELECT ... FOR UPDATE (urut berdasarkan id
 * agar tidak deadlock), jadi dua kasir yang menjual barang yang sama tidak bisa
 * membuat stok minus.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { AppError, InsufficientStockError, NotFoundError } from "./errors";
import { mergeLines, opnameDiff, weightedAvgCost } from "./money";
import {
  expenseSchema,
  opnameSchema,
  purchaseSchema,
  saleSchema,
  type ExpenseInput,
  type OpnameInput,
  type PurchaseInput,
  type SaleInput,
} from "./schemas";

type Tx = Prisma.TransactionClient;

export interface Ctx {
  businessId: string;
  userId: string;
}

interface LockedProduct {
  id: string;
  name: string;
  stock: number;
  costPrice: number;
  sellPrice: number;
  minStock: number;
}

// Kategori keuangan yang dipakai sistem sendiri (tidak boleh dipakai di form pengeluaran).
export const CAT_SALES = "PENJUALAN";
export const CAT_STOCK_PURCHASE = "PEMBELIAN_STOK";

const TX_OPTIONS = { timeout: 15_000, maxWait: 5_000 } as const;

async function lockProducts(tx: Tx, businessId: string, ids: string[]) {
  const sorted = [...new Set(ids)].sort();
  const rows = await tx.$queryRaw<LockedProduct[]>`
    SELECT id, name, stock,
           cost_price AS "costPrice",
           sell_price AS "sellPrice",
           min_stock  AS "minStock"
    FROM products
    WHERE business_id = ${businessId}
      AND is_active = TRUE
      AND id IN (${Prisma.join(sorted)})
    ORDER BY id
    FOR UPDATE`;
  if (rows.length !== sorted.length) throw new NotFoundError("Salah satu produk");
  return new Map(rows.map((r) => [r.id, r]));
}

async function syncLowStockNotification(
  tx: Tx,
  businessId: string,
  p: Pick<LockedProduct, "id" | "name" | "minStock">,
  stockAfter: number,
) {
  const low = stockAfter <= p.minStock;
  if (low) {
    const existing = await tx.notification.findFirst({
      where: { businessId, productId: p.id, isRead: false },
      select: { id: true },
    });
    if (!existing) {
      const message =
        stockAfter === 0
          ? `Stok "${p.name}" habis`
          : `Stok "${p.name}" menipis: sisa ${stockAfter} (batas minimum ${p.minStock})`;
      await tx.notification.create({ data: { businessId, productId: p.id, message } });
    }
  } else {
    // Stok sudah aman lagi (mis. habis restock): tutup notifikasi lama otomatis.
    await tx.notification.updateMany({
      where: { businessId, productId: p.id, isRead: false },
      data: { isRead: true },
    });
  }
}

/* ------------------------------------------------------------------ */
/* PENJUALAN                                                          */
/* ------------------------------------------------------------------ */
export async function recordSale(ctx: Ctx, raw: SaleInput) {
  const input = saleSchema.parse(raw);
  // Catatan: baris dengan produk sama digabung; harga khusus baris pertama yang dipakai.
  const lines = mergeLines(input.items);
  const date = input.date ?? new Date();

  return prisma.$transaction(async (tx) => {
    const products = await lockProducts(
      tx,
      ctx.businessId,
      lines.map((l) => l.productId),
    );

    // 1. Validasi stok SEBELUM menulis apa pun
    for (const l of lines) {
      const p = products.get(l.productId)!;
      if (p.stock < l.qty) throw new InsufficientStockError(p.name, p.stock, l.qty);
    }

    // 2. Susun baris transaksi, snapshot harga pokok saat ini
    let total = 0;
    const itemsData = lines.map((l) => {
      const p = products.get(l.productId)!;
      const unitPrice = l.unitPrice ?? p.sellPrice;
      const subtotal = unitPrice * l.qty;
      total += subtotal;
      return {
        productId: p.id,
        qty: l.qty,
        unitPrice,
        costPrice: p.costPrice,
        subtotal,
      };
    });

    const trx = await tx.transaction.create({
      data: {
        businessId: ctx.businessId,
        type: "SALE",
        date,
        total,
        note: input.note,
        createdBy: ctx.userId,
        items: { create: itemsData },
      },
    });

    // 3. Kurangi stok + catat pergerakan + notifikasi stok rendah
    const lowStock: string[] = [];
    for (const l of lines) {
      const p = products.get(l.productId)!;
      const stockAfter = p.stock - l.qty;
      await tx.product.update({ where: { id: p.id }, data: { stock: stockAfter } });
      await tx.stockMovement.create({
        data: {
          productId: p.id,
          transactionId: trx.id,
          qtyChange: -l.qty,
          stockAfter,
          reason: "SALE",
        },
      });
      await syncLowStockNotification(tx, ctx.businessId, p, stockAfter);
      if (stockAfter <= p.minStock) lowStock.push(p.name);
    }

    // 4. Catat pemasukan
    await tx.financialRecord.create({
      data: {
        businessId: ctx.businessId,
        transactionId: trx.id,
        type: "INCOME",
        category: CAT_SALES,
        amount: total,
        date,
      },
    });

    return { transactionId: trx.id, total, lowStock };
  }, TX_OPTIONS);
}

/* ------------------------------------------------------------------ */
/* PEMBELIAN / STOK MASUK                                             */
/* ------------------------------------------------------------------ */
export async function recordPurchase(ctx: Ctx, raw: PurchaseInput) {
  const input = purchaseSchema.parse(raw);
  const lines = mergeLines(input.items.map((i) => ({ ...i })));
  const date = input.date ?? new Date();

  return prisma.$transaction(async (tx) => {
    const products = await lockProducts(
      tx,
      ctx.businessId,
      lines.map((l) => l.productId),
    );

    let total = 0;
    const itemsData = lines.map((l) => {
      const p = products.get(l.productId)!;
      const subtotal = l.unitCost * l.qty;
      total += subtotal;
      return {
        productId: p.id,
        qty: l.qty,
        unitPrice: l.unitCost,
        costPrice: l.unitCost,
        subtotal,
      };
    });

    const trx = await tx.transaction.create({
      data: {
        businessId: ctx.businessId,
        type: "PURCHASE",
        date,
        total,
        note: input.note,
        createdBy: ctx.userId,
        items: { create: itemsData },
      },
    });

    for (const l of lines) {
      const p = products.get(l.productId)!;
      const stockAfter = p.stock + l.qty;
      // Harga pokok rata-rata tertimbang: HPP penjualan berikutnya ikut harga beli baru.
      const costPrice = weightedAvgCost(p.stock, p.costPrice, l.qty, l.unitCost);
      await tx.product.update({
        where: { id: p.id },
        data: {
          stock: stockAfter,
          costPrice,
          ...(l.newSellPrice !== undefined ? { sellPrice: l.newSellPrice } : {}),
        },
      });
      await tx.stockMovement.create({
        data: {
          productId: p.id,
          transactionId: trx.id,
          qtyChange: l.qty,
          stockAfter,
          reason: "PURCHASE",
        },
      });
      await syncLowStockNotification(tx, ctx.businessId, p, stockAfter);
    }

    // Pembelian stok = arus kas keluar, BUKAN biaya laba. HPP baru terbentuk saat barang terjual.
    await tx.financialRecord.create({
      data: {
        businessId: ctx.businessId,
        transactionId: trx.id,
        type: "EXPENSE",
        category: CAT_STOCK_PURCHASE,
        amount: total,
        date,
      },
    });

    return { transactionId: trx.id, total };
  }, TX_OPTIONS);
}

/* ------------------------------------------------------------------ */
/* PENGELUARAN OPERASIONAL                                            */
/* ------------------------------------------------------------------ */
export async function recordExpense(ctx: Ctx, raw: ExpenseInput) {
  const input = expenseSchema.parse(raw);
  const category = input.category.trim().toUpperCase();
  if (category === CAT_STOCK_PURCHASE || category === CAT_SALES) {
    throw new AppError(
      "Kategori ini dipakai sistem. Catat pembelian barang lewat menu Pembelian.",
    );
  }
  const date = input.date ?? new Date();

  return prisma.$transaction(async (tx) => {
    const trx = await tx.transaction.create({
      data: {
        businessId: ctx.businessId,
        type: "EXPENSE",
        date,
        total: input.amount,
        note: input.note,
        createdBy: ctx.userId,
      },
    });
    await tx.financialRecord.create({
      data: {
        businessId: ctx.businessId,
        transactionId: trx.id,
        type: "EXPENSE",
        category,
        amount: input.amount,
        date,
      },
    });
    return { transactionId: trx.id, total: input.amount };
  }, TX_OPTIONS);
}

/* ------------------------------------------------------------------ */
/* STOCK OPNAME (koreksi stok dari hitungan fisik)                    */
/* ------------------------------------------------------------------ */
export async function recordStockOpname(ctx: Ctx, raw: OpnameInput) {
  const input = opnameSchema.parse(raw);
  const lines = mergeLines(
    input.items.map((i) => ({ productId: i.productId, qty: 0, countedQty: i.countedQty })),
  );
  const date = input.date ?? new Date();

  return prisma.$transaction(async (tx) => {
    const products = await lockProducts(
      tx,
      ctx.businessId,
      lines.map((l) => l.productId),
    );

    const changes = lines
      .map((l) => {
        const p = products.get(l.productId)!;
        return { p, diff: opnameDiff(p.stock, l.countedQty), counted: l.countedQty };
      })
      .filter((c) => c.diff !== 0);

    if (changes.length === 0) return { transactionId: null, changed: 0, totalValue: 0 };

    // Nilai selisih (negatif = barang hilang/rusak) dihitung dengan harga pokok.
    const itemsData = changes.map(({ p, diff }) => ({
      productId: p.id,
      qty: diff,
      unitPrice: p.costPrice,
      costPrice: p.costPrice,
      subtotal: diff * p.costPrice,
    }));
    const totalValue = itemsData.reduce((s, i) => s + i.subtotal, 0);

    const trx = await tx.transaction.create({
      data: {
        businessId: ctx.businessId,
        type: "STOCK_ADJUST",
        date,
        total: totalValue,
        note: input.note,
        createdBy: ctx.userId,
        items: { create: itemsData },
      },
    });

    for (const { p, diff, counted } of changes) {
      await tx.product.update({ where: { id: p.id }, data: { stock: counted } });
      await tx.stockMovement.create({
        data: {
          productId: p.id,
          transactionId: trx.id,
          qtyChange: diff,
          stockAfter: counted,
          reason: "ADJUSTMENT",
        },
      });
      await syncLowStockNotification(tx, ctx.businessId, p, counted);
    }

    return { transactionId: trx.id, changed: changes.length, totalValue };
  }, TX_OPTIONS);
}
