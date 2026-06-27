"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle, Mail } from "lucide-react";

const FRECUENCIAS = [
  { dias: 15, label: "Cada 15 días" },
  { dias: 30, label: "Cada mes" },
  { dias: 60, label: "Cada 2 meses" },
  { dias: 90, label: "Cada 3 meses" },
];

interface Props {
  variantId: string;
  productName: string;
  variantName: string;
  productSlug: string;
}

export function SubscribeReposicion({ variantId, productName, variantName, productSlug }: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [frecuencia, setFrecuencia] = useState(30);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/suscripciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          variantId,
          productName,
          variantName,
          productSlug,
          quantity: cantidad,
          frecuenciaDias: frecuencia,
        }),
      });
      setStatus(res.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
        <CheckCircle size={18} className="text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-emerald-800">¡Suscripción activada!</p>
          <p className="text-xs text-emerald-600 mt-0.5">
            Te vamos a recordar reponer {productName} cada {frecuencia} días en {email}.
          </p>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-emerald-600 transition-colors"
      >
        <RefreshCw size={14} />
        ¿Lo usás seguido? Suscribite y te avisamos cuándo reponer
      </button>
    );
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw size={15} className="text-emerald-600" />
          <span className="text-sm font-semibold text-gray-800">Recordatorio de reposición</span>
        </div>
        <button onClick={() => setOpen(false)} className="text-xs text-gray-400 hover:text-gray-600">Cerrar</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex items-center border border-gray-200 rounded-lg px-3 gap-2">
          <Mail size={13} className="text-gray-400 shrink-0" />
          <input
            type="email" required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className="flex-1 py-2 text-sm text-gray-900 outline-none bg-transparent"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Cantidad habitual</label>
            <input
              type="number" min="1" max="99"
              value={cantidad}
              onChange={(e) => setCantidad(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Frecuencia</label>
            <select
              value={frecuencia}
              onChange={(e) => setFrecuencia(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-400 bg-white text-gray-900"
            >
              {FRECUENCIAS.map((f) => (
                <option key={f.dias} value={f.dias}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>

        {status === "error" && <p className="text-xs text-red-500">Error al suscribirse, intentá de nuevo.</p>}

        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
        >
          {status === "loading" ? "Activando…" : "Activar recordatorio"}
        </button>
      </form>
    </div>
  );
}
