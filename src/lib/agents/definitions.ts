import type { AgentDef } from "./types";

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
    tools: ["buscar_productos", "consultar_competencia"],
    defaultAutonomy: "manual",
    async handler(ctx) {
      const productos = await ctx.tool<any[]>("buscar_productos", { limit: 50 });
      const recomendaciones: { titulo: string; detalle: string }[] = [];
      let revisados = 0;

      for (const p of productos) {
        if (!p.precio) continue;
        const comp = await ctx.tool<any>("consultar_competencia", { productId: p.id });
        if (!comp?.mercado_prom || comp.competidores === 0) continue;
        revisados++;
        const dif = ((p.precio - comp.mercado_prom) / comp.mercado_prom) * 100;
        if (dif > 10) {
          recomendaciones.push({
            titulo: `${p.nombre}: ${dif.toFixed(0)}% más caro que el mercado`,
            detalle: `Tu precio $${p.precio} vs promedio $${comp.mercado_prom.toFixed(0)}. Revisá en "Mi posición".`,
          });
        } else if (dif < -15) {
          recomendaciones.push({
            titulo: `${p.nombre}: ${Math.abs(dif).toFixed(0)}% debajo del mercado`,
            detalle: `Podrías subir el precio: promedio $${comp.mercado_prom.toFixed(0)} vs tu $${p.precio}. Estás dejando margen.`,
          });
        }
      }

      ctx.log(`Revisados ${revisados} productos con competencia · 0 tokens de IA`);
      return {
        resumen: recomendaciones.length
          ? `${recomendaciones.length} producto(s) fuera de precio respecto del mercado.`
          : `Precios alineados: revisé ${revisados} productos con competencia y ninguno está desfasado.`,
        recomendaciones,
      };
    },
  },
];

export function getAgent(id: string): AgentDef | undefined {
  return AGENTS.find(a => a.id === id);
}
