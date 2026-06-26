import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });

  const rows = await (prisma as any).$queryRawUnsafe(
    `SELECT t.id, t.nombre, t.url, t.plataforma, t.activa, t.ultimo_scrape,
            COUNT(p.id)::int AS total_productos
     FROM tiendas_competidoras t
     LEFT JOIN productos_competidores p ON p.tienda_id = t.id
     GROUP BY t.id ORDER BY t.ultimo_scrape DESC NULLS LAST`
  );
  return NextResponse.json(rows);
}
