import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { registry } from "@/lib/tools";
import { getAI } from "@/lib/ai";
import { recall as memRecall, remember as memRemember } from "@/lib/memory";
import { createOrMerge, dedupKey, vincularAccion, transicionar } from "./recommendations";
import { enforceWrite, registrarAccion, loadPolicies } from "./policies";
import { decisionQueBloquea } from "./memoria-estructurada";
import type { PoliciesConfig } from "./policies";
import type { AgentDef, AgentRunContext, AgentRunResult, AgentTelemetry, AutonomyMode } from "./types";

async function ensureTables() {
  await ensureSchema("agentes");
}

// ── Enlace write → recommendation (Paso 2A, SOLO Comercial) ─────────────────
// Cuando Comercial PROPONE un cambio de precio, además de encolarlo crea/mergea
// una recomendación accionable (intención) vinculada a esa fila de action_queue
// (orden ejecutable). Garantiza 1 recomendación → máximo 1 action_queue.
// Devuelve el id de recomendación (o null si no aplica).
async function recomendacionComercial(
  runId: number | null, tool: string, input: any
): Promise<{ recoId: number; actionQueueId: number | null } | null> {
  const productId = input?.productId != null ? String(input.productId) : null;
  if (!productId) return null;

  let precioActual: number | null = null, nombre: string | null = null;
  try {
    const v = await prisma.productVariant.findFirst({ where: { productId, active: true }, orderBy: { price: "asc" } });
    precioActual = v ? Number(v.price) : null;
  } catch { /* noop */ }
  try {
    const p = await prisma.product.findUnique({ where: { id: productId } });
    nombre = (p as any)?.name ?? null;
  } catch { /* noop */ }

  const nuevo = Number(input?.precio);
  let pct: number | null = null, direccion: string | null = null;
  if (precioActual != null && precioActual > 0 && Number.isFinite(nuevo)) {
    pct = Math.round(((nuevo - precioActual) / precioActual) * 1000) / 10;
    direccion = nuevo < precioActual ? "baja" : nuevo > precioActual ? "suba" : "igual";
  }
  const titulo = `Ajuste de precio sugerido${nombre ? `: ${nombre}` : ""}`;
  const descripcion = precioActual != null
    ? `Precio actual $${precioActual} → sugerido $${nuevo}${pct != null ? ` (${pct > 0 ? "+" : ""}${pct}%)` : ""}.`
    : `Precio sugerido $${nuevo}.`;

  const { recommendation } = await createOrMerge({
    agentId: "comercial", agentRunId: runId ?? undefined, tipo: "precio",
    titulo, descripcion, entityType: "producto", entityId: productId,
    severidad: "importante", origenConfianza: "inferencia_alta",
    actionTool: tool, actionInput: input,
    metadata: { direccion, precioActual, pct, origen: "engine:comercial" },
  });
  return { recoId: recommendation.id, actionQueueId: recommendation.action_queue_id };
}

// Slug corto y estable de un texto, para armar dedup_key de recomendaciones
// "legacy" (las que llegan por AgentDecision, sin entidad asociada).
function slug(s: string): string {
  return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

// Ejecuta un agente aplicando el flujo memoria→reglas→datos→IA→experiencia,
// registrando toda la telemetría y respetando el modo de autonomía.
export async function runAgent(def: AgentDef, autonomy: AutonomyMode): Promise<AgentRunResult> {
  await ensureTables();
  const t0 = Date.now();
  const tel: AgentTelemetry = {
    toolsUsados: [], memoriaConsultas: 0, memoriaEscrituras: 0,
    llamadasIA: 0, model: null, costUsd: 0, logs: [], accionesPropuestas: [],
    recomendaciones: 0,
  };

  // Políticas de herramientas (Paso 4). Se cargan una vez por corrida. Sin
  // config, los defaults son permisivos → el comportamiento no cambia.
  let policiesCfg: PoliciesConfig | undefined;
  try { policiesCfg = await loadPolicies(); } catch { /* defaults */ }
  // Veces que cada tool de escritura corrió/propuso en esta ejecución
  // (para el límite max_items_per_run).
  const accionesPorTool = new Map<string, number>();

  // Se inserta la corrida al INICIO para tener agent_run_id disponible y poder
  // vincular las recomendaciones que se generen durante la ejecución. Al final
  // se completa (ok/decision/telemetry/costo/ms). Si la inserción falla, se
  // sigue igual con runId = null (las recomendaciones quedan sin run vinculado).
  let runId: number | null = null;
  try {
    const ins: any[] = await (prisma as any).$queryRawUnsafe(
      `INSERT INTO agent_runs (agent_id, ok, estado, telemetry) VALUES ($1, NULL, 'running', '{}'::jsonb) RETURNING id`,
      def.id);
    runId = ins[0]?.id != null ? Number(ins[0].id) : null;
  } catch { /* best-effort */ }

  const ctx: AgentRunContext = {
    agentId: def.id,
    autonomy,
    async recall(input) {
      tel.memoriaConsultas++;
      return memRecall(input as any);
    },
    async remember(input) {
      tel.memoriaEscrituras++;
      await memRemember(input as any);
    },
    async tool(name, input) {
      if (!def.tools.includes(name)) {
        tel.logs.push(`⚠️ tool "${name}" no permitida para ${def.id}`);
        throw new Error(`El agente no tiene permiso para usar "${name}"`);
      }
      const toolDef = registry.get(name);

      // ── Escritura: pasa por la capa de políticas (enforcement server-side) ──
      if (toolDef?.sideEffect === "write") {
        const entityId = input?.productId ?? input?.clientId ?? input?.to ?? null;
        const ejecutadasEnRun = accionesPorTool.get(name) ?? 0;
        const verdict = await enforceWrite({
          agentId: def.id, tool: name, input, agentAutonomy: autonomy,
          ejecutadasEnRun, cfg: policiesCfg,
        });

        // Bloqueada por política → no se ejecuta ni se propone.
        if (!verdict.allow) {
          tel.logs.push(`⛔ ${name} bloqueado por política: ${verdict.motivo}`);
          await registrarAccion({ agentId: def.id, agentRunId: runId ?? undefined, tool: name, modo: "bloqueada", motivo: verdict.motivo, entityId: entityId != null ? String(entityId) : null });
          return { bloqueada: true, motivo: verdict.motivo } as any;
        }

        // Memoria de decisiones (Fase 4): si el usuario ya rechazó esta acción
        // sobre esta entidad y la decisión sigue vigente, no se re-propone.
        if (def.id === "comercial" && name === "aplicar_precio" && input?.productId) {
          const bloq = await decisionQueBloquea("producto", String(input.productId), "aplicar_precio").catch(() => null);
          if (bloq) {
            const motivo = `decisión previa de ${bloq.actor}${bloq.motivo ? `: ${bloq.motivo}` : ""}`;
            tel.logs.push(`🧠 ${name} no propuesto — ${motivo}`);
            await registrarAccion({ agentId: def.id, agentRunId: runId ?? undefined, tool: name, modo: "bloqueada", motivo, entityId: String(input.productId) });
            return { bloqueada: true, motivo } as any;
          }
        }

        // Requiere aprobación (autonomía efectiva ≠ autónomo, o requires_approval).
        if (verdict.requireApproval) {
          tel.accionesPropuestas.push({ tool: name, input });

          // Comercial: crea/mergea la recomendación accionable ANTES de encolar,
          // y mantiene el vínculo 1:1 con action_queue. Si la recomendación ya
          // tenía una acción pendiente, se REFRESCA esa fila (no se duplica);
          // si no, se inserta una nueva y se vincula.
          let recoComercial: { recoId: number; actionQueueId: number | null } | null = null;
          if (def.id === "comercial") {
            try { recoComercial = await recomendacionComercial(runId ?? null, name, input); }
            catch (e: any) { tel.logs.push(`✗ reco comercial: ${e?.message ?? "error"}`); }
          }

          try {
            if (recoComercial?.actionQueueId) {
              // Ya hay una orden pendiente vinculada → refrescar su input.
              await (prisma as any).$executeRawUnsafe(
                `UPDATE action_queue SET input = $2::jsonb WHERE id = $1 AND estado = 'pendiente'`,
                recoComercial.actionQueueId, JSON.stringify(input ?? {})
              );
              tel.logs.push(`📝 ${name}: orden pendiente actualizada (aq=${recoComercial.actionQueueId})`);
            } else {
              const ins: any[] = await (prisma as any).$queryRawUnsafe(
                `INSERT INTO action_queue (agent_id, tool, input, estado) VALUES ($1,$2,$3::jsonb,'pendiente') RETURNING id`,
                def.id, name, JSON.stringify(input ?? {})
              );
              const aqId = ins[0]?.id != null ? Number(ins[0].id) : null;
              // Vincula 1:1 la recomendación con su orden ejecutable.
              if (recoComercial && aqId != null) {
                await vincularAccion(recoComercial.recoId, aqId);
                await transicionar(recoComercial.recoId, "pending_approval").catch(() => {});
              }
              tel.logs.push(`📝 ${name} encolado en Aprobaciones${aqId ? ` (aq=${aqId})` : ""}`);
            }
          } catch (e: any) {
            tel.logs.push(`✗ no se pudo encolar ${name}: ${e?.message ?? "error"}`);
          }

          if (recoComercial) tel.recomendaciones++; // evita que el shim duplique
          accionesPorTool.set(name, ejecutadasEnRun + 1);
          await registrarAccion({ agentId: def.id, agentRunId: runId ?? undefined, tool: name, modo: "propuesta", entityId: entityId != null ? String(entityId) : null });
          return { propuesta: true } as any;
        }

        // Autónomo + permitido + dentro de límites → se ejecuta de verdad.
        const wres = await registry.execute(name, input);
        tel.toolsUsados.push(name);
        accionesPorTool.set(name, ejecutadasEnRun + 1);
        if (wres.ok) {
          await registrarAccion({ agentId: def.id, agentRunId: runId ?? undefined, tool: name, modo: "ejecutada", entityId: entityId != null ? String(entityId) : null });
        } else {
          tel.logs.push(`✗ ${name}: ${wres.error}`);
        }
        return wres.output;
      }

      // ── Lectura: se ejecuta siempre (no toca nada) ──
      const res = await registry.execute(name, input);
      tel.toolsUsados.push(name);
      if (!res.ok) tel.logs.push(`✗ ${name}: ${res.error}`);
      return res.output;
    },
    async ai(input) {
      tel.llamadasIA++;
      const client = await getAI();
      // Atribuye el gasto al agente y activa su tope mensual propio (Paso 5).
      const r = await client.complete({ ...(input as any), agentId: def.id, feature: (input as any).feature ?? `agente:${def.id}` });
      tel.model = r.model;
      tel.costUsd += r.costUsd ?? 0;
      tel.logs.push(`🤖 IA ${r.model} · ${r.ms}ms · ~$${(r.costUsd ?? 0).toFixed(5)}`);
      return r.text;
    },
    // Persiste una recomendación. El engine inyecta agentId y agentRunId; el
    // handler solo describe el hallazgo. Dedup automática dentro de createOrMerge.
    async recommend(input) {
      try {
        await createOrMerge({ ...input, agentId: def.id, agentRunId: runId ?? undefined });
        tel.recomendaciones++;
      } catch (e: any) {
        tel.logs.push(`✗ recommend: ${e?.message ?? "error"}`);
      }
    },
    log(msg) { tel.logs.push(msg); },
  };

  let ok = true, error: string | undefined, decision = null as any;
  try {
    decision = await def.handler(ctx);
  } catch (e: any) {
    ok = false;
    error = e?.message ?? "Error en el agente";
    tel.logs.push(`✗ ${error}`);
  }

  // ── Shim retro-compatible ──────────────────────────────────────────────────
  // Si el handler NO usó ctx.recommend (agentes actuales, sin modificar) pero
  // devolvió recomendaciones en la AgentDecision, se persisten acá. Se les da
  // una dedup_key estable por agente+título para que re-ejecutar el mismo
  // agente no acumule duplicados (se mergea con la viva).
  if (ok && tel.recomendaciones === 0 && Array.isArray(decision?.recomendaciones)) {
    for (const r of decision.recomendaciones) {
      const titulo = String(r?.titulo ?? "").trim();
      if (!titulo) continue;
      try {
        await createOrMerge({
          agentId: def.id,
          agentRunId: runId ?? undefined,
          tipo: def.id,
          titulo,
          descripcion: r?.detalle ? String(r.detalle) : undefined,
          severidad: "oportunidad",
          // Origen neutro: son resúmenes por reglas de los agentes actuales.
          origenConfianza: "inferencia_media",
          dedupKey: dedupKey({ tipo: def.id, extra: slug(titulo) }),
          metadata: { origen: "shim:AgentDecision" },
        });
        tel.recomendaciones++;
      } catch { /* no crítico */ }
    }
  }

  const ms = Date.now() - t0;
  // Completa la corrida insertada al inicio. Si no se pudo insertar (runId null),
  // cae al INSERT clásico para no perder la telemetría.
  const estadoFinal = ok ? "completed" : "failed";
  if (runId != null) {
    await (prisma as any).$executeRawUnsafe(
      `UPDATE agent_runs SET ok = $2, estado = $3, decision = $4::jsonb, telemetry = $5::jsonb,
              cost_usd = $6, ms = $7, finished_at = now() WHERE id = $1`,
      runId, ok, estadoFinal, JSON.stringify(decision), JSON.stringify(tel), tel.costUsd, ms
    ).catch(() => {});
  } else {
    await (prisma as any).$executeRawUnsafe(
      `INSERT INTO agent_runs (agent_id, ok, estado, decision, telemetry, cost_usd, ms, finished_at)
       VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7, now())`,
      def.id, ok, estadoFinal, JSON.stringify(decision), JSON.stringify(tel), tel.costUsd, ms
    ).catch(() => {});
  }

  return { agentId: def.id, ok, autonomy, decision, telemetry: tel, ms, error };
}

export async function lastRuns(agentId?: string, limit = 10): Promise<any[]> {
  await ensureTables();
  try {
    if (agentId) {
      return await (prisma as any).$queryRawUnsafe(
        `SELECT * FROM agent_runs WHERE agent_id = $1 ORDER BY created_at DESC LIMIT $2`, agentId, limit);
    }
    return await (prisma as any).$queryRawUnsafe(
      `SELECT DISTINCT ON (agent_id) * FROM agent_runs ORDER BY agent_id, created_at DESC`);
  } catch {
    return [];
  }
}
