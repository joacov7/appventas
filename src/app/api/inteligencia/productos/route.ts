import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tiendaId = searchParams.get("tienda");
  const soloAlertas = searchParams.get("alertas") === "1";
  const busqueda = searchParams.get("q")?.toLowerCase();

  let where = "WHERE p.disponible = TRUE";
  const vals: any[] = [];
  let idx = 1;

  if (tiendaId) {
    where += ` AND p.tienda_id = $${idx++}`;
    vals.push(Number(tiendaId));
  }
  if (soloAlertas) {
    where += ` AND p.precio_anterior IS NOT NULL AND p.precio < p.precio_anterior`;
  }
  if (busqueda) {
    where += ` AND LOWER(p.nombre) LIKE $${idx++}`;
    vals.push(`%${busqueda}%`);
  }

  const rows = await (prisma as any).$queryRawUnsafe(
    `SELECT p.id, p.nombre, p.precio, p.precio_anterior, p.categoria, p.url, p.imagen,
            p.ultima_vez, t.nombre AS tienda_nombre, t.url AS tienda_url, t.plataforma
     FROM productos_competidores p
     JOIN tiendas_competidoras t ON t.id = p.tienda_id
     ${where}
     ORDER BY p.ultima_vez DESC
     LIMIT 200`,
    ...vals
  );
  return NextResponse.json(rows);
}
