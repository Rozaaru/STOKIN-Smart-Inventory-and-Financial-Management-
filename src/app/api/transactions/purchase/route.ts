import { handle } from "@/lib/http";
import { requireSession } from "@/lib/auth";
import { recordPurchase } from "@/lib/transactions";

export async function POST(req: Request) {
  return handle(async () => {
    const s = await requireSession();
    return recordPurchase({ businessId: s.businessId, userId: s.userId }, await req.json());
  }, 201);
}
