import { handle } from "@/lib/http";
import { requireSession } from "@/lib/auth";
import { recordSale } from "@/lib/transactions";

// OWNER dan STAFF boleh mencatat penjualan.
export async function POST(req: Request) {
  return handle(async () => {
    const s = await requireSession();
    return recordSale({ businessId: s.businessId, userId: s.userId }, await req.json());
  }, 201);
}
