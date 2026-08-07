"use client";

import { Suspense } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useSearchParams } from "next/navigation";

function GraciasContent() {
  const id = useSearchParams().get("id");
  return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center space-y-5">
      <CheckCircle2 size={56} className="mx-auto text-emerald-500" />
      <h1 className="text-2xl font-bold text-gray-900">¡Pedido recibido! 🧉</h1>
      <p className="text-gray-600">
        Ya nos llegó tu pedido{ id ? <> <span className="text-gray-400">(#{String(id).slice(0, 8)})</span></> : null }.
        En breve te contactamos para coordinar el <b>pago</b> y el <b>envío</b>.
      </p>
      <p className="text-sm text-gray-400">Gracias por tu compra mayorista.</p>
      <Link href="/productos"
        className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-medium">
        Seguir viendo el catálogo
      </Link>
    </div>
  );
}

export default function GraciasPage() {
  return <Suspense><GraciasContent /></Suspense>;
}
