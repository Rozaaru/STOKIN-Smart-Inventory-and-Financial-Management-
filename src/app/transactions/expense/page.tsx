"use client";
import { useState } from "react";
import { api, btnCls, inputCls, rp } from "@/lib/client";

const CATEGORIES = ["LISTRIK", "GAJI", "SEWA", "TRANSPORT", "AIR", "INTERNET", "LAINNYA"];

export default function ExpensePage() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setSaving(true);
    const r = await api<{ total: number }>("/api/transactions/expense", {
      method: "POST",
      json: { category: f.category, amount: Number(f.amount), note: f.note || undefined },
    });
    setSaving(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    form.reset();
    setMsg({ ok: true, text: `Pengeluaran ${rp(r.data.total)} tersimpan.` });
  }

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-bold">Catat pengeluaran</h1>
      <p className="text-sm text-slate-500">
        Untuk biaya operasional (listrik, gaji, sewa). Pembelian barang dicatat lewat menu Beli.
      </p>
      <form onSubmit={submit} className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
        <select name="category" className={inputCls}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.charAt(0) + c.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <input name="amount" type="number" min={1} required placeholder="Jumlah (Rp)" className={inputCls} />
        <input name="note" placeholder="Catatan (opsional)" className={inputCls} />
        <button disabled={saving} className={`${btnCls} w-full py-3`}>
          {saving ? "Menyimpan..." : "Simpan pengeluaran"}
        </button>
      </form>
      {msg && (
        <p className={msg.ok ? "text-emerald-700" : "text-red-600"} role="status">
          {msg.text}
        </p>
      )}
    </section>
  );
}
