import { handle } from "@/lib/http";
import { requireOwner } from "@/lib/auth";
import { analyzeBusiness } from "@/lib/ai";

// POST /api/assistant : tombol "Analisis usaha saya"
export async function POST() {
  return handle(async () => {
    const s = await requireOwner();
    return analyzeBusiness(s.businessId);
  });
}
