export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { enforceWrite, registrarAccion } from "@/lib/agents";
import type { PoliciesConfig } from "@/lib/agents";

// ⚠️ ENDPOINT TEMPORAL — verifica el enforcement del Paso 4 contra la base real.
// Se elimina después de usarlo. Protegido por token. NO ejecuta ninguna tool ni
// cambia precios: enforceWrite solo EVALÚA (lectura). Lo único que escribe son
// filas de auditoría en un tenant aislado (smoke4-<ts>), que se limpian al final.
const TOKEN = "01ca9479afa5fe129b8b7ad0d92c2c9f";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const TENANT = `smoke4-${Date.now()}`;
  const checks: { paso: string; ok: boolean; detalle?: string }[] = [];
  const push = (paso: string, ok: boolean, detalle?: string) => checks.push({ paso, ok, detalle });
  const q = (sql: string, ...a: any[]) => (prisma as any).$queryRawUnsafe(sql, ...a);
  const e = (sql: string, ...a: any[]) => (prisma as any).$executeRawUnsafe(sql, ...a);
  let tenantLimpio = false;

  try {
    await ensureSchema("agentes");

    // Config de prueba EN MEMORIA (no toca la config compartida).
    const cfgVacia: PoliciesConfig = { global: {}, tools: {}, perAgentTool: {} };

    // 1. Retro-compat: sin config, manual propone / autónomo ejecuta.
    const rc1 = await enforceWrite({ agentId: "comercial", tool: "aplicar_precio", input: { productId: "X", precio: 100 }, agentAutonomy: "manual", cfg: cfgVacia, tenantId: TENANT });
    const rc2 = await enforceWrite({ agentId: "comercial", tool: "aplicar_precio", input: { productId: "X", precio: 100 }, agentAutonomy: "autonomous", cfg: cfgVacia, tenantId: TENANT });
    push("1. Retro-compat (manual=propone, autónomo=ejecuta)",
      rc1.allow && rc1.requireApproval && rc2.allow && !rc2.requireApproval,
      `manual.req=${rc1.requireApproval}, auto.req=${rc2.requireApproval}`);

    // 2. allowed=false bloquea.
    const cfgOff: PoliciesConfig = { tools: { enviar_whatsapp: { allowed: false } } };
    const off = await enforceWrite({ agentId: "whatsapp", tool: "enviar_whatsapp", input: { to: "549110", texto: "x" }, agentAutonomy: "autonomous", cfg: cfgOff, tenantId: TENANT });
    push("2. allowed=false bloquea", !off.allow, off.motivo);

    // 3. Producto protegido bloquea.
    const cfgProt: PoliciesConfig = { global: { protected_products: ["PROT-1"] } };
    const prot = await enforceWrite({ agentId: "comercial", tool: "aplicar_precio", input: { productId: "PROT-1", precio: 100 }, agentAutonomy: "autonomous", cfg: cfgProt, tenantId: TENANT });
    push("3. Producto protegido bloquea", !prot.allow, prot.motivo);

    // 4-5. Reglas de precio contra un producto REAL con precio > 0 (solo lectura).
    const variante = await prisma.productVariant.findFirst({ where: { active: true, price: { gt: "0" } }, orderBy: { price: "desc" } }).catch(() => null);
    if (variante) {
      const pid = variante.productId;
      const actual = Number(variante.price);
      const cfgCap: PoliciesConfig = { tools: { aplicar_precio: { max_change_percent: 5 } } };
      const grande = await enforceWrite({ agentId: "comercial", tool: "aplicar_precio", input: { productId: pid, precio: Math.round(actual * 1.5) }, agentAutonomy: "autonomous", cfg: cfgCap, tenantId: TENANT });
      const chico = await enforceWrite({ agentId: "comercial", tool: "aplicar_precio", input: { productId: pid, precio: Math.round(actual * 1.03) }, agentAutonomy: "autonomous", cfg: cfgCap, tenantId: TENANT });
      push("4. max_change_percent bloquea +50% y permite +3%", !grande.allow && chico.allow, `precio_actual=${actual} · +50%→${grande.allow ? "permite" : "bloquea"} (${grande.motivo ?? "-"}), +3%→${chico.allow ? "permite" : "bloquea"}`);
    } else {
      push("4. max_change_percent (sin producto con precio>0, omitido)", true, "no hay variantes activas con precio en la base");
    }

    // 6. Tope diario: registro 2 acciones y una política de máx 2 bloquea la 3ª.
    await registrarAccion({ tool: "enviar_whatsapp", modo: "ejecutada", tenantId: TENANT });
    await registrarAccion({ tool: "enviar_whatsapp", modo: "ejecutada", tenantId: TENANT });
    const cfgDia: PoliciesConfig = { tools: { enviar_whatsapp: { max_daily_actions: 2 } } };
    const dia = await enforceWrite({ agentId: "whatsapp", tool: "enviar_whatsapp", input: { to: "549110", texto: "x" }, agentAutonomy: "autonomous", cfg: cfgDia, tenantId: TENANT });
    push("6. Tope diario bloquea al alcanzarlo", !dia.allow, dia.motivo);

    // 7. Auditoría: las 2 filas quedaron registradas en el tenant aislado.
    const audit: any[] = await q(`SELECT COUNT(*)::int AS n FROM agent_tool_actions WHERE tenant_id=$1 AND modo='ejecutada'`, TENANT);
    push("7. agent_tool_actions registra (auditoría)", audit[0].n === 2, `filas=${audit[0].n}`);
  } catch (err: any) {
    push("ERROR", false, err?.message ?? String(err));
  } finally {
    try {
      await e(`DELETE FROM agent_tool_actions WHERE tenant_id=$1`, TENANT);
      const rest: any[] = await q(`SELECT COUNT(*)::int AS n FROM agent_tool_actions WHERE tenant_id=$1`, TENANT);
      tenantLimpio = rest[0].n === 0;
    } catch { /* best-effort */ }
  }

  const pass = checks.filter((c) => c.ok).length;
  return NextResponse.json({
    tenant: TENANT, tenant_limpio: tenantLimpio,
    resultado: `${pass}/${checks.length}`,
    veredicto: pass === checks.length ? "PASS" : "FAIL",
    checks,
  });
}
