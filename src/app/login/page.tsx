"use client";
import { useState } from "react";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const f = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(f),
    });
    const json = await res.json();
    setLoading(false);
    if (!json.ok) return setError(json.error);
    window.location.href = "/dashboard";
  }

  const input = "w-full rounded-lg border px-3 py-2";
  return (
    <div className="mx-auto mt-8 max-w-sm rounded-xl bg-white p-6 shadow-sm">
      <h1 className="mb-4 text-xl font-bold">{mode === "login" ? "Masuk" : "Daftarkan usaha"}</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        {mode === "register" && (
          <>
            <input name="businessName" placeholder="Nama usaha" required className={input} />
            <input name="name" placeholder="Nama Anda" required className={input} />
          </>
        )}
        <input name="email" type="email" placeholder="Email" required className={input} />
        <input
          name="password"
          type="password"
          placeholder="Password (min. 8 karakter)"
          required
          className={input}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          disabled={loading}
          className="w-full rounded-lg bg-emerald-600 py-2 font-medium text-white disabled:opacity-50"
        >
          {loading ? "Memproses..." : mode === "login" ? "Masuk" : "Daftar"}
        </button>
      </form>
      <button
        onClick={() => setMode(mode === "login" ? "register" : "login")}
        className="mt-4 text-sm text-slate-500 underline"
      >
        {mode === "login" ? "Belum punya akun? Daftar" : "Sudah punya akun? Masuk"}
      </button>
    </div>
  );
}
