import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDashboard, getLowStock } from "@/lib/reports";
import { jakartaRange } from "@/lib/money";

export const dynamic = "force-dynamic";

const rp = (n: number) => "Rp " + n.toLocaleString("id-ID");

function Card({ label, value, tone }: { label: string; value: string; tone?: "bad" | "good" }) {
  const color = tone === "bad" ? "text-red-600" : tone === "good" ? "text-emerald-700" : "";
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${color}`}>{value}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const s = await getSession();
  if (!s) redirect("/login");

  // STAFF tidak melihat keuangan, hanya stok menipis
  if (s.role !== "OWNER") {
    const low = await getLowStock(s.businessId);
    return (
      <section>
        <h1 className="mb-3 text-xl font-bold">Stok menipis</h1>
        <ul className="space-y-2">
          {low.map((p) => (
            <li key={p.id} className="rounded-lg bg-white p-3">
              {p.name}: sisa {p.stock} {p.unit}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const { summary, top, lowStock, stockValue } = await getDashboard(
    s.businessId,
    jakartaRange("month"),
  );

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-bold">Ringkasan bulan ini</h1>
      <div className="grid grid-cols-2 gap-3">
        <Card label="Pendapatan" value={rp(summary.revenue)} />
        <Card label="Biaya operasional" value={rp(summary.operatingExpenses)} />
        <Card label="Laba kotor" value={rp(summary.grossProfit)} />
        <Card
          label="Estimasi laba bersih"
          value={rp(summary.netProfit)}
          tone={summary.netProfit < 0 ? "bad" : "good"}
        />
        <Card label="Belanja stok (arus kas)" value={rp(summary.stockPurchases)} />
        <Card label="Nilai stok saat ini" value={rp(stockValue.value)} />
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-semibold">Produk terlaris</h2>
        {top.length === 0 && <p className="text-sm text-slate-500">Belum ada penjualan.</p>}
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {top.map((t) => (
            <li key={t.productId}>
              {t.name}: {t.qty} terjual ({rp(t.revenue)})
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-semibold">Stok menipis ({lowStock.length})</h2>
        {lowStock.length === 0 && <p className="text-sm text-slate-500">Semua stok aman.</p>}
        <ul className="space-y-1 text-sm">
          {lowStock.map((p) => (
            <li key={p.id} className="flex justify-between">
              <span>{p.name}</span>
              <span className="text-red-600">
                sisa {p.stock} {p.unit} (min {p.minStock})
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
