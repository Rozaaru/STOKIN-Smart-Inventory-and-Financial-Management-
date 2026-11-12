/**
 * Asisten AI. Prinsip: ANGKA dihitung backend, LLM hanya menafsirkan.
 * LLM tidak pernah diminta menghitung atau menebak angka.
 */
import { jakartaRange } from "./money";
import {
  getFinancialSummary,
  getLowStock,
  getSlowMovers,
  getStockValue,
  getTopProducts,
} from "./reports";

export async function buildBusinessSnapshot(businessId: string) {
  const now = new Date();
  const to = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const last30 = { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), to };
  const month = jakartaRange("month", now);

  const [last30Summary, monthSummary, top, slow, low, stockValue] = await Promise.all([
    getFinancialSummary(businessId, last30),
    getFinancialSummary(businessId, month),
    getTopProducts(businessId, last30, 5),
    getSlowMovers(businessId, last30, 5),
    getLowStock(businessId),
    getStockValue(businessId),
  ]);

  return {
    periodeAnalisis: "30 hari terakhir",
    mataUang: "IDR",
    ringkasan30Hari: last30Summary,
    ringkasanBulanIni: monthSummary,
    produkTerlaris30Hari: top.map((t) => ({
      nama: t.name,
      terjual: t.qty,
      pendapatan: t.revenue,
      rataRataPerMinggu: Math.round((t.qty / 30) * 7),
    })),
    produkTidakLakuNamunAdaStok: slow,
    stokMenipis: low.slice(0, 10),
    nilaiStok: stockValue,
  };
}

const SYSTEM_PROMPT = `Kamu adalah asisten usaha untuk pemilik UMKM di Indonesia (toko kelontong, retail kecil, usaha makanan).
Kamu menerima data ringkasan usaha dalam JSON yang sudah dihitung oleh sistem.

Aturan:
- Gunakan HANYA angka yang ada di JSON. Jangan menghitung ulang, menebak, atau mengarang angka.
- Jika data kurang untuk menyimpulkan sesuatu, katakan terus terang.
- Tulis dalam bahasa Indonesia yang sederhana, tanpa istilah akuntansi rumit.
- Format rupiah: Rp 1.250.000.
- Keluaran: maksimal 5 butir rekomendasi, urut dari yang paling mendesak. Tiap butir 1-2 kalimat dan menyebut produk/angka konkret.
- Rekomendasi restock: sebutkan produk, sisa stok, dan perkiraan kebutuhan berdasarkan "rataRataPerMinggu".
- Jangan memberi nasihat hukum atau pajak.`;

export async function analyzeBusiness(businessId: string) {
  const snapshot = await buildBusinessSnapshot(businessId);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Tanpa API key, aplikasi tetap berguna: kembalikan angka mentah.
    return { analysis: null, snapshot, note: "ANTHROPIC_API_KEY belum diatur" };
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL ?? "claude-haiku-5-5",
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Berikut data usaha saya (JSON). Analisis dan beri rekomendasi.\n\n${JSON.stringify(snapshot)}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`AI API error ${res.status}: ${detail.slice(0, 200)}`);
  }
  const json = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (json.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n")
    .trim();
  return { analysis: text, snapshot };
}
