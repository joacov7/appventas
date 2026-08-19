import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { remember } from "@/lib/memory";
import { agregarMetricas } from "./resultados.logic";
import type { TipoResultado, MetricasResultados } from "./resultados.logic";

export { TIPOS_RESULTADO, esPositivo, esNegativo, agregarMetricas } from "./resultados.logic";
export type { TipoResultado, ResultadoRow, MetricasResultados } from "./resultados.logic";

const TENANT_DEFAULT = "default";
async function ensure() { await ensureSchema("agentes"); }

export interface RegistrarResultadoInput {
  recommendationId?: number | null;
  actionQueueId?: number | null;
  tipo: TipoResultado;
  valorReal?: number | null;
  detalle?: any;
  fuente?: "sistema" | "usuario" | "evento";
  ventaId?: string | null;
  tenantId?: string;
}

// Registra un resultado (trazable). Vincula la recomendación con su result_id y
// aprende del resultado (memoria), de forma best-effort.
export async function registrarResultado(input: RegistrarResultadoInput): Promise<number | null> {
  await ensure();
  const tenant = input.tenantId ?? TENANT_DEFAULT;
  try {
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `INSERT INTO action_results (tenant_id, recommendation_id, action_queue_id, tipo, valor_real, detalle, fuente, venta_id)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8) RETURNING id`,
      tenant, input.recommendationId ?? null, input.actionQueueId ?? null, input.tipo,
      input.valorReal ?? null, JSON.stringify(input.detalle ?? null), input.fuente ?? "sistema",
      input.ventaId ?? null);
    const id = rows[0]?.id != null ? Number(rows[0].id) : null;
    // Enlaza el último resultado con la recomendación (columna result_id ya existe).
    if (id && input.recommendationId) {
      await (prisma as any).$executeRawUnsafe(
        `UPDATE recommendations SET result_id = $2, updated_at = now() WHERE id = $1`,
        input.recommendationId, id).catch(() => {});
      // Aprendizaje trazable: guarda el resultado observado en memoria.
      remember({
        namespace: "aprendizajes", kind: "resultado_accion",
        key: `resultado:${input.recommendationId}:${id}`,
        value: { recommendationId: input.recommendationId, tipo: input.tipo, valorReal: input.valorReal ?? null },
        source: "resultados", tags: ["resultado", input.tipo], confidence: 0.7,
      }).catch(() => {});
    }
    return id;
  } catch { return null; }
}

// Atribuye una VENTA a una recomendación por vínculo EXPLÍCITO (no por ventana
// temporal). Registra un resultado 'compro' con el valor real de la venta.
export async function atribuirVenta(
  recommendationId: number, venta: { ventaId: string; valor: number },
  fuente: "usuario" | "evento" = "usuario", tenantId?: string
): Promise<number | null> {
  return registrarResultado({
    recommendationId, tipo: "compro", valorReal: venta.valor,
    ventaId: venta.ventaId, fuente, detalle: { ventaId: venta.ventaId }, tenantId,
  });
}

export async function resultadosDe(recommendationId: number): Promise<any[]> {
  await ensure();
  try {
    return await (prisma as any).$queryRawUnsafe(
      `SELECT id, tipo, valor_real, fuente, venta_id, detalle, created_at
         FROM action_results WHERE recommendation_id = $1 ORDER BY created_at ASC`, recommendationId);
  } catch { return []; }
}

export interface ResumenResultados {
  reales: MetricasResultados;
  // Valor ESTIMADO acumulado de las recomendaciones ya ejecutadas (separado del real).
  valorEstimadoEjecutadas: number;
  recomendacionesEjecutadas: number;
}

// Métricas del mes: resultados reales + valor estimado (separados).
export async function resumenResultados(tenantId = TENANT_DEFAULT): Promise<ResumenResultados> {
  await ensure();
  let reales: MetricasResultados = { total: 0, porTipo: {}, positivos: 0, negativos: 0, valorRealTotal: 0, conValorReal: 0 };
  let valorEstimadoEjecutadas = 0, recomendacionesEjecutadas = 0;
  try {
    const res: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT tipo, valor_real FROM action_results
        WHERE tenant_id = $1 AND created_at >= date_trunc('month', now())`, tenantId);
    reales = agregarMetricas(res.map(r => ({ tipo: r.tipo, valor_real: r.valor_real != null ? Number(r.valor_real) : null })));

    const est: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT COUNT(*)::int AS n, COALESCE(SUM(valor_esperado),0)::float AS total
         FROM recommendations
        WHERE tenant_id = $1 AND estado = 'executed' AND updated_at >= date_trunc('month', now())`, tenantId);
    recomendacionesEjecutadas = est[0]?.n ?? 0;
    valorEstimadoEjecutadas = Number(est[0]?.total ?? 0);
  } catch { /* deja base */ }
  return { reales, valorEstimadoEjecutadas, recomendacionesEjecutadas };
}
