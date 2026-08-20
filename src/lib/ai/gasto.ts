import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { estimarCosto } from "./cost";
import { nivelAlerta, featureDeAgente } from "./presupuesto.logic";
import type { EstadoPresupuesto } from "./presupuesto.logic";
import type { AICompleteResult } from "./types";

export { nivelAlerta, featureDeAgente, resolverFeature } from "./presupuesto.logic";
export type { EstadoPresupuesto, NivelAlerta } from "./presupuesto.logic";

// Error cuando se alcanzó el tope mensual de gasto de IA.
export class AIBudgetExceededError extends Error {}

export interface PresupuestoIA {
  limite_usd: number; // 0 = sin límite (global)
  cortar: boolean;    // si true, bloquea las llamadas al superar el límite
  // Tope mensual por agente (USD). Opcional; 0 o ausente = sin tope propio.
  porAgente?: Record<string, number>;
}
export const PRESUPUESTO_DEFAULT: PresupuestoIA = { limite_usd: 0, cortar: false, porAgente: {} };

export async function loadPresupuestoIA(): Promise<PresupuestoIA> {
  try {
    await ensureSchema("config");
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT config FROM catalog_config WHERE tipo = 'ia_presupuesto'`);
    const c = rows[0]?.config ?? {};
    return {
      limite_usd: Number(c.limite_usd) || 0,
      cortar: !!c.cortar,
      porAgente: (c.porAgente && typeof c.porAgente === "object") ? c.porAgente : {},
    };
  } catch { return PRESUPUESTO_DEFAULT; }
}

export async function savePresupuestoIA(p: PresupuestoIA): Promise<void> {
  await ensureSchema("config");
  const porAgente: Record<string, number> = {};
  for (const [k, v] of Object.entries(p.porAgente ?? {})) {
    const n = Math.max(0, Number(v) || 0);
    if (n > 0) porAgente[k] = n;
  }
  const limpio = { limite_usd: Math.max(0, Number(p.limite_usd) || 0), cortar: !!p.cortar, porAgente };
  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO catalog_config (tipo, config) VALUES ('ia_presupuesto', $1::jsonb)
     ON CONFLICT (tipo) DO UPDATE SET config = $1::jsonb, updated_at = NOW()`,
    JSON.stringify(limpio));
}

// Gasto acumulado del mes en curso (USD).
export async function gastoDelMesIA(): Promise<number> {
  try {
    await ensureSchema("ia");
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT COALESCE(SUM(costo_usd),0)::float AS total FROM ai_gasto
       WHERE creado_en >= date_trunc('month', now())`);
    return Number(rows[0]?.total ?? 0);
  } catch { return 0; }
}

// Gasto del mes atribuido a un agente (por la feature "agente:<id>").
export async function gastoDelMesAgente(agentId: string): Promise<number> {
  try {
    await ensureSchema("ia");
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT COALESCE(SUM(costo_usd),0)::float AS total FROM ai_gasto
        WHERE feature = $1 AND creado_en >= date_trunc('month', now())`,
      featureDeAgente(agentId));
    return Number(rows[0]?.total ?? 0);
  } catch { return 0; }
}

// Verifica el tope POR AGENTE antes de una llamada. Lanza si está superado y
// "cortar" está activo. Sin tope propio → no hace nada (los determinísticos ni
// llegan acá porque no llaman a la IA).
export async function verificarPresupuestoAgente(agentId: string, cfg?: PresupuestoIA): Promise<void> {
  const p = cfg ?? await loadPresupuestoIA();
  const limite = Number(p.porAgente?.[agentId]) || 0;
  if (limite <= 0) return; // sin tope propio
  const gastado = await gastoDelMesAgente(agentId);
  if (p.cortar && gastado >= limite) {
    throw new AIBudgetExceededError(`El agente "${agentId}" alcanzó su tope mensual de IA (US$${limite}).`);
  }
}

// Estado del presupuesto por agente (para alertas 50/80/100 y reportes).
export async function resumenPresupuestoAgentes(): Promise<Record<string, EstadoPresupuesto>> {
  const p = await loadPresupuestoIA();
  const out: Record<string, EstadoPresupuesto> = {};
  for (const [agentId, limite] of Object.entries(p.porAgente ?? {})) {
    const gastado = await gastoDelMesAgente(agentId);
    out[agentId] = nivelAlerta(gastado, Number(limite) || 0);
  }
  return out;
}

// Registra el costo de una llamada (best-effort, nunca rompe el flujo).
export async function registrarGastoIA(feature: string, r: AICompleteResult): Promise<void> {
  try {
    await ensureSchema("ia");
    const costo = r.costUsd ?? estimarCosto(r.model, r.usage?.inputTokens, r.usage?.outputTokens) ?? 0;
    await (prisma as any).$executeRawUnsafe(
      `INSERT INTO ai_gasto (feature, model, costo_usd, input_tokens, output_tokens)
       VALUES ($1,$2,$3,$4,$5)`,
      feature || "otros", r.model, costo, r.usage?.inputTokens ?? null, r.usage?.outputTokens ?? null);
  } catch { /* no crítico */ }
}

// Verifica el tope antes de una llamada. Lanza si está superado y "cortar" activo.
export async function verificarPresupuestoIA(): Promise<void> {
  const p = await loadPresupuestoIA();
  if (!p.cortar || p.limite_usd <= 0) return;
  const gasto = await gastoDelMesIA();
  if (gasto >= p.limite_usd) {
    throw new AIBudgetExceededError("Se alcanzó el límite mensual de gasto de IA.");
  }
}

export interface ResumenGastoIA {
  mes: number;
  limite: number;
  cortar: boolean;
  porFuncion: { feature: string; total: number; llamadas: number }[];
  porModelo: { model: string; total: number; llamadas: number }[];
}

export async function resumenGastoIA(): Promise<ResumenGastoIA> {
  const p = await loadPresupuestoIA();
  const base: ResumenGastoIA = { mes: 0, limite: p.limite_usd, cortar: p.cortar, porFuncion: [], porModelo: [] };
  try {
    await ensureSchema("ia");
    const [mes, porFuncion, porModelo] = await Promise.all([
      gastoDelMesIA(),
      (prisma as any).$queryRawUnsafe(
        `SELECT feature, COALESCE(SUM(costo_usd),0)::float AS total, COUNT(*)::int AS llamadas
         FROM ai_gasto WHERE creado_en >= date_trunc('month', now())
         GROUP BY feature ORDER BY total DESC`),
      (prisma as any).$queryRawUnsafe(
        `SELECT model, COALESCE(SUM(costo_usd),0)::float AS total, COUNT(*)::int AS llamadas
         FROM ai_gasto WHERE creado_en >= date_trunc('month', now())
         GROUP BY model ORDER BY total DESC`),
    ]);
    base.mes = mes;
    base.porFuncion = (porFuncion as any[]).map(r => ({ feature: r.feature, total: Number(r.total), llamadas: Number(r.llamadas) }));
    base.porModelo = (porModelo as any[]).map(r => ({ model: r.model, total: Number(r.total), llamadas: Number(r.llamadas) }));
  } catch { /* deja base */ }
  return base;
}
