// Parser CSV sederhana untuk impor produk.
// Kolom: nama,sku,satuan,harga_beli,harga_jual,stok,stok_minimum
// Mendukung tanda kutip ganda dan pemisah koma atau titik koma (Excel Indonesia).

export interface ProductRow {
  name: string;
  sku: string | null;
  unit: string;
  costPrice: number;
  sellPrice: number;
  stock: number;
  minStock: number;
}

export interface CsvResult {
  rows: ProductRow[];
  errors: { line: number; message: string }[];
}

function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === sep) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function toInt(v: string | undefined): number {
  if (!v) return 0;
  const cleaned = v.replace(/[^\d-]/g, ""); // "Rp 12.000" -> "12000"
  return cleaned === "" ? NaN : parseInt(cleaned, 10);
}

export function parseProductCsv(text: string): CsvResult {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  const result: CsvResult = { rows: [], errors: [] };
  if (lines.length < 2) {
    result.errors.push({ line: 1, message: "File kosong atau hanya berisi header" });
    return result;
  }
  const sep = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
  const header = splitLine(lines[0], sep).map((h) => h.toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const col = {
    name: idx("nama"),
    sku: idx("sku"),
    unit: idx("satuan"),
    cost: idx("harga_beli"),
    sell: idx("harga_jual"),
    stock: idx("stok"),
    min: idx("stok_minimum"),
  };
  if (col.name < 0) {
    result.errors.push({ line: 1, message: 'Kolom "nama" wajib ada' });
    return result;
  }
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i], sep);
    const name = cells[col.name]?.trim();
    if (!name) {
      result.errors.push({ line: i + 1, message: "Nama produk kosong" });
      continue;
    }
    const costPrice = col.cost >= 0 ? toInt(cells[col.cost]) : 0;
    const sellPrice = col.sell >= 0 ? toInt(cells[col.sell]) : 0;
    const stock = col.stock >= 0 ? toInt(cells[col.stock]) : 0;
    const minStock = col.min >= 0 ? toInt(cells[col.min]) : 0;
    if ([costPrice, sellPrice, stock, minStock].some((n) => Number.isNaN(n) || n < 0)) {
      result.errors.push({ line: i + 1, message: `Angka tidak valid untuk "${name}"` });
      continue;
    }
    result.rows.push({
      name,
      sku: (col.sku >= 0 && cells[col.sku]) || null,
      unit: (col.unit >= 0 && cells[col.unit]) || "pcs",
      costPrice,
      sellPrice,
      stock,
      minStock,
    });
  }
  return result;
}
