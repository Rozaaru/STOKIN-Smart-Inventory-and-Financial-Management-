import { handle } from "@/lib/http";
import { requireOwner } from "@/lib/auth";
import { recordExpense } from "@/lib/transactions";

// Pengeluaran operasional: khusus OWNER (STAFF tidak mengelola keuangan).
export async function POST(req: Request) {
  return handle(async () => {
    const s = await requireOwner();
    return recordExpense({ businessId: s.businessId, userId: s.userId }, await req.json());
  }, 201);
}
