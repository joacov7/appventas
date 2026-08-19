import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { ESTADOS_VIVOS } from "./recommendations.logic";
import { analizar } from "./jefe-gabinete.logic";
import type { RecoJefe, ResumenJefe } from "./jefe-gabinete.logic";
import { getAI } from "@/lib/ai";

// ─── Jefe de Gabinete (agregador real) ───────────────────────────────────────
// Lee las recomendaciones vivas, las deduplica, agrupa, detecta conflictos,
// prioriza (determinístico) y arma el resumen ejecutivo (top 3-5). La IA, si
// está configurada, SOLO redacta el texto final; nunca elige las prioridades.
// No ejecuta acciones ni crea acciones económicas.

const TENANT_DEFAULT = "default";

async function ensure() { await ensureSchema("agentes"); }

// Carga las recomendaciones vivas + los agentes que las detectaron (fuentes).
async function cargarRecomendaciones(tenantId: string): Promise<RecoJefe[]> {
  const vivos = ESTADOS_VIVOS.map(e => `'${e}'`).join(",");
  const rows: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT r.*, COALESCE(
        (SELECT array_agg(DISTINCT s.agent_id) FROM recommendation_sources s WHERE s.recommendation_id = r.id),
        ARRAY[r.agent_id]
      ) AS agentes
     FROM recommendations r
     WHERE r.tenant_id = $1 AND r.estado IN (${vivos})
     ORDER BY r.prioridad ASC NULLS LAST, r.valor_esperado DESC NULLS LAST, r.id ASC`,
    tenantId);
  return rows.map((r): RecoJefe => ({
    id: Number(r.id), agent_id: r.agent_id, tipo: r.tipo, titulo: r.titulo,
    descripcion: r.descripcion, prioridad: r.prioridad != null ? Number(r.prioridad) : null,
    severidad: r.severidad, impacto_estimado: r.impacto_estimado != null ? Number(r.impacto_estimado) : null,
    valor_esperado: r.valor_esperado != null ? Number(r.valor_esperado) : null,
    confianza: r.confianza != null ? Number(r.confianza) : null,
    estado: r.estado, entity_type: r.entity_type, entity_id: r.entity_id,
    action_tool: r.action_tool, dedup_key: r.dedup_key, metadata: r.metadata,
    agentes: Array.isArray(r.agentes) ? r.agentes : [r.agent_id],
  }));
}

// Redacta el resumen con IA (opcional). Recibe la selección YA hecha y solo la
// reescribe en lenguaje claro. Si no hay IA o falla, devuelve null (→ plantilla).
async function redactarConIA(analisis: ResumenJefe): Promise<{ texto: string; costo: number } | null> {
  try {
    const client = await getAI();
    const payload = {
      conteos: analisis.conteos,
      prioridades: analisis.seleccionadas.map((r, i) => ({
        orden: i + 1, titulo: r.titulo, impacto: r.valor_esperado ?? r.impacto_estimado,
        confianza: r.confianza, severidad: r.severidad,
      })),
      conflictos: analisis.conflictos.map(c => ({ motivo: c.motivo, agentes: c.agentes })),
    };
    const r = await client.complete({
      agentId: "jefe", feature: "agente:jefe", fast: true, maxTokens: 450,
      system:
        "Sos el Jefe de Gabinete de una PyME argentina de mates y regionales. Te paso las prioridades YA seleccionadas y los conflictos detectados. " +
        "Reescribí un resumen ejecutivo breve y claro en español argentino. NO cambies ni reordenes las prioridades, NO agregues ni inventes datos, " +
        "NO propongas acciones nuevas. Si hay conflictos, dejalos claros como advertencia. Devolvé SOLO el texto.",
      messages: [{ role: "user", content: JSON.stringify(payload) }],
    });
    const texto = r.text?.trim();
    if (!texto) return null;
    return { texto, costo: r.costUsd ?? 0 };
  } catch {
    return null; // IA no configurada o error → plantilla determinística
  }
}

export interface ResultadoJefe extends ResumenJefe {
  resumen: string;
  usoIA: boolean;
  costoIA: number;
  fecha: string;
  persistError?: string; // diagnóstico: si falló el guardado en jefe_resumen
}

// Genera (y persiste) el resumen del Jefe para hoy. Idempotente por día (upsert).
export async function generarResumenJefe(opts?: { tenantId?: string; usarIA?: boolean }): Promise<ResultadoJefe> {
  await ensure();
  const tenantId = opts?.tenantId ?? TENANT_DEFAULT;
  const recs = await cargarRecomendaciones(tenantId);
  const analisis = analizar(recs);

  // IA opcional SOLO para redactar (la selección ya está hecha, determinística).
  let resumen = analisis.textoPlantilla;
  let usoIA = false, costoIA = 0, generadoPor = "reglas";
  if (opts?.usarIA !== false && analisis.resultado === "ok") {
    const ia = await redactarConIA(analisis);
    if (ia) { resumen = ia.texto; usoIA = true; costoIA = ia.costo; generadoPor = "ia"; }
  }

  const fecha = new Date().toISOString().slice(0, 10);
  const prioridades = analisis.seleccionadas.map((r, i) => ({
    orden: i + 1, id: r.id, titulo: r.titulo, prioridad: r.prioridad,
    severidad: r.severidad, valor_esperado: r.valor_esperado, confianza: r.confianza, agente: r.agent_id,
  }));
  const seleccionadas = analisis.seleccionadas.map(r => ({ id: r.id, titulo: r.titulo, prioridad: r.prioridad, severidad: r.severidad }));

  let persistError: string | undefined;
  try {
    await (prisma as any).$executeRawUnsafe(
      `INSERT INTO jefe_resumen
         (tenant_id, fecha, consideradas, seleccionadas, conteos, prioridades, conflictos,
          agentes, uso_ia, costo_ia, generado_por, resultado, resumen)
       VALUES ($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10,$11,$12,$13)
       ON CONFLICT (tenant_id, fecha) DO UPDATE SET
         consideradas = EXCLUDED.consideradas, seleccionadas = EXCLUDED.seleccionadas,
         conteos = EXCLUDED.conteos, prioridades = EXCLUDED.prioridades, conflictos = EXCLUDED.conflictos,
         agentes = EXCLUDED.agentes, uso_ia = EXCLUDED.uso_ia, costo_ia = EXCLUDED.costo_ia,
         generado_por = EXCLUDED.generado_por, resultado = EXCLUDED.resultado, resumen = EXCLUDED.resumen,
         generado_en = now()`,
      tenantId, fecha, JSON.stringify(analisis.consideradas), JSON.stringify(seleccionadas),
      JSON.stringify(analisis.conteos), JSON.stringify(prioridades), JSON.stringify(analisis.conflictos),
      JSON.stringify(analisis.agentes), usoIA, costoIA, generadoPor, analisis.resultado, resumen
    );
  } catch (err: any) {
    persistError = err?.message ?? String(err);
  }

  return { ...analisis, resumen, usoIA, costoIA, fecha, persistError };
}

// Último resumen persistido (para el Centro de Decisiones / API).
export async function ultimoResumenJefe(tenantId = TENANT_DEFAULT): Promise<any | null> {
  await ensure();
  try {
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT * FROM jefe_resumen WHERE tenant_id = $1 ORDER BY fecha DESC, generado_en DESC LIMIT 1`, tenantId);
    return rows[0] ?? null;
  } catch { return null; }
}
