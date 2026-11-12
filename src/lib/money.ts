// Fungsi murni (tanpa database) untuk hitungan stok & laba.
// Dipisah supaya mudah dites tanpa DB.

export interface LineInput {
  productId: string;
  qty: number;
}

/** Gabungkan baris dengan produk yang sama (mis. produk yang sama diinput dua kali di keranjang). */
export function mergeLines<T extends LineInput>(lines: T[]): T[] {
  const map = new Map<string, T>();
  for (const l of lines) {
    const prev = map.get(l.productId);
    if (prev) map.set(l.productId, { ...prev, qty: prev.qty + l.qty });
    else map.set(l.productId, { ...l });
  }
  return [...map.values()];
}

/**
 * Harga pokok rata-rata tertimbang setelah pembelian.
 * Contoh: stok 10 @ 1000, beli 10 @ 1200 -> 1100.
 * Dibulatkan ke rupiah terdekat (Int).
 */
export function weightedAvgCost(
  currentStock: number,
  currentCost: number,
  buyQty: number,
  buyUnitCost: number,
): number {
  if (buyQty <= 0) throw new Error("buyQty harus > 0");
  const totalQty = currentStock + buyQty;
  if (currentStock <= 0) return buyUnitCost; // stok kosong: pakai harga beli terbaru
  return Math.round((currentStock * currentCost + buyQty * buyUnitCost) / totalQty);
}

export interface SoldLine {
  qty: number;
  unitPrice: number;
  costPrice: number;
}

export function revenueOf(lines: SoldLine[]): number {
  return lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
}

/** HPP (harga pokok penjualan) = hanya barang yang TERJUAL, bukan semua pembelian. */
export function cogsOf(lines: SoldLine[]): number {
  return lines.reduce((s, l) => s + l.qty * l.costPrice, 0);
}

export function grossProfit(lines: SoldLine[]): number {
  return revenueOf(lines) - cogsOf(lines);
}

/** Laba bersih = laba kotor - biaya operasional (pengeluaran selain pembelian stok). */
export function netProfit(gross: number, operatingExpenses: number): number {
  return gross - operatingExpenses;
}

/** Selisih opname: positif = stok fisik lebih banyak dari sistem. */
export function opnameDiff(systemStock: number, countedQty: number): number {
  return countedQty - systemStock;
}

/** Persentase selisih stok (untuk evaluasi akurasi): rata-rata |selisih| / stok sistem. */
export function inventoryAccuracy(rows: { system: number; counted: number }[]): {
  accuracyPct: number;
  mismatchedItems: number;
} {
  if (rows.length === 0) return { accuracyPct: 100, mismatchedItems: 0 };
  const mismatched = rows.filter((r) => r.system !== r.counted).length;
  return {
    accuracyPct: Math.round(((rows.length - mismatched) / rows.length) * 1000) / 10,
    mismatchedItems: mismatched,
  };
}

/** Rentang waktu hari ini / bulan ini di zona WIB (UTC+7, tanpa DST). */
export function jakartaRange(
  period: "today" | "month",
  now: Date = new Date(),
): { from: Date; to: Date } {
  const OFFSET_MS = 7 * 60 * 60 * 1000;
  const local = new Date(now.getTime() + OFFSET_MS); // "jam dinding" WIB sebagai UTC
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();
  const startLocal = period === "today" ? Date.UTC(y, m, d) : Date.UTC(y, m, 1);
  const endLocal = period === "today" ? Date.UTC(y, m, d + 1) : Date.UTC(y, m + 1, 1);
  return { from: new Date(startLocal - OFFSET_MS), to: new Date(endLocal - OFFSET_MS) };
}
