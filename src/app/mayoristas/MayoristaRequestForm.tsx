"use client";

import { useState } from "react";
import { Check } from "lucide-react";

export function MayoristaRequestForm() {
  const [form, setForm] = useState({ nombre: "", empresa: "", telefono: "", email: "", mensaje: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  function set(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre || !form.telefono || !form.email) {
      setError("Completá nombre, teléfono y email.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/mayorista-solicitud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      setSent(true);
    } catch {
      setError("Hubo un error. Intentá de nuevo o escribinos por WhatsApp.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center py-10 space-y-3">
        <div className="w-14 h-14 bg-amber-500 rounded-full flex items-center justify-center mx-auto">
          <Check size={28} className="text-black" />
        </div>
        <h3 className="text-xl font-bold">¡Solicitud enviada!</h3>
        <p className="text-white/60 text-sm">Te contactamos en menos de 24 horas hábiles.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {[
        { key: "nombre", label: "Nombre y apellido", placeholder: "Juan Pérez", required: true },
        { key: "empresa", label: "Empresa / local", placeholder: "Bazar El Hornero (opcional)" },
        { key: "telefono", label: "Teléfono / WhatsApp", placeholder: "+54 9 11 1234-5678", required: true },
        { key: "email", label: "Email", placeholder: "juan@ejemplo.com", required: true },
      ].map(({ key, label, placeholder, required }) => (
        <div key={key}>
          <label className="text-sm text-white/70 block mb-1">{label}{required && " *"}</label>
          <input
            value={form[key as keyof typeof form]}
            onChange={e => set(key as keyof typeof form, e.target.value)}
            placeholder={placeholder}
            className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
          />
        </div>
      ))}

      <div>
        <label className="text-sm text-white/70 block mb-1">Mensaje (opcional)</label>
        <textarea
          value={form.mensaje}
          onChange={e => set("mensaje", e.target.value)}
          placeholder="¿Qué productos te interesan? ¿Tenés local físico?"
          rows={3}
          className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 resize-none"
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={sending}
        className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition-colors"
      >
        {sending ? "Enviando..." : "Enviar solicitud"}
      </button>

      <p className="text-white/40 text-xs text-center">
        Tus datos son confidenciales y solo se usan para contactarte.
      </p>
    </form>
  );
}
