"use client";

import { useState, useEffect, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCartStore } from "@/store/cartStore";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Truck } from "lucide-react";

const schema = z.object({
  fullName: z.string().min(2, "Nombre requerido"),
  email: z.string().email("Email inválido"),
  phone: z.string().min(8, "Teléfono requerido"),
  street: z.string().min(3, "Dirección requerida"),
  city: z.string().min(2, "Ciudad requerida"),
  province: z.string().min(2, "Provincia requerida"),
  postalCode: z.string().min(4, "Código postal requerido"),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface ShippingOption {
  id: string;
  name: string;
  description: string | null;
  price: number;
  estimatedDays: string | null;
}

export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutContent />
    </Suspense>
  );
}

function CheckoutContent() {
  const { items, getTotalPrice, clearCart } = useCartStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const couponCode = searchParams.get("cupon");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingOption | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);

  const subtotal = getTotalPrice();
  const shippingCost = selectedShipping ? Number(selectedShipping.price) : 0;
  const total = subtotal - couponDiscount + shippingCost;

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    fetch("/api/envios").then((r) => r.json()).then((opts: ShippingOption[]) => {
      setShippingOptions(opts);
      if (opts.length === 1) setSelectedShipping(opts[0]);
    });
  }, []);

  useEffect(() => {
    if (!couponCode) return;
    fetch("/api/cupones/validar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: couponCode, subtotal }),
    }).then((r) => r.json()).then((d) => { if (d.discount) setCouponDiscount(d.discount); });
  }, [couponCode, subtotal]);

  async function onSubmit(data: FormData) {
    if (items.length === 0) return;
    if (!selectedShipping && shippingOptions.length > 0) {
      setError("Seleccioná una opción de envío");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const validationRes = await fetch("/api/carrito/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })) }),
      });
      const validation = await validationRes.json();
      if (!validation.valid) {
        setError(validation.errors.join(", "));
        setLoading(false);
        return;
      }

      const orderRes = await fetch("/api/ordenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity, unitPrice: i.price })),
          shippingAddress: {
            fullName: data.fullName, phone: data.phone,
            street: data.street, city: data.city,
            province: data.province, postalCode: data.postalCode,
          },
          shippingCost,
          shippingOptionName: selectedShipping?.name,
          couponCode: couponCode ?? undefined,
          couponDiscount,
          guestEmail: data.email,
          notes: data.notes,
        }),
      });

      if (!orderRes.ok) throw new Error((await orderRes.json()).error ?? "Error al crear la orden");
      const order = await orderRes.json();

      const prefRes = await fetch("/api/pagos/preferencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });

      if (!prefRes.ok) throw new Error("Error al crear preferencia de pago");
      const { initPoint, sandboxInitPoint } = await prefRes.json();

      clearCart();
      window.location.href = process.env.NODE_ENV === "production" ? initPoint : (sandboxInitPoint ?? initPoint);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-gray-500">No hay productos en el carrito.</p>
        <Button onClick={() => router.push("/")}>Ir al catálogo</Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Finalizar compra</h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
        <form onSubmit={handleSubmit(onSubmit)} className="lg:col-span-3 space-y-5">
          <section className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Datos de contacto</h2>
            {[
              { name: "fullName" as const, label: "Nombre completo", type: "text" },
              { name: "email" as const, label: "Email", type: "email" },
              { name: "phone" as const, label: "Teléfono", type: "tel" },
            ].map(({ name, label, type }) => (
              <div key={name}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input type={type} {...register(name)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                {errors[name] && <p className="text-xs text-red-500 mt-1">{errors[name]?.message}</p>}
              </div>
            ))}
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Dirección de envío</h2>
            {[
              { name: "street" as const, label: "Calle y número" },
              { name: "city" as const, label: "Ciudad" },
              { name: "province" as const, label: "Provincia" },
              { name: "postalCode" as const, label: "Código postal" },
            ].map(({ name, label }) => (
              <div key={name}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input {...register(name)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                {errors[name] && <p className="text-xs text-red-500 mt-1">{errors[name]?.message}</p>}
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
              <textarea {...register("notes")} rows={2}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
          </section>

          {/* Opciones de envío */}
          {shippingOptions.length > 0 && (
            <section className="bg-white rounded-2xl border border-gray-100 p-6 space-y-3">
              <h2 className="font-semibold text-gray-900">Método de envío</h2>
              {shippingOptions.map((opt) => (
                <label key={opt.id}
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                    selectedShipping?.id === opt.id
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}>
                  <input type="radio" name="shipping" className="hidden"
                    checked={selectedShipping?.id === opt.id}
                    onChange={() => setSelectedShipping(opt)} />
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    selectedShipping?.id === opt.id ? "border-emerald-500" : "border-gray-300"
                  }`}>
                    {selectedShipping?.id === opt.id && (
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    )}
                  </div>
                  <Truck size={18} className={selectedShipping?.id === opt.id ? "text-emerald-600" : "text-gray-400"} />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">{opt.name}</p>
                    {opt.description && <p className="text-xs text-gray-500">{opt.description}</p>}
                    {opt.estimatedDays && <p className="text-xs text-gray-400">{opt.estimatedDays}</p>}
                  </div>
                  <p className="font-bold text-gray-900 text-sm shrink-0">
                    {Number(opt.price) === 0 ? "Gratis" : formatPrice(Number(opt.price))}
                  </p>
                </label>
              ))}
            </section>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
          )}

          <Button type="submit" size="lg" className="w-full" loading={loading}>
            Pagar con Mercado Pago
          </Button>
        </form>

        {/* Resumen */}
        <aside className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4 sticky top-20">
            <h2 className="font-semibold text-gray-900">Resumen del pedido</h2>
            <div className="space-y-3 divide-y divide-gray-50">
              {items.map((item) => (
                <div key={item.variantId} className="flex gap-3 pt-3 first:pt-0">
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-50 shrink-0">
                    <Image src={item.imageUrl ?? "/images/placeholder.png"} alt={item.productName} fill className="object-cover" sizes="48px" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-1">{item.productName}</p>
                    <p className="text-xs text-gray-500">{item.variantName} × {item.quantity}</p>
                  </div>
                  <p className="text-sm font-semibold shrink-0">{formatPrice(item.price * item.quantity)}</p>
                </div>
              ))}
            </div>
            <div className="border-t pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              {couponDiscount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Descuento ({couponCode})</span>
                  <span>− {formatPrice(couponDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Envío</span>
                <span>{selectedShipping ? (Number(selectedShipping.price) === 0 ? "Gratis" : formatPrice(Number(selectedShipping.price))) : "—"}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="text-xl font-bold text-emerald-700">{formatPrice(total)}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
