// Helper sisi browser untuk memanggil API STOKIN.
export const rp = (n: number) => "Rp " + n.toLocaleString("id-ID");

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  costPrice: number;
  sellPrice: number;
  stock: number;
  minStock: number;
  category?: { name: string } | null;
}

export async function api<T = any>(
  url: string,
  init?: RequestInit & { json?: unknown },
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...rest.headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* respons bukan JSON */
  }
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login";
  }
  if (!body?.ok) return { ok: false, error: body?.error ?? "Terjadi kesalahan", status: res.status };
  return { ok: true, data: body.data as T };
}

export const inputCls = "w-full rounded-lg border bg-white px-3 py-2";
export const btnCls =
  "rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-50";
