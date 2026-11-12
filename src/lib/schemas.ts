import { z } from "zod";

const qty = z.number().int().positive("Jumlah harus lebih dari 0");
const rupiah = z.number().int().min(0, "Harga tidak boleh negatif");
const optionalDate = z.coerce.date().optional();

export const saleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty,
        // Jika kosong, pakai harga jual produk. Isi untuk harga khusus/tawar.
        unitPrice: rupiah.optional(),
      }),
    )
    .min(1, "Keranjang kosong"),
  date: optionalDate,
  note: z.string().max(500).optional(),
});

export const purchaseSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty,
        unitCost: rupiah, // harga beli per satuan
        newSellPrice: rupiah.optional(), // opsional: sekalian update harga jual
      }),
    )
    .min(1, "Daftar pembelian kosong"),
  date: optionalDate,
  note: z.string().max(500).optional(), // mis. nama supplier
});

export const expenseSchema = z.object({
  category: z.string().min(1).max(50), // LISTRIK, GAJI, SEWA, LAINNYA ...
  amount: z.number().int().positive("Jumlah harus lebih dari 0"),
  date: optionalDate,
  note: z.string().max(500).optional(),
});

export const opnameSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        countedQty: z.number().int().min(0), // stok fisik hasil hitung
      }),
    )
    .min(1),
  date: optionalDate,
  note: z.string().max(500).optional(),
});

export const productSchema = z.object({
  name: z.string().min(1).max(120),
  sku: z.string().max(60).optional().nullable(),
  unit: z.string().max(20).default("pcs"),
  categoryName: z.string().max(60).optional(),
  costPrice: rupiah.default(0),
  sellPrice: rupiah.default(0),
  stock: z.number().int().min(0).default(0), // stok awal
  minStock: z.number().int().min(0).default(0),
});

export const registerSchema = z.object({
  businessName: z.string().min(2).max(100),
  businessType: z.string().max(50).optional(),
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8, "Password minimal 8 karakter"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type SaleInput = z.infer<typeof saleSchema>;
export type PurchaseInput = z.infer<typeof purchaseSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type OpnameInput = z.infer<typeof opnameSchema>;
export type ProductInput = z.infer<typeof productSchema>;
