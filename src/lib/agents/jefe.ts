import { registry } from "@/lib/tools";
import { aiComplete } from "@/lib/ai";
import { buscarProspectoPorNombre } from "@/lib/services/prospectos.service";

// ─── Jefe de Gabinete ─────────────────────────────────────────────────────────
// El agente con el que hablás (por Telegram) en lenguaje natural. Interpreta el
// pedido, elige la herramienta adecuada y:
//   • si es de LECTURA → la ejecuta y te informa.
//   • si CAMBIA datos (ej. enviar WhatsApp) → te propone la acción y espera tu SÍ.
// Alta de prospectos: se ejecuta directo (es interna e inofensiva).

export type JefeResultado =
  | { tipo: "texto"; texto: string }
  | { tipo: "confirmar"; texto: string; accion: { tool: string; input: any; resumen: string } };

// Acciones de escritura que se ejecutan sin confirmar (internas, no salen al mundo).
const DIRECTAS = new Set(["agregar_prospecto"]);

function parseJSON(txt: string): any {
  try { const m = txt.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; } catch { return null; }
}

export async function jefeDeGabinete(pregunta: string): Promise<JefeResultado> {
  const q = pregunta.trim();
  if (!q) return { tipo: "texto", texto: "Decime qué necesitás. Ej: “¿cómo venimos este mes?”, “contactá a Juan”, “agregá a Pérez tel 3444...”." };

  if (/^\/?(ayuda|help|comandos|start)/i.test(q)) {
    return { tipo: "texto", texto: [
      "🧑‍💼 <b>Jefe de Gabinete</b>. Escribime en criollo:",
      "<b>Consultas:</b> ¿cómo venimos este mes? · ¿a quién sigo? · ¿dónde estoy caro? · conversaciones pendientes · fechas que se vienen",
      "<b>Acciones:</b> contactá a [nombre] · agregá prospecto [nombre] tel [número]",
      "",
      "Lo que cambia algo (mandar un mensaje) te lo propongo y lo confirmás con <b>SÍ</b>.",
    ].join("\n") };
  }

  // Herramientas que el jefe puede ELEGIR. Ocultamos helpers internos
  // (buscar_prospecto_por_nombre se usa por dentro al resolver un contacto).
  const OCULTAS = new Set(["buscar_prospecto_por_nombre"]);
  const catalogo = registry.info()
    .filter(t => !OCULTAS.has(t.name))
    .map(t => ({ name: t.name, desc: t.description, escribe: t.sideEffect === "write" }));

  // Paso 1 — Rutear.
  let ruta: any = null;
  try {
    const rutaTxt = await aiComplete({
      system:
        "Sos el jefe de gabinete de una PyME argentina de mates y personalizados. " +
        "Elegí UNA herramienta para cumplir el pedido del dueño y armá su input. " +
        "REGLA IMPORTANTE: si el dueño pide CONTACTAR / escribirle / ofrecerle / mandarle / avisarle algo a una persona o empresa, " +
        "usá SIEMPRE la herramienta 'enviar_whatsapp' — poné en 'to' el NOMBRE del contacto (aunque no sepas el número) y redactá vos un buen 'texto' con lo que hay que decirle. " +
        "Para agregar/cargar un contacto o prospecto nuevo, usá 'agregar_prospecto'. " +
        'Devolvé SOLO JSON: {"tool":"nombre","input":{...}} o {"responder":"texto"} si es un saludo o no necesita datos.',
      json: true, maxTokens: 400,
      messages: [{ role: "user", content: `Herramientas:\n${JSON.stringify(catalogo)}\n\nPedido: "${q}"` }],
    });
    ruta = parseJSON(rutaTxt);
  } catch (e: any) {
    return { tipo: "texto", texto: `No pude procesar el pedido (¿IA configurada?). ${e?.message ?? ""}`.trim() };
  }

  if (ruta?.responder) return { tipo: "texto", texto: String(ruta.responder) };
  const tool = ruta?.tool ? registry.get(ruta.tool) : undefined;
  if (!tool) return { tipo: "texto", texto: "No entendí bien qué necesitás. Escribí “ayuda” para ver ejemplos." };
  const input = ruta.input ?? {};

  // ── LECTURA → ejecutar e informar ──
  if (tool.sideEffect === "read") {
    const res = await registry.execute(tool.name, input);
    if (!res.ok) return { tipo: "texto", texto: `No pude conseguir esa info: ${res.error}` };
    try {
      const resp = await aiComplete({
        system: "Sos el jefe de gabinete. Respondé al dueño en español argentino, breve y claro, con los números que importan. Formato Telegram (<b>negrita</b>). NO inventes: usá solo los datos dados. Si vienen vacíos, decilo.",
        fast: true, maxTokens: 500,
        messages: [{ role: "user", content: `Pregunta: "${q}"\nDatos (${tool.name}): ${JSON.stringify(res.output).slice(0, 3500)}` }],
      });
      return { tipo: "texto", texto: resp.trim() || "No tengo mucho para mostrarte con eso." };
    } catch {
      return { tipo: "texto", texto: `Info de ${tool.name}:\n${JSON.stringify(res.output).slice(0, 1200)}` };
    }
  }

  // ── ESCRITURA interna (alta de prospecto) → ejecutar directo ──
  if (DIRECTAS.has(tool.name)) {
    const res = await registry.execute(tool.name, input);
    if (!res.ok) return { tipo: "texto", texto: `No pude hacerlo: ${res.error}` };
    return { tipo: "texto", texto: `✅ Listo, agregué a <b>${input.nombre ?? "el contacto"}</b> como prospecto.` };
  }

  // ── ESCRITURA que sale al mundo (ej. enviar_whatsapp) → proponer y confirmar ──
  if (tool.name === "enviar_whatsapp") {
    let destino = String(input.to ?? "").trim();
    let nombreMostrar = destino;
    // Si 'to' no es un número, lo tratamos como nombre y buscamos el contacto.
    if (destino && !/^\d[\d\s+-]{5,}$/.test(destino)) {
      const p = await buscarProspectoPorNombre(destino);
      if (!p) return { tipo: "texto", texto: `No encontré a “${destino}” en tus prospectos. Cargalo primero (o pasame el número).` };
      if (!p.telefono) return { tipo: "texto", texto: `Tengo a ${p.nombre} pero sin teléfono. Pasame el número o cargalo.` };
      nombreMostrar = p.nombre; destino = p.telefono;
    }
    if (!destino) return { tipo: "texto", texto: "¿A quién le escribo? Decime el nombre (si está cargado) o el número." };
    const texto = String(input.texto ?? "").trim();
    if (!texto) return { tipo: "texto", texto: "¿Qué le querés decir? Repetí el pedido incluyendo el mensaje." };

    const resumen = `✍️ Le escribiría a <b>${nombreMostrar}</b>:\n\n“${texto}”`;
    return {
      tipo: "confirmar",
      texto: `${resumen}\n\n¿Lo mando? Respondé <b>SÍ</b> para enviar, <b>NO</b> para cancelar, o escribí el texto corregido.`,
      accion: { tool: "enviar_whatsapp", input: { to: destino, texto }, resumen },
    };
  }

  // Otras acciones de escritura: por seguridad, van por el panel.
  return { tipo: "texto", texto: "Esa acción la dejo para el panel (Aprobaciones), por seguridad. Desde acá te consulto info y contacto clientes." };
}
