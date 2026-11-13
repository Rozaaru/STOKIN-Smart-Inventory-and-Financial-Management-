"use client";
import { useEffect, useState } from "react";
import { api, btnCls, inputCls, rp, type Product } from "@/lib/client";

interface Line {
  qty: number;
  unitCost: number;
}

export default function PurchasePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [lines, setLines] = useState<Record<string, Line>>({});
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

  const byId = new Map(products.map((p) => [p.id, p]));
  const results = products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  const total = Object.values(lines).reduce((s, l) => s + l.qty * l.unitCost, 0);

  const add = (p: Product) =>
    setLines((c) => ({ ...c, [p.id]: c[p.id] ?? { qty: 1, unitCost: p.costPrice } }));
  const patch = (id: string, v: Partial<Line>) =>
    setLines((c) => ({ ...c, [id]: { ...c[id], ...v } }));
  const remove = (id: string) =>
    setLines((c) => {
      const n = { ...c };
      delete n[id];
      return n;
    });

  async function submit() {
    setSaving(true);
    setMsg(null);
    const r = await api<{ total: number }>("/api/transactions/purchase", {
      method: "POST",
      json: {
        note: note || undefined,
        items: Object.entries(lines).map(([productId, l]) => ({
          productId,
          qty: l.qty,
          unitCost: l.unitCost,
        })),
      },
    });
    setSaving(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setLines({});
    setNote("");
    setQ("");
    setMsg({ ok: true, text: `Pembelian ${rp(r.data.total)} tersimpan. Stok sudah bertambah.` });
    load();
  }

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-bold">Stok masuk (pembelian)</h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cari produk..."
        className={inputCls}
      />
      <ul className="space-y-2">
        {results.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => add(p)}
              className="flex w-full justify-between rounded-lg bg-white p-3 text-left shadow-sm"
            >
              <span>{p.name}</span>
              <span className="text-sm text-slate-500">stok {p.stock}</span>
            </button>
          </li>
        ))}
      </ul>

      {Object.keys(lines).length > 0 && (
        <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Daftar pembelian</h2>
          {Object.entries(lines).map(([id, l]) => (
            <div key={id} className="space-y-1 border-b pb-3 text-sm last:border-0">
              <div className="flex justify-between">
                <span className="font-medium">{byId.get(id)?.name}</span>
                <button onClick={() => remove(id)} className="text-red-600">
                  Hapus
                </button>
              </div>
              <div className="grid grid-cols-3 items-end gap-2">
                <label className="text-xs text-slate-500">
                  Jumlah
                  <input
                    type="number"
                    min={1}
                    value={l.qty}
                    onChange={(e) => patch(id, { qty: Number(e.target.value) })}
                    className={inputCls}
                  />
                </label>
                <label className="text-xs text-slate-500">
                  Harga beli / {byId.get(id)?.unit}
                  <input
                    type="number"
                    min={0}
                    value={l.unitCost}
                    onChange={(e) => patch(id, { unitCost: Number(e.target.value) })}
                    className={inputCls}
                  />
                </label>
                <span className="pb-2 text-right">{rp(l.qty * l.unitCost)}</span>
              </div>
            </div>
          ))}
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Catatan / nama supplier (opsional)"
            className={inputCls}
          />
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{rp(total)}</span>
          </div>
          <button
            onClick={submit}
            disabled={saving || Object.values(lines).some((l) => l.qty < 1)}
            className={`${btnCls} w-full py-3`}
          >
            {saving ? "Menyimpan..." : "Simpan pembelian"}
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
