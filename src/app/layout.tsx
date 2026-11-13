import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getSession } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";

export const metadata: Metadata = {
  title: "STOKIN",
  description: "Stok dan keuangan usaha dalam satu aplikasi",
};

// Mobile-first: pengguna utama membuka dari HP di toko.
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

const STAFF_LINKS = [
  ["/dashboard", "Beranda"],
  ["/transactions/sale", "Jual"],
  ["/transactions/purchase", "Beli"],
  ["/products", "Produk"],
  ["/transactions", "Riwayat"],
];
const OWNER_EXTRA = [
  ["/transactions/expense", "Biaya"],
  ["/transactions/opname", "Opname"],
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const links = session?.role === "OWNER" ? [...STAFF_LINKS, ...OWNER_EXTRA] : STAFF_LINKS;

  return (
    <html lang="id">
      <body>
        {session && (
          <header className="border-b bg-white">
            <nav className="mx-auto flex max-w-3xl items-center gap-4 overflow-x-auto px-4 py-3 text-sm whitespace-nowrap">
              <a href="/dashboard" className="text-lg font-bold text-emerald-700">
                STOKIN
              </a>
              {links.map(([href, label]) => (
                <a key={href} href={href} className="text-slate-600 hover:text-emerald-700">
                  {label}
                </a>
              ))}
              <LogoutButton />
            </nav>
          </header>
        )}
        <main className="mx-auto max-w-3xl p-4">{children}</main>
      </body>
    </html>
  );
}
