import type { AgentDef } from "./types";
import { calcularSugerencia } from "@/lib/services/pricing.service";

export const AGENTS: AgentDef[] = [
  // ── CEO: resumen y prioridades del día (usa IA para redactar) ──
  {
    id: "ceo",
    nombre: "CEO",
    rol: "Dirección",
    objetivo: "Cada día resume el estado del negocio y prioriza las acciones de mayor impacto.",
    categoria: "Dirección",
    tools: ["resumen_negocio", "consultar_prospectos_resumen"],
    defaultAutonomy: "manual",
    async handler(ctx) {
      // 1. Memoria: decisiones recientes del usuario
      const decisiones = await ctx.recall({ namespace: "decisiones", limit: 5 });
      // 3. Datos del sistema (tools de lectura)
      const datos = await ctx.tool<any>("resumen_negocio");
      // 4. IA como último recurso: redactar el briefing
      const texto = await ctx.ai({
        system: `Sos el CEO virtual de una tienda de mates y regionales. Con los datos, escribí un resumen corto (2-3 oraciones) y hasta 4 acciones priorizadas por impacto. Español argentino. JSON: {"resumen":"...","acciones":[{"titulo":"...","detalle":"..."}]}`,
        messages: [{ role: "user", content: `Datos:\n${JSON.stringify(datos)}\n\nDecisiones recientes del dueño:\n${JSON.stringify(decisiones.map(d => d.value))}` }],
        maxTokens: 800, json: true,
      });
      const parsed = (() => { try { return JSON.parse(texto.match(/\{[\s\S]*\}/)?.[0] ?? "{}"); } catch { return {}; } })();
      // 5. Guardar experiencia
      await ctx.remember({
        namespace: "aprendizajes", kind: "briefing", key: `ceo:${new Date().toISOString().slice(0, 10)}`,
        value: { resumen: parsed.resumen }, source: "agente-ceo", confidence: 0.6,
      });
      return {
        resumen: String(parsed.resumen ?? "Sin novedades relevantes."),
        recomendaciones: Array.isArray(parsed.acciones) ? parsed.acciones.slice(0, 4) : [],
        data: datos,
      };
    },
  },

  // ── Comercial: revisa precios vs mercado SIN IA (pura matemática) ──
  {
    id: "comercial",
    nombre: "Comercial",
    rol: "Ventas y precios",
    objetivo: "Detecta productos mal posicionados frente a la competencia. Resuelve con reglas, sin gastar tokens.",
    categoria: "Comercial",
    tools: ["buscar_productos", "consultar_competencia", "aplicar_precio"],
    defaultAutonomy: "manual",
    async handler(ctx) {
      const productos = await ctx.tool<any[]>("buscar_productos", { limit: 50 });
      const recomendaciones: { titulo: string; detalle: string }[] = [];
      let revisados = 0, propuestas = 0;

      for (const p of productos) {
        if (!p.precio) continue;
        const comp = await ctx.tool<any>("consultar_competencia", { productId: p.id });
        if (!comp?.mercado_prom || comp.competidores === 0) continue;
        revisados++;

        // Sugerencia determinística (misma lógica que "Mi posición"), sin IA
        const sug = calcularSugerencia(p.precio, p.costo ?? null, comp.mercado_min, comp.mercado_prom);
        if (!sug) continue;

        recomendaciones.push({
          titulo: `${p.nombre}: ${sug.motivo}`,
          detalle: `Precio sugerido $${sug.precio}${sug.margen_resultante != null ? ` (margen ${sug.margen_resultante.toFixed(0)}%)` : ""}. Tu precio actual: $${p.precio}.`,
        });
        // Propone el cambio: en manual/asistido va a Aprobaciones; en autónomo se aplica
        await ctx.tool("aplicar_precio", { productId: p.id, precio: sug.precio });
        propuestas++;
      }

      ctx.log(`Revisados ${revisados} productos con competencia · ${propuestas} ajustes propuestos · 0 tokens de IA`);
      return {
        resumen: propuestas
          ? `${propuestas} ajuste(s) de precio propuesto(s). Revisalos en Aprobaciones.`
          : `Precios alineados: revisé ${revisados} productos con competencia y ninguno necesita ajuste.`,
        recomendaciones,
      };
    },
  },

  // ── Compras: qué reponer, según stock bajo y rotación (sin IA) ──
  {
    id: "compras",
    nombre: "Compras",
    rol: "Abastecimiento",
    objetivo: "Avisa qué productos reponer por stock bajo y cuáles frenar por baja rotación. Sin gastar tokens.",
    categoria: "Compras",
    tools: ["resumen_negocio"],
    defaultAutonomy: "manual",
    async handler(ctx) {
      const datos = await ctx.tool<any>("resumen_negocio");
      const recomendaciones: { titulo: string; detalle: string }[] = [];

      for (const s of datos?.stock_bajo ?? []) {
        recomendaciones.push({
          titulo: `Reponer: ${s.producto} — ${s.variante}`,
          detalle: `Quedan ${s.stock} unidades. Conviene comprar antes de quedarte sin stock.`,
        });
      }
      for (const p of (datos?.sin_rotacion_30d ?? []).slice(0, 5)) {
        recomendaciones.push({
          titulo: `Baja rotación: ${p.producto}`,
          detalle: `Sin ventas en 30 días. Evaluá no reponerlo o armar un combo/oferta.`,
        });
      }

      ctx.log(`stock bajo: ${(datos?.stock_bajo ?? []).length} · sin rotación: ${(datos?.sin_rotacion_30d ?? []).length} · 0 tokens de IA`);
      return {
        resumen: recomendaciones.length
          ? `${recomendaciones.length} alerta(s) de abastecimiento.`
          : `Abastecimiento en orden: sin stock crítico ni productos frenados.`,
        recomendaciones,
      };
    },
  },
];

export function getAgent(id: string): AgentDef | undefined {
  return AGENTS.find(a => a.id === id);
}
