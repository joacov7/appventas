"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Interruptor genérico que actualiza un campo booleano del producto (PUT).
function Toggle({ id, campo, valor, onLabel, offLabel, color = "emerald" }: {
  id: string; campo: "active" | "featured"; valor: boolean; onLabel: string; offLabel: string; color?: "emerald" | "amber";
}) {
  const router = useRouter();
  const [on, setOn] = useState(valor);
  const [loading, setLoading] = useState(false);
  const onBg = color === "amber" ? "bg-amber-500" : "bg-emerald-500";

  async function toggle() {
    const nuevo = !on;
    setOn(nuevo); setLoading(true);
    const r = await fetch(`/api/productos/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [campo]: nuevo }),
    });
    setLoading(false);
    if (!r.ok) { setOn(!nuevo); alert("No se pudo actualizar"); return; }
    router.refresh();
  }

  return (
    <button onClick={toggle} disabled={loading} title={on ? onLabel : offLabel}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${on ? onBg : "bg-gray-300"} ${loading ? "opacity-60" : ""}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${on ? "translate-x-4" : "translate-x-1"}`} />
    </button>
  );
}

// Interruptor Visible/Oculto en la tienda (campo active).
export function ToggleVisible({ id, active }: { id: string; active: boolean }) {
  return <Toggle id={id} campo="active" valor={active} onLabel="Visible en la tienda — tocá para ocultar" offLabel="Oculto — tocá para mostrar" />;
}

// Interruptor Destacado (campo featured).
export function ToggleFeatured({ id, featured }: { id: string; featured: boolean }) {
  return <Toggle id={id} campo="featured" valor={featured} onLabel="Destacado — tocá para quitar" offLabel="Normal — tocá para destacar" color="amber" />;
}
