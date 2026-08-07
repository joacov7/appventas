import { AGENTS, loadAgentConfigs, runAgent } from "@/lib/agents";

// Resuelve un agente por id exacto o por nombre/rol aproximado (lo que diría el
// dueño en criollo: "seguimiento", "el de precios", "postventa", etc.).
export function resolverAgente(idOrNombre: string) {
  const q = (idOrNombre ?? "").toLowerCase().trim();
  if (!q) return undefined;
  // 1) id exacto.
  let a = AGENTS.find(a => a.id === q);
  if (a) return a;
  // 2) nombre/rol/categoría que contenga el texto (o al revés).
  a = AGENTS.find(a =>
    a.nombre.toLowerCase().includes(q) || q.includes(a.id) ||
    a.rol.toLowerCase().includes(q) || a.categoria.toLowerCase().includes(q)
  );
  return a;
}

// Lista amigable de agentes (para cuando el dueño no acierta el nombre).
export function listaAgentes(): string {
  return AGENTS.map(a => `• <b>${a.nombre}</b> — ${a.rol}`).join("\n");
}

// Ejecuta un agente a demanda (lo dispara el Jefe de Gabinete). Devuelve un
// texto listo para Telegram con el resumen y las recomendaciones.
export async function ejecutarAgentePorNombre(idOrNombre: string): Promise<string> {
  const def = resolverAgente(idOrNombre);
  if (!def) {
    return `No encontré un agente llamado “${idOrNombre}”. Tengo estos:\n${listaAgentes()}`;
  }
  const configs = await loadAgentConfigs();
  const cfg = configs[def.id] ?? { enabled: true, autonomy: def.defaultAutonomy };
  if (cfg.enabled === false) {
    return `El agente <b>${def.nombre}</b> está desactivado. Activalo desde el panel de Agentes para poder ejecutarlo.`;
  }

  const r = await runAgent(def, cfg.autonomy);
  if (!r.ok) return `⚠️ El agente <b>${def.nombre}</b> falló: ${r.error ?? "error desconocido"}.`;

  const d = r.decision;
  const partes = [`🤖 <b>${def.nombre}</b> — listo.`];
  if (d?.resumen) partes.push(d.resumen);
  const recos = d?.recomendaciones ?? [];
  if (recos.length) {
    partes.push("");
    partes.push(recos.slice(0, 6).map(rc => `• <b>${rc.titulo}</b>: ${rc.detalle}`).join("\n"));
  }
  const propuestas = r.telemetry?.accionesPropuestas?.length ?? 0;
  if (propuestas > 0) partes.push(`\n📝 Dejé ${propuestas} acción(es) esperando tu OK en Aprobaciones.`);
  return partes.join("\n");
}
