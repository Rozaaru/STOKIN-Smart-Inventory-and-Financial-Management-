import { prisma } from "@/lib/prisma";
import { handle } from "@/lib/http";
import { requireOwner } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { parseProductCsv } from "@/lib/csv";

// POST /api/products/import (body: teks CSV mentah, Content-Type: text/csv)
// Kolom: nama,sku,satuan,harga_beli,harga_jual,stok,stok_minimum
// Semua baris valid diimpor atau tidak sama sekali; baris yang salah dilaporkan dan tidak menggagalkan baris lain
// jika `?skipInvalid=1`, selain itu seluruh impor ditolak bila ada baris salah.
export async function POST(req: Request) {
  return handle(async () => {
    const s = await requireOwner();
    const skipInvalid = new URL(req.url).searchParams.get("skipInvalid") === "1";
    const parsed = parseProductCsv(await req.text());

    if (parsed.errors.length > 0 && !skipInvalid) {
      throw new AppError(
        `Ada ${parsed.errors.length} baris bermasalah. Contoh: baris ${parsed.errors[0].line}, ${parsed.errors[0].message}`,
        422,
        "CSV_INVALID",
      );
    }
    if (parsed.rows.length === 0) throw new AppError("Tidak ada baris produk yang valid", 422);

    const created = await prisma.$transaction(async (tx) => {
      let count = 0;
      for (const r of parsed.rows) {
        // Lewati SKU yang sudah ada
        if (r.sku) {
          const dup = await tx.product.findFirst({
            where: { businessId: s.businessId, sku: r.sku },
            select: { id: true },
          });
          if (dup) continue;
        }
        const p = await tx.product.create({
          data: { businessId: s.businessId, ...r },
        });
        if (r.stock > 0) {
          await tx.stockMovement.create({
            data: { productId: p.id, qtyChange: r.stock, stockAfter: r.stock, reason: "INITIAL" },
          });
        }
        count++;
      }
      return count;
    }, { timeout: 30_000 });

    return { imported: created, skipped: parsed.rows.length - created, errors: parsed.errors };
  }, 201);
}
