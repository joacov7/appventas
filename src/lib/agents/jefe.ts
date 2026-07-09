import { registry } from "@/lib/tools";
import { aiComplete } from "@/lib/ai";
import { recall } from "@/lib/memory";

// ─── Jefe de Gabinete ─────────────────────────────────────────────────────────
// El agente con el que hablás (por Telegram) en lenguaje natural. Interpreta el
// pedido, elige la herramienta correcta para conseguir la info, y te responde.
// Por ahora SOLO consulta/reporta (herramientas de lectura); nada que cambie
// datos (eso sigue pasando por Aprobaciones).

function parseJSON(txt: string): any {
  try {
    const m = txt.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } catch { return null; }
}

export async function jefeDeGabinete(pregunta: string): Promise<string> {
  const q = pregunta.trim();
  if (!q) return "Decime qué necesitás y lo averiguo. Ej: “¿cómo venimos este mes?”, “¿a quién sigo?”, “¿dónde estoy caro?”.";

  // Atajos de ayuda (sin gastar tokens).
  if (/^\/?(ayuda|help|comandos|start)/i.test(q)) {
    return [
      "🧑‍💼 <b>Jefe de Gabinete</b>. Preguntame en criollo, ej:",
      "• ¿Cómo venimos este mes? (caja)",
      "• ¿A quién tengo que seguir?",
      "• ¿Dónde estoy caro vs la competencia?",
      "• ¿Qué conversaciones quedaron pendientes?",
      "• ¿Qué fechas comerciales se vienen?",
      "• ¿A quién le pido reseña o reactivo?",
      "",
      "Consulto a los agentes y te traigo la data. (Por ahora solo informo; nada se cambia sin tu OK).",
    ].join("\n");
  }

  // Solo herramientas de lectura (el jefe informa, no ejecuta cambios).
  const tools = registry.info().filter(t => t.sideEffect === "read");
  const catalogo = tools.map(t => ({
    name: t.name, desc: t.description,
    params: (t.params ?? []).map(p => ({ nombre: p.nombre, tipo: p.tipo, requerido: p.requerido })),
  }));

  // Paso 1 — Rutear: elegir UNA herramienta (o responder directo si es charla).
  let ruta: any = null;
  try {
    const rutaTxt = await aiComplete({
      system:
        "Sos el jefe de gabinete de una PyME argentina de mates y personalizados. " +
        "El dueño te hace un pedido. Elegí UNA herramienta de la lista para conseguir la info, " +
        "o respondé directo si es un saludo o algo que no necesita datos. " +
        'Devolvé SOLO JSON: {"tool":"nombre","input":{...}} para usar una herramienta, ' +
        'o {"responder":"texto"} si no hace falta ninguna. Elegí la herramienta más adecuada al pedido.',
      json: true,
      maxTokens: 300,
      messages: [{ role: "user", content: `Herramientas disponibles:\n${JSON.stringify(catalogo)}\n\nPedido: "${q}"` }],
    });
    ruta = parseJSON(rutaTxt);
  } catch (e: any) {
    return `No pude procesar el pedido (¿IA configurada?). ${e?.message ?? ""}`.trim();
  }

  if (ruta?.responder) return String(ruta.responder);
  if (!ruta?.tool) return "No entendí bien qué necesitás. Probá reformularlo, o escribí “ayuda”.";

  const tool = registry.get(ruta.tool);
  if (!tool || tool.sideEffect !== "read") {
    return "Eso implicaría una acción que cambia datos — por seguridad no lo hago desde acá. Usá el panel (Aprobaciones) para eso.";
  }

  const res = await registry.execute(ruta.tool, ruta.input ?? {});
  if (!res.ok) return `No pude conseguir esa info: ${res.error}`;

  // Contexto de memoria relevante (si hay), para respuestas más ricas.
  let contextoMem = "";
  try {
    const recuerdos = await recall({ namespace: "mercado", limit: 2 } as any);
    if (Array.isArray(recuerdos) && recuerdos.length) contextoMem = `\nContexto de memoria: ${JSON.stringify(recuerdos).slice(0, 500)}`;
  } catch { /* opcional */ }

  // Paso 2 — Redactar la respuesta en criollo con los datos.
  try {
    const resp = await aiComplete({
      system:
        "Sos el jefe de gabinete. Respondé al dueño en español argentino, breve, claro y accionable. " +
        "Formato Telegram: podés usar <b>negrita</b>. Mostrá los números que importan. NO inventes datos: " +
        "usá SOLO lo que te paso. Si los datos vienen vacíos, decilo con naturalidad.",
      fast: true,
      maxTokens: 500,
      messages: [{ role: "user", content: `Pregunta del dueño: "${q}"\n\nDatos obtenidos (${ruta.tool}):\n${JSON.stringify(res.output).slice(0, 3500)}${contextoMem}` }],
    });
    return resp.trim() || "Listo, pero no tengo mucho para mostrarte con eso.";
  } catch {
    // Si falla la redacción, devolvemos algo crudo pero útil.
    return `Info de ${ruta.tool}:\n${JSON.stringify(res.output).slice(0, 1500)}`;
  }
}
