"use client";

import { useState } from "react";
import { Mail, CheckCircle } from "lucide-react";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [coupon, setCoupon] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter/suscribir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), nombre: nombre.trim() || null }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("done");
        if (data.couponCode && !data.alreadySubscribed) setCoupon(data.couponCode);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="flex flex-col items-start gap-2">
        <div className="flex items-center gap-2 text-emerald-600">
          <CheckCircle size={18} />
          <span className="text-sm font-semibold">¡Suscripto/a!</span>
        </div>
        {coupon && (
          <p className="text-sm text-gray-500">
            Tu cupón de bienvenida:{" "}
            <span className="font-bold text-emerald-700 tracking-widest">{coupon}</span>
            {" "}— ya lo enviamos a tu email.
          </p>
        )}
        {!coupon && (
          <p className="text-sm text-gray-500">Revisá tu email para ver el cupón de bienvenida.</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <h4 className="font-semibold text-sm text-gray-900 mb-1">Suscribite y obtené un descuento</h4>
      <p className="text-xs text-gray-500 mb-3">Recibí ofertas exclusivas directo en tu email.</p>
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Tu nombre (opcional)"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-emerald-400 bg-white text-gray-900"
        />
        <div className="flex gap-2">
          <div className="flex-1 flex items-center border border-gray-200 rounded-lg px-3 gap-2 bg-white">
            <Mail size={14} className="text-gray-400 shrink-0" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="flex-1 py-2 text-sm text-gray-900 outline-none bg-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={status === "loading"}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shrink-0"
          >
            {status === "loading" ? "…" : "Suscribirme"}
          </button>
        </div>
        {status === "error" && <p className="text-xs text-red-500">Error al suscribirte, intentá de nuevo.</p>}
      </form>
    </div>
  );
}
