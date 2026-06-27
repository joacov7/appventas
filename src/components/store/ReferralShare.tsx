"use client";

import { useState } from "react";
import { Gift, Copy, Check, MessageCircle } from "lucide-react";

interface Props {
  email: string;
}

export function ReferralShare({ email }: Props) {
  const [codigo, setCodigo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const referralLink = codigo ? `${appUrl}/checkout?ref=${codigo}` : null;

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch("/api/referidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.codigo) setCodigo(data.codigo);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function buildWaMessage() {
    return `¡Te recomiendo esta tienda! Usá mi link y obtenés un descuento especial en tu primera compra: ${referralLink}`;
  }

  const waNumber = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");

  if (!codigo) {
    return (
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-5 text-center space-y-3">
        <div className="flex justify-center">
          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
            <Gift size={20} className="text-emerald-600" />
          </div>
        </div>
        <div>
          <p className="font-semibold text-gray-900">¡Ganá con tus referidos!</p>
          <p className="text-sm text-gray-500 mt-1">
            Compartí tu link y cada amigo que compre usando tu código obtiene un descuento especial.
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
        >
          {loading ? "Generando…" : "Obtener mi link"}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Gift size={16} className="text-emerald-600" />
        <p className="font-semibold text-gray-900 text-sm">Tu link de referido</p>
      </div>
      <div className="flex gap-2">
        <div className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-600 font-mono truncate">
          {referralLink}
        </div>
        <button
          onClick={handleCopy}
          className="shrink-0 p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition-colors"
          title="Copiar link"
        >
          {copied ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
        </button>
      </div>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(buildWaMessage())}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-semibold py-2.5 rounded-xl transition-colors w-full"
      >
        <MessageCircle size={15} fill="white" strokeWidth={0} />
        Compartir por WhatsApp
      </a>
      <p className="text-xs text-gray-400 text-center">
        Código: <span className="font-bold text-emerald-700">{codigo}</span> — Tus amigos obtienen {process.env.NEXT_PUBLIC_REFERIDOS_DESCUENTO_PCT ?? "10"}% de descuento
      </p>
    </div>
  );
}
