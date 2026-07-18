"use client";

import { useState } from "react";
import Link from "next/link";
import { Store, CheckCircle2 } from "lucide-react";

export default function PortalRegistro() {
  const [f, setF] = useState({ nombre: "", empresa: "", telefono: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [listo, setListo] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const r = await fetch("/api/portal/registro", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f),
    });
    setLoading(false);
    if (r.ok) setListo(true);
    else setError((await r.json().catch(() => ({}))).error ?? "No se pudo registrar");
  }

  if (listo) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 w-full max-w-sm text-center space-y-4">
          <CheckCircle2 size={40} className="text-emerald-500 mx-auto" />
          <h1 className="text-xl font-bold text-gray-900">¡Cuenta creada!</h1>
          <p className="text-sm text-gray-500">Tu cuenta quedó <b>pendiente de aprobación</b>. Te avisamos cuando esté lista para que puedas ingresar.</p>
          <Link href="/portal/login" className="inline-block text-emerald-600 font-medium hover:underline">Volver al inicio</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center"><div className="bg-emerald-50 p-3 rounded-2xl"><Store size={28} className="text-emerald-600" /></div></div>
          <h1 className="text-2xl font-bold text-gray-900">Crear cuenta mayorista</h1>
          <p className="text-sm text-gray-500">Para comprar por mayor</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          {([["empresa", "Empresa / comercio"], ["nombre", "Tu nombre"], ["telefono", "Teléfono"], ["email", "Email"], ["password", "Contraseña (mín. 6)"]] as [keyof typeof f, string][]).map(([k, label]) => (
            <div key={k}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                type={k === "email" ? "email" : k === "password" ? "password" : "text"}
                value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })}
                required={k === "email" || k === "password"}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
          ))}
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl">
            {loading ? "Creando..." : "Crear cuenta"}
          </button>
        </form>
        <p className="text-sm text-center text-gray-500">
          ¿Ya tenés cuenta? <Link href="/portal/login" className="text-emerald-600 font-medium hover:underline">Ingresá</Link>
        </p>
      </div>
    </div>
  );
}
