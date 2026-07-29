"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Interruptor Visible/Oculto en la tienda (usa el campo active del producto).
export function ToggleVisible({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(active);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const nuevo = !on;
    setOn(nuevo); setLoading(true);
    const r = await fetch(`/api/productos/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: nuevo }),
    });
    setLoading(false);
    if (!r.ok) { setOn(!nuevo); alert("No se pudo cambiar la visibilidad"); return; }
    router.refresh();
  }

  return (
    <button onClick={toggle} disabled={loading} title={on ? "Visible en la tienda — tocá para ocultar" : "Oculto — tocá para mostrar"}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${on ? "bg-emerald-500" : "bg-gray-300"} ${loading ? "opacity-60" : ""}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${on ? "translate-x-4" : "translate-x-1"}`} />
    </button>
  );
}
