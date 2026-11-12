// Data contoh untuk demo: npm run db:seed
// Login: demo@stokin.test / demo12345
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { recordExpense, recordPurchase, recordSale } from "../src/lib/transactions";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.deleteMany({ where: { email: "demo@stokin.test" } });

  const user = await prisma.user.create({
    data: {
      name: "Pemilik Demo",
      email: "demo@stokin.test",
      passwordHash: await bcrypt.hash("demo12345", 10),
      role: "OWNER",
      business: { create: { name: "Toko Demo", type: "Kelontong" } },
    },
  });
  const ctx = { businessId: user.businessId, userId: user.id };

  const seedProducts = [
    { name: "Beras 5 kg", unit: "karung", costPrice: 62000, sellPrice: 68000, stock: 20, minStock: 5 },
    { name: "Minyak goreng 1 L", unit: "botol", costPrice: 16000, sellPrice: 18500, stock: 30, minStock: 10 },
    { name: "Gula pasir 1 kg", unit: "kg", costPrice: 14000, sellPrice: 16000, stock: 25, minStock: 8 },
    { name: "Susu UHT 250 ml", unit: "kotak", costPrice: 4500, sellPrice: 6000, stock: 48, minStock: 12 },
    { name: "Mi instan", unit: "bungkus", costPrice: 2800, sellPrice: 3500, stock: 100, minStock: 30 },
  ];
  const created = [];
  for (const p of seedProducts) {
    const prod = await prisma.product.create({ data: { businessId: ctx.businessId, ...p } });
    await prisma.stockMovement.create({
      data: { productId: prod.id, qtyChange: p.stock, stockAfter: p.stock, reason: "INITIAL" },
    });
    created.push(prod);
  }

  // Beberapa transaksi nyata lewat logika inti (bukan insert manual)
  await recordSale(ctx, { items: [{ productId: created[0].id, qty: 3 }, { productId: created[3].id, qty: 12 }] });
  await recordSale(ctx, { items: [{ productId: created[4].id, qty: 40 }] });
  await recordPurchase(ctx, { items: [{ productId: created[1].id, qty: 24, unitCost: 16500 }], note: "Supplier A" });
  await recordExpense(ctx, { category: "LISTRIK", amount: 350000 });

  console.log("Seed selesai. Login: demo@stokin.test / demo12345");
}

main().finally(() => prisma.$disconnect());
