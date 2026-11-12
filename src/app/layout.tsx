import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "STOKIN",
  description: "Stok dan keuangan usaha dalam satu aplikasi",
};

// Mobile-first: pengguna utama membuka dari HP di toko.
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <header className="border-b bg-white">
          <nav className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3 text-sm">
            <a href="/dashboard" className="text-lg font-bold text-emerald-700">
              STOKIN
            </a>
            <a href="/dashboard" className="text-slate-600">Dashboard</a>
            <a href="/transactions/sale" className="text-slate-600">Jual</a>
          </nav>
        </header>
        <main className="mx-auto max-w-3xl p-4">{children}</main>
      </body>
    </html>
  );
}
