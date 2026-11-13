"use client";
import { useEffect, useState } from "react";
import { api, inputCls, rp } from "@/lib/client";

interface Tx {
  id: string;
  type: "SALE" | "PURCHASE" | "STOCK_ADJUST" | "EXPENSE";
  date: string;
  total: number;
  note: string | null;
  items: { id: string; qty: number; product: { name: string; unit: string } }[];
}

const LABEL: Record<Tx["type"], { text: string; cls: string }> = {
  SALE: { text: "Penjualan", cls: "bg-emerald-100 text-emerald-800" },
  PURCHASE: { text: "Pembelian", cls: "bg-blue-100 text-blue-800" },
  EXPENSE: { text: "Pengeluaran", cls: "bg-amber-100 text-amber-800" },
  STOCK_ADJUST: { text: "Opname", cls: "bg-slate-200 text-slate-700" },
};

export default function HistoryPage() {
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<Tx[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const p = new URLSearchParams();
    if (type) p.set("type", type);
    // "sampai" inklusif: tambah 1 hari karena API memakai batas atas eksklusif
    if (from) p.set("from", new Date(from + "T00:00:00+07:00").toISOString());
    if (to) p.set("to", new Date(new Date(to + "T00:00:00+07:00").getTime() + 86_400_000).toISOString());
    api<Tx[]>(`/api/transactions?${p}`).then((r) => {
      if (r.ok) {
        setRows(r.data);
        setError("");
      } else setError(r.error);
    });
  }, [type, from, to]);

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-bold">Riwayat transaksi</h1>
      <div className="grid grid-cols-3 gap-2">
        <select value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
          <option value="">Semua</option>
          <option value="SALE">Penjualan</option>
          <option value="PURCHASE">Pembelian</option>
          <option value="EXPENSE">Pengeluaran</option>
          <option value="STOCK_ADJUST">Opname</option>
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
      </div>
      {error && <p className="text-red-600">{error}</p>}
      <ul className="space-y-2">
        {rows.length === 0 && !error && <li className="text-sm text-slate-500">Belum ada transaksi.</li>}
        {rows.map((t) => (
          <li key={t.id} className="rounded-lg bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${LABEL[t.type].cls}`}>
                {LABEL[t.type].text}
              </span>
              <span className="text-xs text-slate-500">
                {new Date(t.date).toLocaleString("id-ID", {
                  timeZone: "Asia/Jakarta",
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            </div>
            {t.items.length > 0 && (
              <p className="mt-1 text-sm text-slate-600">
                {t.items.map((i) => `${i.product.name} × ${i.qty}`).join(", ")}
              </p>
            )}
            <div className="mt-1 flex justify-between text-sm">
              <span className="text-slate-500">{t.note ?? ""}</span>
              <span className="font-semibold">{rp(t.total)}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
