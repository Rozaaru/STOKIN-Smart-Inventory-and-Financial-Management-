"use client";
import { useEffect, useState } from "react";
import { api, btnCls, inputCls, rp, type Product } from "@/lib/client";

export default function OpnamePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [counted, setCounted] = useState<Record<string, string>>({}); // productId -> teks input
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const r = await api<Product[]>("/api/products");
    if (r.ok) setProducts(r.data);
  }
  useEffect(() => {
    load();
  }, []);

  const filled = Object.entries(counted).filter(([, v]) => v !== "");
  const shown = products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  async function submit() {
    setSaving(true);
    setMsg(null);
    const r = await api<{ changed: number; totalValue: number }>("/api/transactions/opname", {
      method: "POST",
      json: {
        note: note || "Stock opname",
        items: filled.map(([productId, v]) => ({ productId, countedQty: Number(v) })),
      },
    });
    setSaving(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setCounted({});
    setNote("");
    setMsg({
      ok: true,
      text:
        r.data.changed === 0
          ? "Semua hitungan sudah sesuai sistem. Tidak ada perubahan."
          : `${r.data.changed} produk dikoreksi. Nilai selisih ${rp(r.data.totalValue)}.`,
    });
    load();
  }

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-bold">Stock opname</h1>
      <p className="text-sm text-slate-500">
        Hitung stok fisik, isi di kolom "Fisik". Produk yang dikosongkan tidak diubah. Stok sistem akan
        disamakan dengan hitungan, dan selisihnya tercatat.
      </p>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cari produk..."
        className={inputCls}
      />
      <ul className="space-y-2">
        {shown.map((p) => {
          const v = counted[p.id];
          const diff = v !== undefined && v !== "" ? Number(v) - p.stock : null;
          return (
            <li key={p.id} className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm">
              <div className="flex-1">
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-slate-500">
                  Sistem: {p.stock} {p.unit}
                </p>
              </div>
              {diff !== null && diff !== 0 && (
                <span className={`text-sm font-semibold ${diff < 0 ? "text-red-600" : "text-emerald-700"}`}>
                  {diff > 0 ? "+" : ""}
                  {diff}
                </span>
              )}
              <input
                type="number"
                min={0}
                placeholder="Fisik"
                value={v ?? ""}
                onChange={(e) => setCounted((c) => ({ ...c, [p.id]: e.target.value }))}
                className="w-20 rounded border px-2 py-1"
              />
            </li>
          );
        })}
      </ul>

      {filled.length > 0 && (
        <div className="sticky bottom-3 space-y-2 rounded-xl bg-white p-4 shadow-lg">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Catatan (opsional)"
            className={inputCls}
          />
          <button onClick={submit} disabled={saving} className={`${btnCls} w-full py-3`}>
            {saving ? "Menyimpan..." : `Simpan hasil hitung (${filled.length} produk)`}
          </button>
        </div>
      )}
      {msg && (
        <p className={msg.ok ? "text-emerald-700" : "text-red-600"} role="status">
          {msg.text}
        </p>
      )}
    </section>
  );
}
