"use client";
import { useEffect, useMemo, useState } from "react";

interface Product {
  id: string;
  name: string;
  unit: string;
  sellPrice: number;
  stock: number;
}

const rp = (n: number) => "Rp " + n.toLocaleString("id-ID");

export default function SalePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({}); // productId -> qty
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/products");
    const json = await res.json();
    if (json.ok) setProducts(json.data);
    else if (res.status === 401) window.location.href = "/login";
  }
  useEffect(() => {
    load();
  }, []);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const results = products
    .filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 8);
  const total = Object.entries(cart).reduce(
    (s, [id, qty]) => s + (byId.get(id)?.sellPrice ?? 0) * qty,
    0,
  );

  const add = (p: Product) =>
    setCart((c) => ({ ...c, [p.id]: Math.min((c[p.id] ?? 0) + 1, p.stock) }));
  const setQty = (id: string, qty: number) =>
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });

  async function submit() {
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/transactions/sale", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: Object.entries(cart).map(([productId, qty]) => ({ productId, qty })),
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!json.ok) return setMsg({ ok: false, text: json.error });
    setCart({});
    setQ("");
    setMsg({
      ok: true,
      text:
        `Penjualan ${rp(json.data.total)} tersimpan.` +
        (json.data.lowStock.length ? ` Stok menipis: ${json.data.lowStock.join(", ")}` : ""),
    });
    load(); // segarkan stok
  }

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-bold">Catat penjualan</h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cari produk..."
        className="w-full rounded-lg border bg-white px-3 py-3"
      />
      <ul className="space-y-2">
        {results.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => add(p)}
              disabled={p.stock <= 0}
              className="flex w-full justify-between rounded-lg bg-white p-3 text-left shadow-sm disabled:opacity-40"
            >
              <span>{p.name}</span>
              <span className="text-sm text-slate-500">
                {rp(p.sellPrice)} · stok {p.stock}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {Object.keys(cart).length > 0 && (
        <div className="space-y-2 rounded-xl bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Keranjang</h2>
          {Object.entries(cart).map(([id, qty]) => (
            <div key={id} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex-1">{byId.get(id)?.name}</span>
              <input
                type="number"
                min={0}
                max={byId.get(id)?.stock}
                value={qty}
                onChange={(e) => setQty(id, Number(e.target.value))}
                className="w-16 rounded border px-2 py-1"
              />
              <span className="w-24 text-right">{rp((byId.get(id)?.sellPrice ?? 0) * qty)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t pt-2 font-semibold">
            <span>Total</span>
            <span>{rp(total)}</span>
          </div>
          <button
            onClick={submit}
            disabled={saving}
            className="w-full rounded-lg bg-emerald-600 py-3 font-medium text-white disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "Simpan penjualan"}
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
