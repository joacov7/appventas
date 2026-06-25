"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("¿Eliminar este producto?")) return;
    setLoading(true);
    await fetch(`/api/productos/${id}`, { method: "DELETE" });
    router.refresh();
    setLoading(false);
  }

  return (
    <button onClick={handleDelete} disabled={loading}
      className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50">
      <Trash2 size={13} /> {loading ? "..." : "Eliminar"}
    </button>
  );
}
