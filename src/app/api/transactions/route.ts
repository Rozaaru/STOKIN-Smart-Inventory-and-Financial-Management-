import { handle } from "@/lib/http";
import { requireSession } from "@/lib/auth";
import { listTransactions } from "@/lib/reports";
import type { TransactionType } from "@prisma/client";

// GET /api/transactions?type=SALE&from=2026-11-01&to=2026-11-30
export async function GET(req: Request) {
  return handle(async () => {
    const s = await requireSession();
    const sp = new URL(req.url).searchParams;
    const type = sp.get("type") as TransactionType | null;
    const from = sp.get("from") ? new Date(sp.get("from")!) : undefined;
    const to = sp.get("to") ? new Date(sp.get("to")!) : undefined;
    return listTransactions(s.businessId, { type: type ?? undefined, from, to });
  });
}
