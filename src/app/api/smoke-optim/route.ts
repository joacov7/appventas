export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { analisisRentabilidad } from "@/lib/services/finanzas.service";
import { oportunidadesVentaCruzada } from "@/lib/services/oportunidades.service";

// ⚠️ ENDPOINT TEMPORAL — verifica los índices de performance (Fase 5) contra la
// base real y cronometra los análisis. Se elimina después. Solo lectura.
const TOKEN = "5a6b26dc0dcdc310c87d9d0a83c90705";
const ESPERADOS = ["idx_order_items_product", "idx_order_items_order", "idx_orders_created_status", "idx_variants_product"];

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  const checks: { paso: string; ok: boolean; detalle?: string }[] = [];
  const push = (p: string, ok: boolean, d?: string) => checks.push({ paso: p, ok, detalle: d });
  const q = (s: string, ...a: any[]) => (prisma as any).$queryRawUnsafe(s, ...a);

  try {
    // ensureSchema("agentes") crea los índices (idempotente) si faltan.
    await ensureSchema("agentes");

    const rows: any[] = await q(
      `SELECT indexname FROM pg_indexes WHERE indexname = ANY($1)`, ESPERADOS);
    const encontrados = rows.map(r => r.indexname);
    const faltan = ESPERADOS.filter(i => !encontrados.includes(i));
    push("1. Índices de performance creados", faltan.length === 0, `creados=${encontrados.length}/${ESPERADOS.length}${faltan.length ? ` · faltan=${faltan.join(",")}` : ""}`);

    // Cronometra los análisis (deben responder en pocos segundos).
    const t1 = Date.now();
    const rent = await analisisRentabilidad();
    const msRent = Date.now() - t1;
    push("2. analisis_rentabilidad rápido", msRent < 15000, `${rent.length} productos en ${msRent}ms`);

    const t2 = Date.now();
    const vc = await oportunidadesVentaCruzada();
    const msVc = Date.now() - t2;
    push("3. venta_cruzada rápida", msVc < 15000, `${vc.length} oportunidades en ${msVc}ms`);
  } catch (err: any) {
    push("ERROR", false, err?.message ?? String(err));
  }

  const pass = checks.filter(c => c.ok).length;
  return NextResponse.json({
    resultado: `${pass}/${checks.length}`,
    veredicto: pass === checks.length ? "PASS" : "FAIL", checks,
  });
}
