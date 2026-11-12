import { handle } from "@/lib/http";
import { requireOwner } from "@/lib/auth";
import { recordStockOpname } from "@/lib/transactions";

// Koreksi stok dari hitungan fisik: khusus OWNER karena mengubah angka stok secara langsung.
export async function POST(req: Request) {
  return handle(async () => {
    const s = await requireOwner();
    return recordStockOpname({ businessId: s.businessId, userId: s.userId }, await req.json());
  }, 201);
}
