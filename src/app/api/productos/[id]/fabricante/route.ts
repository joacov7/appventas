export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";

// Devuelve la asociación producto→fabricante (o null) junto con la lista de
// fabricantes activos para poder elegir en la ficha del producto.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { id } = await params;
  try {
    await ensureSchema("fabricantes");
    const [asociacion, fabricantes] = await Promise.all([
      (prisma as any).$queryRawUnsafe(
        `SELECT pf.*, f.nombre AS fabricante_nombre, f.moneda
         FROM producto_fabricante pf JOIN fabricantes f ON f.id = pf.fabricante_id
         WHERE pf.product_id = $1`, id
      ),
      (prisma as any).$queryRawUnsafe(
        `SELECT id, nombre, moneda, margen_pct FROM fabricantes WHERE activo = true ORDER BY nombre`
      ),
    ]);
    return NextResponse.json({ asociacion: asociacion[0] ?? null, fabricantes });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

// Asocia (o actualiza) el fabricante del producto. Si fabricante_id es null,
// elimina la asociación.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { id } = await params;
  const b = await req.json();
  try {
    await ensureSchema("fabricantes");

    if (!b?.fabricante_id) {
      await (prisma as any).$executeRawUnsafe(`DELETE FROM producto_fabricante WHERE product_id = $1`, id);
      return NextResponse.json({ ok: true, asociacion: null });
    }

    const costo = b.costo_proveedor === "" || b.costo_proveedor == null ? null : Number(b.costo_proveedor);
    const codigo = b.codigo_proveedor?.trim() || null;

    const rows = await (prisma as any).$queryRawUnsafe(
      `INSERT INTO producto_fabricante (product_id, fabricante_id, costo_proveedor, codigo_proveedor)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (product_id) DO UPDATE SET
         fabricante_id = $2, costo_proveedor = $3, codigo_proveedor = $4
       RETURNING *`,
      id, Number(b.fabricante_id), costo, codigo
    );
    return NextResponse.json({ ok: true, asociacion: rows[0] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
