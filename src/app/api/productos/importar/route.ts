export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { slugify } from "@/lib/utils";

interface FilaImport { codigo?: string | number; nombre: string; precio?: number | string }

// Importa/actualiza productos por lote. Cada fila → un producto con una variante.
// Idempotente por SKU (código): si el producto ya existe, actualiza precio/nombre.
// `canal` indica si el precio de la planilla es minorista o mayorista.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const body = (await req.json()) as { filas: FilaImport[]; canal?: "minorista" | "mayorista" };
  const filas = body.filas;
  const canal = body.canal === "mayorista" ? "mayorista" : "minorista";
  if (!Array.isArray(filas) || filas.length === 0) {
    return NextResponse.json({ error: "No hay filas para importar" }, { status: 400 });
  }
  await ensureSchema("pricing");

  let creados = 0, actualizados = 0, omitidos = 0;
  const errores: string[] = [];

  for (const f of filas) {
    const nombre = String(f.nombre ?? "").trim();
    const codigo = f.codigo != null ? String(f.codigo).trim().replace(/\.0$/, "") : "";
    const precioNum = Number(String(f.precio ?? "").toString().replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", "."));
    if (!nombre) { omitidos++; continue; }

    const sku = codigo || slugify(nombre).slice(0, 40);
    const slug = `${slugify(nombre).slice(0, 60)}-${sku}`.slice(0, 80);
    const price = Number.isFinite(precioNum) && precioNum > 0 ? precioNum : 0;

    try {
      let productId: string;
      // ¿Ya existe la variante con ese SKU? → actualizamos.
      const varExistente = await prisma.productVariant.findUnique({ where: { sku } });
      if (varExistente) {
        await prisma.productVariant.update({ where: { sku }, data: { price: price.toString() } });
        await prisma.product.update({ where: { id: varExistente.productId }, data: { name: nombre } }).catch(() => {});
        productId = varExistente.productId;
        actualizados++;
      } else {
        const prod = await prisma.product.create({
          data: {
            name: nombre, slug, active: true,
            variants: { create: { name: "Único", sku, price: price.toString(), stock: 0, active: true } },
          },
        });
        productId = prod.id;
        creados++;
      }

      // Guarda el precio en product_pricing según el canal (para el Cotizador).
      if (price > 0) {
        const col = canal === "mayorista" ? "precio_mayorista" : "precio_minorista";
        await (prisma as any).$executeRawUnsafe(
          `INSERT INTO product_pricing (product_id, ${col}, updated_at) VALUES ($1, $2, NOW())
           ON CONFLICT (product_id) DO UPDATE SET ${col} = $2, updated_at = NOW()`,
          productId, price
        ).catch(() => {});
      }
    } catch (e: any) {
      errores.push(`${nombre}: ${e?.message ?? "error"}`);
    }
  }

  return NextResponse.json({ ok: true, creados, actualizados, omitidos, errores: errores.slice(0, 10) });
}
