import { handle } from "@/lib/http";
import { requireOwner } from "@/lib/auth";
import { getDashboard } from "@/lib/reports";
import { jakartaRange } from "@/lib/money";

// GET /api/dashboard?period=today|month  (laporan keuangan: khusus OWNER)
export async function GET(req: Request) {
  return handle(async () => {
    const s = await requireOwner();
    const p = new URL(req.url).searchParams.get("period") === "today" ? "today" : "month";
    return getDashboard(s.businessId, jakartaRange(p));
  });
}
