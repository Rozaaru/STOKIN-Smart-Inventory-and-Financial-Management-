"use client";
import { useCallback, useEffect, useState } from "react";
import { api, btnCls, inputCls, rp, type Product } from "@/lib/client";

const CSV_TEMPLATE =
  "nama,sku,satuan,harga_beli,harga_jual,stok,stok_minimum\nBeras 5 kg,BRS5,karung,62000,68000,20,5\n";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (lowOnly) params.set("lowStock", "1");
    const r = await api<Product[]>(`/api/products?${params}`);
    if (r.ok) setProducts(r.data);
  }, [q, lowOnly]);

  useEffect(() => {
    const t = setTimeout(load, 250); // jeda singkat saat mengetik
    return () => clearTimeout(t);
  }, [load]);

  async function addProduct(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setBusy(true);
    const r = await api("/api/products", {
      method: "POST",
      json: {
        name: f.name,
        sku: f.sku || null,
        unit: f.unit || "pcs",
        categoryName: f.categoryName || undefined,
        costPrice: Number(f.costPrice || 0),
        sellPrice: Number(f.sellPrice || 0),
        stock: Number(f.stock || 0),
        minStock: Number(f.minStock || 0),
      },
    });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    form.reset();
    setShowForm(false);
    setMsg({ ok: true, text: "Produk ditambahkan." });
    load();
  }

  async function importCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    const text = await file.text();
    const r = await api<{ imported: number; skipped: number; errors: { line: number; message: string }[] }>(
      "/api/products/import?skipInvalid=1",
      { method: "POST", body: text, headers: { "content-type": "text/csv" } },
    );
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    const { imported, skipped, errors } = r.data;
    setMsg({
      ok: errors.length === 0,
      text:
        `${imported} produk diimpor, ${skipped} dilewati (SKU sudah ada).` +
        (errors.length
          ? ` ${errors.length} baris bermasalah: ` +
            errors.slice(0, 3).map((x) => `baris ${x.line} (${x.message})`).join("; ")
          : ""),
    });
    load();
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "template-produk.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Produk</h1>
        <button onClick={() => setShowForm((v) => !v)} className={btnCls}>
          {showForm ? "Tutup" : "+ Produk"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={addProduct} className="grid grid-cols-2 gap-3 rounded-xl bg-white p-4 shadow-sm">
          <input name="name" placeholder="Nama produk" required className={`${inputCls} col-span-2`} />
          <input name="sku" placeholder="SKU (opsional)" className={inputCls} />
          <input name="unit" placeholder="Satuan (pcs)" className={inputCls} />
          <input name="categoryName" placeholder="Kategori (opsional)" className={`${inputCls} col-span-2`} />
          <label className="text-xs text-slate-500">
            Harga beli
            <input name="costPrice" type="number" min={0} defaultValue={0} className={inputCls} />
          </label>
          <label className="text-xs text-slate-500">
            Harga jual
            <input name="sellPrice" type="number" min={0} defaultValue={0} className={inputCls} />
          </label>
          <label className="text-xs text-slate-500">
            Stok awal
            <input name="stock" type="number" min={0} defaultValue={0} className={inputCls} />
          </label>
          <label className="text-xs text-slate-500">
            Stok minimum
            <input name="minStock" type="number" min={0} defaultValue={0} className={inputCls} />
          </label>
          <button disabled={busy} className={`${btnCls} col-span-2`}>
            Simpan produk
          </button>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className={`${btnCls} cursor-pointer bg-slate-700`}>
          Impor CSV
          <input type="file" accept=".csv,text/csv" onChange={importCsv} className="hidden" />
        </label>
        <button onClick={downloadTemplate} className="text-slate-500 underline">
          Unduh template CSV
        </button>
      </div>

      {msg && (
        <p className={msg.ok ? "text-emerald-700" : "text-red-600"} role="status">
          {msg.text}
        </p>
      )}

      <div className="flex gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama atau SKU..."
          className={inputCls}
        />
        <label className="flex shrink-0 items-center gap-2 text-sm">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
          Stok menipis
        </label>
      </div>

      <ul className="space-y-2">
        {products.length === 0 && <li className="text-sm text-slate-500">Belum ada produk.</li>}
        {products.map((p) => {
          const low = p.stock <= p.minStock;
          return (
            <li key={p.id} className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm">
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-slate-500">
                  {p.sku ? `${p.sku} · ` : ""}
                  beli {rp(p.costPrice)} · jual {rp(p.sellPrice)}
                </p>
              </div>
              <div className={`text-right text-sm ${low ? "font-semibold text-red-600" : ""}`}>
                {p.stock} {p.unit}
                {low && <p className="text-xs">min {p.minStock}</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
