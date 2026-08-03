export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";

export const ETAPAS = ["nuevo", "calificado", "presentado", "negociacion", "ganado", "perdido"] as const;

// Lista las conversaciones de WhatsApp como leads, con su etapa de venta.
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  await ensureSchema("whatsapp");
  try {
    const rows: any[] = await (prisma as any).$queryRawUnsafe(`
      WITH ult AS (
        SELECT DISTINCT ON (wa_id) wa_id, texto, creado_en
        FROM whatsapp_mensajes ORDER BY wa_id, creado_en DESC
      )
      SELECT u.wa_id, u.texto, u.creado_en,
             c.nombre, c.segmento, COALESCE(c.etapa, 'nuevo') AS etapa
      FROM ult u
      LEFT JOIN whatsapp_contactos c ON c.wa_id = u.wa_id
      ORDER BY u.creado_en DESC
      LIMIT 300
    `);
    return NextResponse.json({ leads: rows.map(r => ({
      wa_id: r.wa_id, texto: r.texto, fecha: r.creado_en,
      nombre: r.nombre ?? null, segmento: r.segmento ?? null, etapa: r.etapa,
    })) });
  } catch (e: any) {
    return NextResponse.json({ leads: [], error: e?.message }, { status: 200 });
  }
}

// Cambia la etapa de un lead.
export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const { wa_id, etapa } = await req.json();
  if (!wa_id || !ETAPAS.includes(etapa)) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  await ensureSchema("whatsapp");
  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO whatsapp_contactos (wa_id, etapa, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (wa_id) DO UPDATE SET etapa = $2, updated_at = now()`,
    wa_id, etapa);
  return NextResponse.json({ ok: true });
}
