export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import {
  recordarDecision, decisionQueBloquea, recordarCliente, perfilCliente,
  recordarProducto, perfilProducto, recordarReglaEmpresa, reglasEmpresa,
} from "@/lib/agents/memoria-estructurada";

// ⚠️ ENDPOINT TEMPORAL — verifica la Fase 4 (memoria estructurada) contra la
// base real. Se elimina después. Escribe en memory_entries con un marcador
// único (se limpia al final). No toca datos de negocio.
const TOKEN = "77469e759dec95c8d59b7e87f84aeb0d";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  const MARK = `SMOKE4x${Date.now()}`;
  const checks: { paso: string; ok: boolean; detalle?: string }[] = [];
  const push = (p: string, ok: boolean, d?: string) => checks.push({ paso: p, ok, detalle: d });
  const q = (s: string, ...a: any[]) => (prisma as any).$queryRawUnsafe(s, ...a);
  const e = (s: string, ...a: any[]) => (prisma as any).$executeRawUnsafe(s, ...a);
  let limpio = false;

  try {
    await ensureSchema("memoria");

    // 1. Decisión de RECHAZO vigente bloquea la acción sobre la entidad.
    await recordarDecision({ actor: "usuario", accion: "aplicar_precio", entityType: "producto", entityId: `${MARK}-BLK`, motivo: "no bajar el precio", vigenciaDias: 30, kind: "rechazo" });
    const bloq = await decisionQueBloquea("producto", `${MARK}-BLK`, "aplicar_precio");
    const otra = await decisionQueBloquea("producto", `${MARK}-BLK`, "enviar_whatsapp");
    push("1. Rechazo vigente bloquea la acción (y no otra)", !!bloq && bloq.motivo === "no bajar el precio" && otra === null, `bloq=${!!bloq}, otraAccion=${otra === null ? "no bloquea" : "bloquea"}`);

    // 2. Una 'preferencia' NO bloquea.
    await recordarDecision({ actor: "usuario", accion: "aplicar_precio", entityType: "producto", entityId: `${MARK}-PREF`, kind: "preferencia" });
    const pref = await decisionQueBloquea("producto", `${MARK}-PREF`, "aplicar_precio");
    push("2. Preferencia no bloquea", pref === null);

    // 3. Perfil de cliente (round-trip).
    await recordarCliente(`${MARK}-C`, { valor_historico: 4800000, riesgo_abandono: "alto" });
    const pc = await perfilCliente(`${MARK}-C`);
    push("3. Perfil de cliente persistido y leído", pc?.riesgo_abandono === "alto", `valor=${pc?.valor_historico}`);

    // 4. Perfil de producto (round-trip).
    await recordarProducto(`${MARK}-P`, { rotacion: "baja", margen_pct: 38 });
    const pp = await perfilProducto(`${MARK}-P`);
    push("4. Perfil de producto persistido y leído", pp?.margen_pct === 38, `rotacion=${pp?.rotacion}`);

    // 5. Regla de empresa permanente.
    await recordarReglaEmpresa(`${MARK}-REGLA`, { texto: "No vender debajo del 25% de margen", margen_min: 25 });
    const reglas = await reglasEmpresa();
    const laNuestra = (reglas as any[]).find(r => r.value?.margen_min === 25 && r.value?.texto?.includes("25%"));
    push("5. Regla de empresa registrada", !!laNuestra);

    // 6. Bucle de aprendizaje: tras un rechazo, el agente NO re-propondría.
    //    (mismo chequeo que hace el engine de Comercial antes de proponer.)
    await recordarDecision({ actor: "usuario", accion: "aplicar_precio", entityType: "producto", entityId: `${MARK}-LOOP`, motivo: "rechazada en el Centro", vigenciaDias: 30, kind: "rechazo" });
    const reproponer = await decisionQueBloquea("producto", `${MARK}-LOOP`, "aplicar_precio");
    push("6. Aprendizaje: rechazo previo evita re-proponer", !!reproponer, `bloqueada=${!!reproponer}`);
  } catch (err: any) {
    push("ERROR", false, err?.message ?? String(err));
  } finally {
    try {
      await e(`DELETE FROM memory_entries WHERE mkey LIKE $1 OR value::text LIKE $1`, `%${MARK}%`);
      const rest: any[] = await q(`SELECT COUNT(*)::int n FROM memory_entries WHERE mkey LIKE $1 OR value::text LIKE $1`, `%${MARK}%`);
      limpio = rest[0].n === 0;
    } catch { /* best-effort */ }
  }

  const pass = checks.filter(c => c.ok).length;
  return NextResponse.json({
    marcador: MARK, limpio, resultado: `${pass}/${checks.length}`,
    veredicto: pass === checks.length ? "PASS" : "FAIL", checks,
  });
}
