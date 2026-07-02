"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ComboForm } from "../../ComboForm";

export default function EditarComboPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/combos/${id}`)
      .then(r => r.json())
      .then(d => {
        setData({
          ...d,
          image_urls: d.image_urls ?? [],
          precio_venta: d.precio_venta != null ? Number(d.precio_venta) : null,
          items: (d.items ?? []).map((i: any) => ({
            product_id: i.product_id,
            variant_id: i.variant_id ?? "",
            quantity: Number(i.quantity),
          })),
        });
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-gray-400 py-12 text-center">Cargando...</div>;
  if (!data) return <div className="text-red-500 py-12 text-center">Combo no encontrado.</div>;

  return <ComboForm initialData={data} />;
}
