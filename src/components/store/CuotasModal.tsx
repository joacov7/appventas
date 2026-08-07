"use client";

import { useState, useEffect } from "react";
import { X, CreditCard, Loader2 } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { InstallmentOption } from "@/app/api/pagos/cuotas/route";

interface Props {
  price: number;
  onClose: () => void;
}

const CARD_LOGOS: Record<string, string> = {
  visa: "https://http2.mlstatic.com/storage/logos-api-admin/1ad5e690-bb3e-11ec-960a-01c0a70b2c60-m.svg",
  master: "https://http2.mlstatic.com/storage/logos-api-admin/a2c2b2c0-da15-11eb-895b-a1897f8dea71-m.svg",
  amex: "https://http2.mlstatic.com/storage/logos-api-admin/81478b10-c1b8-11e9-bde9-fb3ca2ca6dd5-m.svg",
  cabal: "https://http2.mlstatic.com/storage/logos-api-admin/8e69a030-c1b8-11e9-bde9-fb3ca2ca6dd5-m.svg",
  naranja: "https://http2.mlstatic.com/storage/logos-api-admin/90b96d70-c1b8-11e9-bde9-fb3ca2ca6dd5-m.svg",
};

function isNoInterest(labels: string[]) {
  return labels.some((l) => l.toLowerCase().includes("sin_interes") || l.toLowerCase().includes("sin interés"));
}

export function CuotasModal({ price, onClose }: Props) {
  const [options, setOptions] = useState<InstallmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/pagos/cuotas?amount=${Math.round(price)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setOptions(data.options ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [price]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b">
          <div>
            <h2 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <CreditCard size={18} className="text-emerald-600" /> Cuotas disponibles
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Total: <span className="font-semibold text-gray-700">{formatPrice(price)}</span></p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4">
          {loading && (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <Loader2 size={24} className="animate-spin mr-2" /> Consultando cuotas...
            </div>
          )}
          {error && (
            <div className="py-6 text-center text-sm text-red-500">
              No se pudieron cargar las cuotas. Intentá más tarde.
            </div>
          )}
          {!loading && !error && options.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-400">Sin opciones de cuotas disponibles.</p>
          )}
          {!loading && !error && options.length > 0 && (
            <>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Tarjetas de crédito</h3>
              {/* Card logos */}
              <div className="flex gap-2 mb-4 flex-wrap">
                {Object.values(CARD_LOGOS).map((src, i) => (
                  <img key={i} src={src} alt="" className="h-6 object-contain" onError={(e) => (e.currentTarget.style.display = "none")} />
                ))}
              </div>
              {/* 1 pago line */}
              {options[0]?.installments === 1 && (
                <p className="text-sm text-gray-600 mb-3">
                  Total en 1 pago: <span className="font-bold text-gray-900">{formatPrice(options[0].total_amount)}</span> con todas las tarjetas.
                </p>
              )}
              <p className="text-xs text-gray-500 mb-2">O pagá en:</p>
              <div className="divide-y border rounded-xl overflow-hidden">
                {options.map((opt) => {
                  const noInt = isNoInterest(opt.labels);
                  return (
                    <div key={opt.installments} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-800">
                          <span className="font-semibold">{opt.installments}</span>{" "}
                          {opt.installments === 1 ? "pago" : "cuotas"} de{" "}
                          <span className="font-bold text-gray-900">{formatPrice(opt.installment_amount)}</span>
                        </span>
                        {noInt && (
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">sin interés</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">Total {formatPrice(opt.total_amount)}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 mt-3">* Las cuotas sin interés dependen del banco emisor y las promociones vigentes.</p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button onClick={onClose}
            className="w-full text-center text-sm text-emerald-600 hover:underline font-medium py-2">
            Volver al producto
          </button>
        </div>
      </div>
    </div>
  );
}
