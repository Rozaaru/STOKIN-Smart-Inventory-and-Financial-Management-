import { prisma } from "@/lib/prisma";
import { handle } from "@/lib/http";
import { requireOwner, requireSession } from "@/lib/auth";
import { productSchema } from "@/lib/schemas";
import { AppError } from "@/lib/errors";

// GET /api/products?q=susu&lowStock=1
export async function GET(req: Request) {
  return handle(async () => {
    const s = await requireSession();
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim();
    const lowOnly = url.searchParams.get("lowStock") === "1";

    const products = await prisma.product.findMany({
      where: {
        businessId: s.businessId,
        isActive: true,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { sku: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { category: { select: { name: true } } },
      orderBy: { name: "asc" },
      take: 500,
    });
    // Filter stok menipis di aplikasi (membandingkan dua kolom)
    return lowOnly ? products.filter((p) => p.stock <= p.minStock) : products;
  });
}

// POST /api/products : tambah produk (khusus OWNER). Stok awal dicatat sebagai pergerakan INITIAL.
export async function POST(req: Request) {
  return handle(async () => {
    const s = await requireOwner();
    const input = productSchema.parse(await req.json());

    if (input.sku) {
      const dup = await prisma.product.findFirst({
        where: { businessId: s.businessId, sku: input.sku },
        select: { id: true },
      });
      if (dup) throw new AppError(`SKU "${input.sku}" sudah dipakai`, 409, "SKU_TAKEN");
    }

    return prisma.$transaction(async (tx) => {
      const category = input.categoryName
        ? await tx.category.upsert({
            where: { businessId_name: { businessId: s.businessId, name: input.categoryName } },
            update: {},
            create: { businessId: s.businessId, name: input.categoryName },
          })
        : null;

      const product = await tx.product.create({
        data: {
          businessId: s.businessId,
          categoryId: category?.id,
          name: input.name,
          sku: input.sku || null,
          unit: input.unit,
          costPrice: input.costPrice,
          sellPrice: input.sellPrice,
          stock: input.stock,
          minStock: input.minStock,
        },
      });
      if (input.stock > 0) {
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            qtyChange: input.stock,
            stockAfter: input.stock,
            reason: "INITIAL",
          },
        });
      }
      return product;
    });
  }, 201);
}
