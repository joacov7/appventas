"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Store } from "lucide-react";

export default function PortalLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const r = await fetch("/api/portal/login", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (r.ok) router.push("/portal");
    else setError((await r.json().catch(() => ({}))).error ?? "No se pudo ingresar");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center"><div className="bg-emerald-50 p-3 rounded-2xl"><Store size={28} className="text-emerald-600" /></div></div>
          <h1 className="text-2xl font-bold text-gray-900">Regionales por Mayor</h1>
          <p className="text-sm text-gray-500">Portal mayorista</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl">
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
        <div className="pt-2 border-t text-center space-y-2">
          <p className="text-sm text-gray-500">¿Todavía no tenés cuenta mayorista?</p>
          <Link href="/portal/registro"
            className="block w-full border border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-medium py-2.5 rounded-xl">
            Crear cuenta mayorista
          </Link>
        </div>
      </div>
    </div>
  );
}
