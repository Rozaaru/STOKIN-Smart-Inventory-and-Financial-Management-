"use client";

export default function LogoutButton() {
  async function logout() {
    await fetch("/api/auth/login", { method: "DELETE" });
    window.location.href = "/login";
  }
  return (
    <button onClick={logout} className="ml-auto shrink-0 text-slate-500 underline">
      Keluar
    </button>
  );
}
