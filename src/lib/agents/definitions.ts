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

  // ── Calendario: avisa fechas comerciales con anticipación y prepara campaña ──
  {
    id: "calendario",
    nombre: "Calendario",
    rol: "Fechas y campañas de temporada",
    objetivo: "Avisa con anticipación las fechas comerciales importantes (Día de la Madre, Navidad, etc.) y prepara el gancho de la campaña.",
    categoria: "Marketing",
    tools: ["fechas_comerciales", "productos_para_promocionar", "generar_campana"],
    defaultAutonomy: "manual",
    async handler(ctx) {
      const fechas = await ctx.tool<any[]>("fechas_comerciales", { ventanaDias: 45 });
      if (!fechas.length) {
        ctx.log("sin fechas comerciales en los próximos 45 días · 0 tokens de IA");
        return { resumen: "No hay fechas comerciales importantes en los próximos 45 días.", recomendaciones: [] };
      }

      const recomendaciones = fechas.map(f => ({
        titulo: `${f.nombre} — en ${f.dias_restantes} día${f.dias_restantes !== 1 ? "s" : ""} (${f.fecha})`,
        detalle: `${f.relevancia === "alta" ? "🔥 " : ""}${f.angulo}`,
      }));

      // Fecha fuerte más cercana: si está a ≤21 días, generar la campaña
      // completa ambientada en esa fecha (propuesta → Aprobaciones).
      const destacada = fechas.find(f => f.relevancia === "alta") ?? fechas[0];
      let campanaGenerada = false;
      if (destacada.dias_restantes <= 21) {
        const candidatos = await ctx.tool<any[]>("productos_para_promocionar", { limit: 1 });
        const producto = candidatos[0];
        if (producto) {
          await ctx.tool("generar_campana", { productId: producto.id, ocasion: destacada.nombre });
          campanaGenerada = true;
          recomendaciones.unshift({
            titulo: `📣 Campaña de ${destacada.nombre} preparada con "${producto.nombre}"`,
            detalle: `El borrador de campaña ambientado en ${destacada.nombre} espera tu aprobación. Revisalo en Aprobaciones (o en Meta Ads si estás en modo autónomo).`,
          });
        }
      }

      ctx.log(`${fechas.length} fechas próximas · destacada: ${destacada.nombre} en ${destacada.dias_restantes} días${campanaGenerada ? " · campaña propuesta" : ""}`);
      return {
        resumen: `La próxima fecha fuerte es ${destacada.nombre}, en ${destacada.dias_restantes} días.${campanaGenerada ? " Preparé el borrador de campaña — está en Aprobaciones." : " Todavía hay tiempo; cuando esté a ~3 semanas, preparo la campaña sola."}`,
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

  // ── Inteligencia Comercial: alertas de precio de todo el catálogo (sin IA) ──
  {
    id: "inteligencia",
    nombre: "Inteligencia Comercial",
    rol: "Posición vs. competencia",
    objetivo: "Escanea todo el catálogo vinculado a competidores y alerta dónde estás caro, barato o un rival bajó. Determinístico, 0 tokens.",
    categoria: "Comercial",
    tools: ["alertas_precio"],
    defaultAutonomy: "manual",
    async handler(ctx) {
      const res = await ctx.tool<any>("alertas_precio", {});
      const accionables = (res?.alertas ?? []).filter((a: any) => a.tipo !== "ok");

      const recomendaciones = accionables.slice(0, 15).map((a: any) => ({
        titulo: `${a.producto}: ${etiquetaAlerta(a.tipo)}`,
        detalle: `${a.mensaje} Tu precio: ${a.mi_precio != null ? "$" + a.mi_precio : "s/d"} · Mercado prom.: ${a.mercado_prom != null ? "$" + Math.round(a.mercado_prom) : "s/d"} (${a.competidores} comp.).`,
      }));

      // Guarda el pulso de mercado para que otros agentes lo aprovechen.
      if (res?.productos_monitoreados) {
        await ctx.remember({
          namespace: "mercado", kind: "pulso_precios", key: `pulso:${new Date().toISOString().slice(0, 10)}`,
          value: { caros: res.caros, baratos: res.baratos, competencia_bajo: res.competencia_bajo, monitoreados: res.productos_monitoreados },
          source: "agente-inteligencia", tags: ["precios", "competencia"], confidence: 0.9,
        }).catch(() => {});
      }

      ctx.log(`Monitoreados ${res?.productos_monitoreados ?? 0} · caros ${res?.caros ?? 0} · baratos ${res?.baratos ?? 0} · comp. bajó ${res?.competencia_bajo ?? 0} · 0 tokens`);
      return {
        resumen: accionables.length
          ? `${accionables.length} alerta(s) de precio: ${res.caros} caro(s), ${res.baratos} barato(s), ${res.competencia_bajo} con competencia bajando.`
          : `Sin alertas: revisé ${res?.productos_monitoreados ?? 0} productos con competencia y están bien posicionados.`,
        recomendaciones,
      };
    },
  },

  // ── Seguimiento: re-contacta prospectos y presupuestos que quedaron tibios ──
  {
    id: "seguimiento",
    nombre: "Seguimiento",
    rol: "Re-contacto comercial",
    objetivo: "Persigue lo que quedó sin cerrar: prospectos contactados sin respuesta y presupuestos enviados. Detecta con reglas; propone el recordatorio.",
    categoria: "Comercial",
    tools: ["seguimientos_pendientes", "enviar_whatsapp"],
    defaultAutonomy: "manual",
    async handler(ctx) {
      const pendientes = await ctx.tool<any[]>("seguimientos_pendientes", {});
      if (!pendientes.length) {
        ctx.log("nada para seguir · 0 tokens de IA");
        return { resumen: "Todo al día: no hay prospectos ni presupuestos esperando seguimiento.", recomendaciones: [] };
      }

      const recomendaciones: { titulo: string; detalle: string }[] = [];
      let propuestas = 0;
      for (const s of pendientes) {
        if (s.tipo === "prospecto") {
          recomendaciones.push({
            titulo: `${s.nombre} — contactado hace ${s.dias} día${s.dias !== 1 ? "s" : ""} sin respuesta`,
            detalle: s.telefono ? `Propuse un recordatorio por WhatsApp (revisalo en Aprobaciones).` : `Sin teléfono cargado: seguilo por otro canal. Mensaje sugerido: "${s.mensaje_sugerido}"`,
          });
          // Con teléfono: propone el envío (va a Aprobaciones en manual/asistido).
          if (s.telefono) { await ctx.tool("enviar_whatsapp", { to: s.telefono, texto: s.mensaje_sugerido }); propuestas++; }
        } else {
          recomendaciones.push({
            titulo: `Presupuesto de ${s.cliente} — enviado hace ${s.dias} día${s.dias !== 1 ? "s" : ""}`,
            detalle: `Está tibio. Mensaje sugerido: "${s.mensaje_sugerido}"`,
          });
        }
      }

      ctx.log(`${pendientes.length} seguimiento(s) · ${propuestas} recordatorio(s) propuesto(s) · 0 tokens de IA`);
      return {
        resumen: `${pendientes.length} cosa(s) para seguir.${propuestas ? ` Propuse ${propuestas} recordatorio(s) por WhatsApp — revisalos en Aprobaciones.` : ""}`,
        recomendaciones,
      };
    },
  },
  // ── Postventa / Fidelización: reseñas y recompra (sin IA para detectar) ──
  {
    id: "postventa",
    nombre: "Postventa / Fidelización",
    rol: "Reseñas y recompra",
    objetivo: "Aprovecha a los que ya compraron: pide reseña tras la entrega y reactiva a los clientes que hace rato no compran.",
    categoria: "Comercial",
    tools: ["oportunidades_postventa"],
    defaultAutonomy: "manual",
    async handler(ctx) {
      const ops = await ctx.tool<any[]>("oportunidades_postventa", {});
      if (!ops.length) {
        ctx.log("sin oportunidades de postventa · 0 tokens de IA");
        return { resumen: "No hay oportunidades de postventa por ahora.", recomendaciones: [] };
      }
      const resenas = ops.filter(o => o.tipo === "resena").length;
      const recompras = ops.filter(o => o.tipo === "recompra").length;

      const recomendaciones = ops.slice(0, 15).map(o => ({
        titulo: `${o.tipo === "resena" ? "⭐ Pedir reseña" : "🔄 Reactivar"} — ${o.nombre}`,
        detalle: `${o.tipo === "resena" ? `Compró hace ${o.dias} días.` : `Sin comprar hace ${o.dias} días (${o.compras} compra/s, ${"$" + Math.round(o.total_gastado).toLocaleString("es-AR")}).`} Mensaje: "${o.mensaje_sugerido}"`,
      }));

      ctx.log(`${ops.length} oportunidad(es): ${resenas} reseña(s), ${recompras} recompra(s) · 0 tokens de IA`);
      return {
        resumen: `${ops.length} oportunidad(es) de postventa: ${resenas} para pedir reseña y ${recompras} para reactivar. Revisalas en Postventa.`,
        recomendaciones,
      };
    },
  },
];

function etiquetaAlerta(tipo: string): string {
  return tipo === "caro" ? "estás caro"
    : tipo === "barato" ? "podés subir"
    : tipo === "competencia_bajo" ? "un competidor bajó"
    : "en línea";
}

export function getAgent(id: string): AgentDef | undefined {
  return AGENTS.find(a => a.id === id);
}
