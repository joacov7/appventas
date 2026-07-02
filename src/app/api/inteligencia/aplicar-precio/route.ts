export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

// Aplica un precio sugerido: actualiza la variante activa MÁS BARATA del
// producto (la que se compara contra el mercado) y registra el cambio
// en price_history para auditoría.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });

  const { productId, precio } = await req.json();
  const nuevoPrecio = Number(precio);
  if (!productId || !Number.isFinite(nuevoPrecio) || nuevoPrecio <= 0) {
    return NextResponse.json({ error: "productId y precio válido requeridos" }, { status: 400 });
  }

  // La variante activa más barata es la que define "mi precio" en la comparación
  const variante = await prisma.productVariant.findFirst({
    where: { productId: String(productId), active: true },
    orderBy: { price: "asc" },
  });
  if (!variante) return NextResponse.json({ error: "El producto no tiene variantes activas" }, { status: 404 });

  const precioAnterior = Number(variante.price);
  if (precioAnterior === nuevoPrecio) {
    return NextResponse.json({ ok: true, sin_cambios: true });
  }

  await prisma.productVariant.update({
    where: { id: variante.id },
    data: { price: nuevoPrecio.toString() },
  });

  // Auditoría en el historial de precios existente
  await (prisma as any).$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS price_history (
      id SERIAL PRIMARY KEY,
      product_id TEXT NOT NULL,
      campo TEXT NOT NULL,
      valor_anterior DECIMAL(12,2),
      valor_nuevo DECIMAL(12,2),
      usuario TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});
  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO price_history (product_id, campo, valor_anterior, valor_nuevo, usuario)
     VALUES ($1, $2, $3, $4, 'sugerencia-competencia')`,
    String(productId), `variante:${variante.name}`, precioAnterior, nuevoPrecio
  ).catch(() => {});

  return NextResponse.json({
    ok: true,
    variante: variante.name,
    precio_anterior: precioAnterior,
    precio_nuevo: nuevoPrecio,
  });
}
