"use client";

import { Layers, DollarSign } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { useTiers, applyTier, type PriceTier } from "@/hooks/useTiers";

interface Props {
  basePrice: number;
  currentQty?: number;
}

function QtyTiers({ tiers, basePrice, currentQty }: { tiers: PriceTier[]; basePrice: number; currentQty: number }) {
  return (
    <div className="border border-emerald-100 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50">
        <Layers size={14} className="text-emerald-600" />
        <span className="text-xs font-semibold text-emerald-700">Precio por cantidad</span>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-3 py-1.5 text-left text-gray-500 font-medium">Unidades</th>
            <th className="px-3 py-1.5 text-left text-gray-500 font-medium">Precio c/u</th>
            <th className="px-3 py-1.5 text-left text-gray-500 font-medium">Descuento</th>
          </tr>
        </thead>
        <tbody>
          <tr className={`border-t border-gray-100 ${currentQty < (tiers[0].min_qty ?? Infinity) ? "bg-emerald-50 font-semibold" : ""}`}>
            <td className="px-3 py-2 text-gray-700">1 – {(tiers[0].min_qty ?? 1) - 1}</td>
            <td className="px-3 py-2 text-gray-900">{formatPrice(basePrice)}</td>
            <td className="px-3 py-2 text-gray-400">—</td>
          </tr>
          {tiers.map((tier, i) => {
            const next = tiers[i + 1]?.min_qty;
            const rangeLabel = next ? `${tier.min_qty} – ${next - 1}` : `${tier.min_qty}+`;
            const discountedPrice = applyTier(basePrice, tier);
            const isActive = currentQty >= (tier.min_qty ?? 0) && (!tiers[i + 1] || currentQty < (tiers[i + 1].min_qty ?? Infinity));
            return (
              <tr key={tier.id} className={`border-t border-gray-100 ${isActive ? "bg-emerald-50 font-semibold" : ""}`}>
                <td className="px-3 py-2 text-gray-700">{rangeLabel} unidades</td>
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

function AmountTiers({ tiers, basePrice, currentQty }: { tiers: PriceTier[]; basePrice: number; currentQty: number }) {
  const currentTotal = currentQty * basePrice;

  return (
    <div className="border border-blue-100 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50">
        <DollarSign size={14} className="text-blue-600" />
        <span className="text-xs font-semibold text-blue-700">Descuento por monto de compra</span>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-3 py-1.5 text-left text-gray-500 font-medium">Monto mínimo</th>
            <th className="px-3 py-1.5 text-left text-gray-500 font-medium">Precio c/u</th>
            <th className="px-3 py-1.5 text-left text-gray-500 font-medium">Descuento</th>
          </tr>
        </thead>
        <tbody>
          <tr className={`border-t border-gray-100 ${currentTotal < (tiers[0].min_monto ?? Infinity) ? "bg-blue-50 font-semibold" : ""}`}>
            <td className="px-3 py-2 text-gray-700">Hasta {formatPrice((tiers[0].min_monto ?? 0) - 1)}</td>
            <td className="px-3 py-2 text-gray-900">{formatPrice(basePrice)}</td>
            <td className="px-3 py-2 text-gray-400">—</td>
          </tr>
          {tiers.map((tier, i) => {
            const next = tiers[i + 1]?.min_monto;
            const rangeLabel = next
              ? `${formatPrice(tier.min_monto ?? 0)} – ${formatPrice(next - 1)}`
              : `Desde ${formatPrice(tier.min_monto ?? 0)}`;
            const discountedPrice = applyTier(basePrice, tier);
            const isActive = currentTotal >= (tier.min_monto ?? 0) && (!tiers[i + 1] || currentTotal < (tiers[i + 1].min_monto ?? Infinity));
            const approxUnits = Math.ceil((tier.min_monto ?? 0) / basePrice);
            return (
              <tr key={tier.id} className={`border-t border-gray-100 ${isActive ? "bg-blue-50 font-semibold" : ""}`}>
                <td className="px-3 py-2 text-gray-700">
                  {rangeLabel}
                  <span className="text-gray-400 ml-1">(≈{approxUnits} u.)</span>
                </td>
                <td className="px-3 py-2 text-blue-700">{formatPrice(discountedPrice)}</td>
                <td className="px-3 py-2">
                  <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">
                    {tier.descuento_pct}% off
  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {currentTotal < (tiers[0].min_monto ?? 0) && (
        <div className="px-3 py-2 bg-gray-50 border-t text-xs text-gray-500">
          Te faltan {formatPrice((tiers[0].min_monto ?? 0) - currentTotal)} para el próximo descuento
        </div>
      )}
    </div>
  );
}

export function VolumePricing({ basePrice, currentQty = 1 }: Props) {
  const tiers = useTiers();
  const qtyTiers = tiers.filter((t) => t.tipo === "cantidad");
  const amountTiers = tiers.filter((t) => t.tipo === "monto");

  if (!qtyTiers.length && !amountTiers.length) return null;

  return (
    <div className="space-y-3">
      {qtyTiers.length > 0 && (
        <QtyTiers tiers={qtyTiers} basePrice={basePrice} currentQty={currentQty} />
      )}
      {amountTiers.length > 0 && (
        <AmountTiers tiers={amountTiers} basePrice={basePrice} currentQty={currentQty} />
      )}
    </div>
  );
}
