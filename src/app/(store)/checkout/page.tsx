"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCartStore } from "@/store/cartStore";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import Image from "next/image";
import { useRouter } from "next/navigation";

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

export default function CheckoutPage() {
  const { items, getTotalPrice, clearCart } = useCartStore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    if (items.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Validar stock
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

      // 2. Crear orden
      const orderRes = await fetch("/api/ordenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity, unitPrice: i.price })),
          shippingAddress: {
            fullName: data.fullName,
            phone: data.phone,
            street: data.street,
            city: data.city,
            province: data.province,
            postalCode: data.postalCode,
          },
          guestEmail: data.email,
          notes: data.notes,
        }),
      });

      if (!orderRes.ok) {
        const err = await orderRes.json();
        throw new Error(err.error ?? "Error al crear la orden");
      }
      const order = await orderRes.json();

      // 3. Crear preferencia MP
      const prefRes = await fetch("/api/pagos/preferencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });

      if (!prefRes.ok) throw new Error("Error al crear preferencia de pago");
      const { initPoint, sandboxInitPoint } = await prefRes.json();

      clearCart();
      // Redirigir a MP
      const url = process.env.NODE_ENV === "production" ? initPoint : (sandboxInitPoint ?? initPoint);
      window.location.href = url;
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
        {/* Formulario */}
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
                <input
                  type={type}
                  {...register(name)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
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
                <input
                  {...register(name)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                {errors[name] && <p className="text-xs text-red-500 mt-1">{errors[name]?.message}</p>}
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
              <textarea {...register("notes")} rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
          </section>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
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
            <div className="border-t pt-4 flex justify-between items-center">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold text-emerald-700">{formatPrice(getTotalPrice())}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
