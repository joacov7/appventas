"use client";

import { Layers } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { useTiers, applyTier } from "@/hooks/useTiers";

interface Props {
  basePrice: number;
  currentQty?: number;
}

export function VolumePricing({ basePrice, currentQty = 1 }: Props) {
  const tiers = useTiers();
  if (tiers.length === 0) return null;

  return (
    <div className="border border-emerald-100 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50">
        <Layers size={14} className="text-emerald-600" />
        <span className="text-xs font-semibold text-emerald-700">Precios por volumen</span>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-3 py-1.5 text-left text-gray-500 font-medium">Cantidad</th>
            <th className="px-3 py-1.5 text-left text-gray-500 font-medium">Precio c/u</th>
            <th className="px-3 py-1.5 text-left text-gray-500 font-medium">Descuento</th>
          </tr>
        </thead>
        <tbody>
          {/* Retail row */}
          <tr className={`border-t border-gray-100 ${currentQty < tiers[0].min_qty ? "bg-emerald-50 font-semibold" : ""}`}>
            <td className="px-3 py-2 text-gray-700">1 – {tiers[0].min_qty - 1}</td>
            <td className="px-3 py-2 text-gray-900">{formatPrice(basePrice)}</td>
            <td className="px-3 py-2 text-gray-400">—</td>
          </tr>
          {tiers.map((tier, i) => {
            const nextMinQty = tiers[i + 1]?.min_qty;
            const rangeLabel = nextMinQty ? `${tier.min_qty} – ${nextMinQty - 1}` : `${tier.min_qty}+`;
            const discountedPrice = applyTier(basePrice, tier);
            const isActive = currentQty >= tier.min_qty && (!tiers[i + 1] || currentQty < tiers[i + 1].min_qty);
            return (
              <tr key={tier.id} className={`border-t border-gray-100 ${isActive ? "bg-emerald-50 font-semibold" : ""}`}>
                <td className="px-3 py-2 text-gray-700">{rangeLabel}</td>
                <td className="px-3 py-2 text-emerald-700">{formatPrice(discountedPrice)}</td>
                <td className="px-3 py-2">
                  <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">
                    {tier.descuento_pct}% off
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
