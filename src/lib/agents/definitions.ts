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

  // ── Finanzas: salud del negocio (sin IA) ──
  {
    id: "finanzas",
    nombre: "Finanzas",
    rol: "Cobros y salud financiera",
    objetivo: "Reporta ingresos, ticket promedio y plata pendiente de cobro. Sin gastar tokens.",
    categoria: "Finanzas",
    tools: ["resumen_financiero"],
    defaultAutonomy: "manual",
    async handler(ctx) {
      const f = await ctx.tool<any>("resumen_financiero");
      const ars = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n);
      const recomendaciones: { titulo: string; detalle: string }[] = [];

      if (f.pendiente_de_cobro > 0) {
        recomendaciones.push({
          titulo: `${ars(f.pendiente_de_cobro)} pendientes de cobro`,
          detalle: `Hay ${f.ordenes_pendientes} orden(es) sin pagar. Seguí esos cobros.`,
        });
      }
      if (f.ticket_promedio != null) {
        recomendaciones.push({
          titulo: `Ticket promedio: ${ars(f.ticket_promedio)}`,
          detalle: `Un combo o venta cruzada puede subirlo. Revisá el módulo Combos.`,
        });
      }
      ctx.log(`ingresos 30d ${ars(f.ingresos_30d)} · ${f.ordenes_pagadas} pagadas · 0 tokens de IA`);
      return {
        resumen: `Ingresos aprobados: ${ars(f.ingresos_aprobados_total)} (${ars(f.ingresos_30d)} últimos 30 días). ${f.ordenes_pagadas} órdenes pagadas.`,
        recomendaciones,
        data: f,
      };
    },
  },

  // ── Marketing: qué producto conviene promocionar (sin IA para decidir) ──
  {
    id: "marketing",
    nombre: "Marketing",
    rol: "Publicidad y contenido",
    objetivo: "Detecta el producto con mejor margen y rotación para publicitar. Sin gastar tokens para decidir.",
    categoria: "Marketing",
    tools: ["productos_para_promocionar"],
    defaultAutonomy: "manual",
    async handler(ctx) {
      const candidatos = await ctx.tool<any[]>("productos_para_promocionar", { limit: 5 });
      const recomendaciones = candidatos.slice(0, 3).map((c, i) => ({
        titulo: `${i + 1}. ${c.nombre}`,
        detalle: `$${c.precio}${c.margen_pct != null ? ` · margen ${c.margen_pct.toFixed(0)}%` : ""} · ${c.ventas_30d} ventas/30d. Generá la campaña desde Meta Ads.`,
      }));
      ctx.log(`${candidatos.length} candidatos evaluados · 0 tokens de IA`);
      return {
        resumen: candidatos.length
          ? `El mejor candidato para publicitar es "${candidatos[0]?.nombre}". Top 3 abajo.`
          : `Sin productos con precio activo para promocionar.`,
        recomendaciones,
      };
    },
  },

  // ── WhatsApp: atiende lo que el bot de reglas no pudo resolver ──
  // Rules primero (el bot ya respondió lo fácil); la IA solo redacta lo difícil.
  {
    id: "whatsapp",
    nombre: "WhatsApp",
    rol: "Atención al cliente",
    objetivo: "Detecta las conversaciones que el bot no pudo resolver y redacta una respuesta para tu aprobación.",
    categoria: "Atención al cliente",
    tools: ["conversaciones_whatsapp_pendientes", "buscar_productos", "enviar_whatsapp"],
    defaultAutonomy: "manual",
    async handler(ctx) {
      const pendientes = await ctx.tool<any[]>("conversaciones_whatsapp_pendientes", { limit: 5 });
      if (!pendientes.length) {
        ctx.log("sin conversaciones pendientes · 0 tokens de IA");
        return { resumen: "No hay conversaciones de WhatsApp esperando atención. El bot resolvió todo.", recomendaciones: [] };
      }

      const recomendaciones: { titulo: string; detalle: string }[] = [];
      for (const c of pendientes) {
        // Contexto real: productos que matcheen la consulta del cliente
        const productos = await ctx.tool<any[]>("buscar_productos", { q: c.ultimo_cliente.slice(0, 40), limit: 3 });
        // IA (último recurso) solo para redactar la respuesta difícil
        const respuesta = await ctx.ai({
          system: "Sos atención al cliente de una tienda argentina de mates. Respondé al cliente por WhatsApp de forma breve, cordial y útil, en español argentino. Usá solo los productos que te paso. Si no hay info suficiente, ofrecé ayuda humana. Devolvé SOLO el texto del mensaje.",
          messages: [{ role: "user", content: `Cliente escribió: "${c.ultimo_cliente}"\n\nProductos relacionados: ${JSON.stringify(productos)}` }],
          maxTokens: 250,
        });
        // Propone enviar la respuesta → cae en Aprobaciones (o se envía en autónomo)
        await ctx.tool("enviar_whatsapp", { to: c.wa_id, texto: respuesta.trim() });
        recomendaciones.push({
          titulo: `Respuesta propuesta para ${c.wa_id}`,
          detalle: `Cliente: "${c.ultimo_cliente.slice(0, 60)}..." → ${respuesta.trim().slice(0, 120)}`,
        });
      }
      ctx.log(`${pendientes.length} conversaciones · ${pendientes.length} respuestas redactadas`);
      return {
        resumen: `${pendientes.length} conversación(es) necesitaban atención. Redacté las respuestas — revisalas en Aprobaciones.`,
        recomendaciones,
      };
    },
  },
];

export function getAgent(id: string): AgentDef | undefined {
  return AGENTS.find(a => a.id === id);
}
