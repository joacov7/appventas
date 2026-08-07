"use client";

import { Layers, DollarSign, ShoppingCart } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { useTiers, getCartTier, getNextCartTier, applyTier, type PriceTier } from "@/hooks/useTiers";
import { useCartStore } from "@/store/cartStore";

interface Props {
  basePrice: number;
}

function TierTable({
  tiers,
  basePrice,
  cartQty,
  cartMonto,
}: {
  tiers: PriceTier[];
  basePrice: number;
  cartQty: number;
  cartMonto: number;
}) {
  const isQty = tiers[0]?.tipo === "cantidad";
  const activeTier = getCartTier(tiers, cartQty, cartMonto);

  return (
    <div className={`border ${isQty ? "border-emerald-100" : "border-blue-100"} rounded-xl overflow-hidden`}>
      <div className={`flex items-center gap-2 px-3 py-2 ${isQty ? "bg-emerald-50" : "bg-blue-50"}`}>
        {isQty
          ? <Layers size={14} className="text-emerald-600" />
          : <DollarSign size={14} className="text-blue-600" />}
        <span className={`text-xs font-semibold ${isQty ? "text-emerald-700" : "text-blue-700"}`}>
          {isQty ? "Descuento por cantidad del carrito" : "Descuento por monto del carrito"}
        </span>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-3 py-1.5 text-left text-gray-500 font-medium">
              {isQty ? "Unidades totales" : "Monto total"}
            </th>
            <th className="px-3 py-1.5 text-left text-gray-500 font-medium">Precio c/u</th>
            <th className="px-3 py-1.5 text-left text-gray-500 font-medium">Descuento</th>
          </tr>
        </thead>
        <tbody>
          <tr className={`border-t border-gray-100 ${!activeTier ? (isQty ? "bg-emerald-50 font-semibold" : "bg-blue-50 font-semibold") : ""}`}>
            <td className="px-3 py-2 text-gray-700">
              {isQty
                ? `1 – ${(tiers[0].min_qty ?? 1) - 1} u.`
                : `Hasta ${formatPrice((tiers[0].min_monto ?? 0) - 1)}`}
            </td>
            <td className="px-3 py-2 text-gray-900">{formatPrice(basePrice)}</td>
            <td className="px-3 py-2 text-gray-400">—</td>
          </tr>
          {tiers.map((tier, i) => {
            const nextQty = tiers[i + 1]?.min_qty;
            const nextMonto = tiers[i + 1]?.min_monto;
            const rangeLabel = isQty
              ? (nextQty ? `${tier.min_qty} – ${nextQty - 1} u.` : `${tier.min_qty}+ u.`)
              : (nextMonto
                ? `${formatPrice(tier.min_monto ?? 0)} – ${formatPrice(nextMonto - 1)}`
                : `Desde ${formatPrice(tier.min_monto ?? 0)}`);
            const discountedPrice = applyTier(basePrice, tier);
            const isActive = activeTier?.id === tier.id;
            return (
              <tr key={tier.id} className={`border-t border-gray-100 ${isActive ? (isQty ? "bg-emerald-50 font-semibold" : "bg-blue-50 font-semibold") : ""}`}>
                <td className="px-3 py-2 text-gray-700">{rangeLabel}</td>
                <td className={`px-3 py-2 ${isQty ? "text-emerald-700" : "text-blue-700"}`}>{formatPrice(discountedPrice)}</td>
                <td className="px-3 py-2">
                  <span className={`${isQty ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"} px-1.5 py-0.5 rounded-full font-bold`}>
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

export function VolumePricing({ basePrice }: Props) {
  const tiers = useTiers();
  const { items } = useCartStore();

  const cartQty = items.reduce((acc, i) => acc + i.quantity, 0);
  const cartMonto = items.reduce((acc, i) => acc + i.price * i.quantity, 0);

  const qtyTiers = tiers.filter((t) => t.tipo === "cantidad");
  const montoTiers = tiers.filter((t) => t.tipo === "monto");

  if (!qtyTiers.length && !montoTiers.length) return null;

  const activeTier = getCartTier(tiers, cartQty, cartMonto);
  const nextInfo = getNextCartTier(tiers, cartQty, cartMonto);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
        <ShoppingCart size={13} className="text-gray-400 shrink-0" />
        {activeTier ? (
          <p className="text-xs text-emerald-700 font-medium">
            <span className="font-bold">{activeTier.descuento_pct}% OFF</span> aplicado en tu carrito ({cartQty} u. · {formatPrice(cartMonto)})
          </p>
        ) : nextInfo ? (
          <p className="text-xs text-gray-500">
            {nextInfo.missingQty != null
              ? <><span className="font-semibold text-gray-700">{nextInfo.missingQty} unidades más</span> en el carrito para {nextInfo.tier.descuento_pct}% OFF</>
              : <><span className="font-semibold text-gray-700">{formatPrice(nextInfo.missingMonto ?? 0)} más</span> en el carrito para {nextInfo.tier.descuento_pct}% OFF</>}
          </p>
        ) : (
          <p className="text-xs text-gray-400">El descuento aplica sobre el total del carrito — podés mezclar productos.</p>
        )}
      </div>

      {qtyTiers.length > 0 && (
        <TierTable tiers={qtyTiers} basePrice={basePrice} cartQty={cartQty} cartMonto={cartMonto} />
      )}
      {montoTiers.length > 0 && (
        <TierTable tiers={montoTiers} basePrice={basePrice} cartQty={cartQty} cartMonto={cartMonto} />
      )}
    </div>
  );
}
