import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cogsOf,
  grossProfit,
  inventoryAccuracy,
  jakartaRange,
  mergeLines,
  netProfit,
  opnameDiff,
  weightedAvgCost,
} from "../src/lib/money.ts";
import { parseProductCsv } from "../src/lib/csv.ts";

test("mergeLines menggabungkan produk yang sama", () => {
  const r = mergeLines([
    { productId: "a", qty: 2 },
    { productId: "b", qty: 1 },
    { productId: "a", qty: 3 },
  ]);
  assert.equal(r.length, 2);
  assert.equal(r.find((x) => x.productId === "a")!.qty, 5);
});

test("weightedAvgCost: 10 @1000 + 10 @1200 = 1100", () => {
  assert.equal(weightedAvgCost(10, 1000, 10, 1200), 1100);
});

test("weightedAvgCost: stok kosong memakai harga beli baru", () => {
  assert.equal(weightedAvgCost(0, 5000, 4, 1200), 1200);
});

test("weightedAvgCost: pembulatan ke rupiah", () => {
  // (1*1000 + 2*1001) / 3 = 1000.67 -> 1001
  assert.equal(weightedAvgCost(1, 1000, 2, 1001), 1001);
});

test("weightedAvgCost menolak qty <= 0", () => {
  assert.throws(() => weightedAvgCost(5, 1000, 0, 1000));
});

test("laba kotor memakai snapshot harga pokok, bukan harga terbaru", () => {
  const lines = [
    { qty: 3, unitPrice: 68000, costPrice: 62000 }, // laba 18.000
    { qty: 12, unitPrice: 6000, costPrice: 4500 }, // laba 18.000
  ];
  assert.equal(cogsOf(lines), 3 * 62000 + 12 * 4500);
  assert.equal(grossProfit(lines), 36000);
});

test("laba bersih = laba kotor - biaya operasional", () => {
  assert.equal(netProfit(36000, 10000), 26000);
  assert.equal(netProfit(5000, 10000), -5000); // bisa rugi
});

test("opnameDiff: negatif berarti stok fisik kurang", () => {
  assert.equal(opnameDiff(10, 8), -2);
  assert.equal(opnameDiff(10, 12), 2);
  assert.equal(opnameDiff(10, 10), 0);
});

test("inventoryAccuracy menghitung persentase item yang cocok", () => {
  const r = inventoryAccuracy([
    { system: 10, counted: 10 },
    { system: 5, counted: 4 },
    { system: 8, counted: 8 },
    { system: 3, counted: 3 },
  ]);
  assert.equal(r.accuracyPct, 75);
  assert.equal(r.mismatchedItems, 1);
});

test("jakartaRange today: 11 Nov 2026 18:44 WIB -> 11 Nov 00:00 s.d. 12 Nov 00:00 WIB", () => {
  const now = new Date("2026-11-11T11:44:00Z"); // = 18:44 WIB
  const { from, to } = jakartaRange("today", now);
  assert.equal(from.toISOString(), "2026-11-10T17:00:00.000Z");
  assert.equal(to.toISOString(), "2026-11-11T17:00:00.000Z");
});

test("jakartaRange: lewat tengah malam UTC tapi masih hari yang sama di WIB", () => {
  // 01:00 WIB tanggal 12 = 18:00 UTC tanggal 11
  const { from } = jakartaRange("today", new Date("2026-11-11T18:00:00Z"));
  assert.equal(from.toISOString(), "2026-11-11T17:00:00.000Z");
});

test("jakartaRange month: 1 Nov s.d. 1 Des WIB", () => {
  const { from, to } = jakartaRange("month", new Date("2026-11-11T11:44:00Z"));
  assert.equal(from.toISOString(), "2026-10-31T17:00:00.000Z");
  assert.equal(to.toISOString(), "2026-11-30T17:00:00.000Z");
});

test("CSV: parse baris valid, format Rupiah, dan titik koma", () => {
  const csv = "nama;sku;satuan;harga_beli;harga_jual;stok;stok_minimum\nBeras;B1;kg;Rp 12.000;Rp 14.000;50;10";
  const r = parseProductCsv(csv);
  assert.equal(r.errors.length, 0);
  assert.deepEqual(r.rows[0], {
    name: "Beras",
    sku: "B1",
    unit: "kg",
    costPrice: 12000,
    sellPrice: 14000,
    stock: 50,
    minStock: 10,
  });
});

test("CSV: baris salah dilaporkan dengan nomor baris", () => {
  const csv = "nama,harga_jual,stok\nGula,abc,5\n,1000,1\nTeh,3000,2";
  const r = parseProductCsv(csv);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].name, "Teh");
  assert.deepEqual(r.errors.map((e) => e.line), [2, 3]);
});

test("CSV: nama dengan koma di dalam tanda kutip", () => {
  const r = parseProductCsv('nama,stok\n"Kopi, sachet",7');
  assert.equal(r.rows[0].name, "Kopi, sachet");
});

test("CSV: tanpa kolom nama ditolak", () => {
  const r = parseProductCsv("sku,stok\nA,1");
  assert.equal(r.rows.length, 0);
  assert.equal(r.errors.length, 1);
});
