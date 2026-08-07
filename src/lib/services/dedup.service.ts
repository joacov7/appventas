import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { normalizarTelefonoAR } from "@/lib/telefono";

// ─── Deduplicación de prospectos (versión batch) ─────────────────────────────
// El mismo negocio puede entrar dos veces: una por OSM y otra por Google Places.
// Fusionamos por (a) teléfono normalizado igual, o (b) nombre normalizado igual
// y ubicación cercana (<200 m). Conservamos la fila más completa/avanzada.
//
// Diseñado para correr dentro del límite de 60 s de Vercel con 10k+ filas:
// las decisiones se toman en memoria y la escritura va en TANDAS (un UPDATE
// masivo con VALUES y un DELETE con IN), no fila por fila.

interface Fila {
  id: number;
  nombre: string;
  rubro: string | null;
  direccion: string | null;
  telefono: string | null;
  telefono_norm: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  email: string | null;
  provincia: string | null;
  lat: number | null;
  lon: number | null;
  estado: string;
  mensaje_abordaje: string | null;
}

// Normaliza el nombre para comparar: minúsculas, sin acentos ni sufijos societarios.
function normalizarNombre(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(s\s?a|s\s?r\s?l|s\s?a\s?s|sociedad|anonima|the|el|la|los|las|de)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function haversineM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180, la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Puntúa qué tan "buena" es una fila para elegir la canónica del grupo.
const ESTADO_RANK: Record<string, number> = { interesado: 4, contactado: 3, nuevo: 2, descartado: 1 };
function score(f: Fila): number {
  let s = (ESTADO_RANK[f.estado] ?? 0) * 10;
  if (f.telefono) s += 4;
  if (f.email) s += 3;
  if (f.website) s += 2;
  if (f.instagram || f.facebook) s += 1;
  if (f.mensaje_abordaje) s += 2;
  if (f.direccion) s += 1;
  return s;
}

const CHUNK = 300;

// 1) Rellena telefono_norm en tandas: calcula en JS y escribe con UPDATE ... FROM VALUES.
export async function backfillTelefonoNorm(): Promise<number> {
  await ensureSchema("captacion");
  const rows: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT id, telefono FROM prospectos
     WHERE telefono IS NOT NULL AND telefono <> '' AND (telefono_norm IS NULL OR telefono_norm = '')`
  );
  const pares: { id: number; norm: string }[] = [];
  for (const r of rows) {
    const norm = normalizarTelefonoAR(r.telefono);
    if (norm) pares.push({ id: Number(r.id), norm });
  }
  for (let i = 0; i < pares.length; i += CHUNK) {
    const lote = pares.slice(i, i + CHUNK);
    const values: string[] = [];
    const params: any[] = [];
    let j = 1;
    for (const p of lote) {
      values.push(`($${j++}::int, $${j++}::text)`);
      params.push(p.id, p.norm);
    }
    await (prisma as any).$executeRawUnsafe(
      `UPDATE prospectos AS p SET telefono_norm = v.norm
       FROM (VALUES ${values.join(",")}) AS v(id, norm)
       WHERE p.id = v.id`,
      ...params
    );
  }
  return pares.length;
}

// Combina un grupo EN MEMORIA: elige ganador por score y rellena sus huecos
// con los datos de los perdedores. Devuelve la fila fusionada + ids a borrar.
function resolverGrupo(grupo: Fila[]): { ganador: Fila; borrar: number[] } {
  grupo.sort((a, b) => score(b) - score(a));
  const g = { ...grupo[0] };
  const borrar: number[] = [];
  for (let i = 1; i < grupo.length; i++) {
    const p = grupo[i];
    g.rubro ??= p.rubro;
    g.direccion ??= p.direccion;
    g.telefono ??= p.telefono;
    g.telefono_norm ??= p.telefono_norm;
    g.website ??= p.website;
    g.instagram ??= p.instagram;
    g.facebook ??= p.facebook;
    g.email ??= p.email;
    g.provincia ??= p.provincia;
    g.mensaje_abordaje ??= p.mensaje_abordaje;
    borrar.push(p.id);
  }
  return { ganador: g, borrar };
}

// Escribe todas las fusiones en tandas: un UPDATE masivo por lote + un DELETE por lote.
async function aplicarFusiones(ganadores: Fila[], borrar: number[]): Promise<void> {
  for (let i = 0; i < ganadores.length; i += CHUNK) {
    const lote = ganadores.slice(i, i + CHUNK);
    const values: string[] = [];
    const params: any[] = [];
    let j = 1;
    for (const g of lote) {
      values.push(`($${j++}::int,$${j++}::text,$${j++}::text,$${j++}::text,$${j++}::text,$${j++}::text,$${j++}::text,$${j++}::text,$${j++}::text,$${j++}::text,$${j++}::text)`);
      params.push(g.id, g.rubro, g.direccion, g.telefono, g.telefono_norm, g.website,
        g.instagram, g.facebook, g.email, g.provincia, g.mensaje_abordaje);
    }
    await (prisma as any).$executeRawUnsafe(
      `UPDATE prospectos AS p SET
         rubro = v.rubro, direccion = v.direccion, telefono = v.telefono,
         telefono_norm = v.telefono_norm, website = v.website, instagram = v.instagram,
         facebook = v.facebook, email = v.email, provincia = v.provincia,
         mensaje_abordaje = v.mensaje_abordaje
       FROM (VALUES ${values.join(",")}) AS v(id, rubro, direccion, telefono, telefono_norm, website, instagram, facebook, email, provincia, mensaje_abordaje)
       WHERE p.id = v.id`,
      ...params
    );
  }
  for (let i = 0; i < borrar.length; i += CHUNK) {
    const lote = borrar.slice(i, i + CHUNK);
    const ph = lote.map((_, k) => `$${k + 1}`).join(",");
    await (prisma as any).$executeRawUnsafe(
      `DELETE FROM prospectos WHERE id IN (${ph})`, ...lote
    );
  }
}

export interface ResultadoDedup {
  telefonos_normalizados: number;
  fusionados_por_telefono: number;
  fusionados_por_nombre_geo: number;
  total_fusionados: number;
}

export async function deduplicarProspectos(): Promise<ResultadoDedup> {
  await ensureSchema("captacion");
  const telefonos_normalizados = await backfillTelefonoNorm();

  const filas: Fila[] = await (prisma as any).$queryRawUnsafe(
    `SELECT id, nombre, rubro, direccion, telefono, telefono_norm, website, instagram, facebook,
            email, provincia, lat, lon, estado, mensaje_abordaje FROM prospectos`
  );

  // Un mismo prospecto puede ganar en la Fase A y volver a fusionarse en la B:
  // guardamos los ganadores en un mapa por id para que el segundo merge parta
  // de la versión ya rellenada y el UPDATE final tenga UNA sola fila por id.
  const ganadoresMap = new Map<number, Fila>();
  const borrar: number[] = [];
  const idsFusionados = new Set<number>();

  function registrar(grupo: Fila[]): number {
    // Si algún miembro ya es ganador previo, usar su versión rellenada.
    const conVersiones = grupo.map(f => ganadoresMap.get(f.id) ?? f);
    const { ganador, borrar: ids } = resolverGrupo(conVersiones);
    ganadoresMap.set(ganador.id, ganador);
    for (const id of ids) {
      ganadoresMap.delete(id); // por si un ganador previo pierde ahora
      idsFusionados.add(id);
      borrar.push(id);
    }
    return ids.length;
  }

  // ── Fase A: por teléfono normalizado exacto (señal fuerte) ──
  let fusionadosTel = 0;
  const porTel = new Map<string, Fila[]>();
  for (const f of filas) {
    if (!f.telefono_norm) continue;
    if (!porTel.has(f.telefono_norm)) porTel.set(f.telefono_norm, []);
    porTel.get(f.telefono_norm)!.push(f);
  }
  for (const grupo of porTel.values()) {
    if (grupo.length < 2) continue;
    fusionadosTel += registrar(grupo);
  }

  // ── Fase B: mismo nombre normalizado (precalculado UNA vez) + geo <200 m ──
  // Agrupar por clave provincia|nombre es O(n); el chequeo geo queda dentro de
  // grupos chicos, así que no hay comparación todos-contra-todos.
  let fusionadosNombre = 0;
  const porNombre = new Map<string, Fila[]>();
  for (const f of filas) {
    if (idsFusionados.has(f.id)) continue;
    const nb = normalizarNombre(f.nombre);
    if (!nb) continue;
    const k = `${(f.provincia ?? "").toLowerCase()}|${nb}`;
    if (!porNombre.has(k)) porNombre.set(k, []);
    porNombre.get(k)!.push(f);
  }
  for (const lista of porNombre.values()) {
    if (lista.length < 2) continue;
    // Clusteriza por cercanía dentro del grupo de mismo nombre.
    const usados = new Set<number>();
    for (let i = 0; i < lista.length; i++) {
      if (usados.has(lista[i].id)) continue;
      const base = lista[i];
      const grupo: Fila[] = [base];
      for (let j = i + 1; j < lista.length; j++) {
        const otro = lista[j];
        if (usados.has(otro.id)) continue;
        const cercano =
          base.lat != null && base.lon != null && otro.lat != null && otro.lon != null
            ? haversineM(base.lat, base.lon, otro.lat, otro.lon) < 200
            : false;
        if (cercano) { grupo.push(otro); usados.add(otro.id); }
      }
      if (grupo.length > 1) {
        usados.add(base.id);
        fusionadosNombre += registrar(grupo);
      }
    }
  }

  await aplicarFusiones(Array.from(ganadoresMap.values()), borrar);

  return {
    telefonos_normalizados,
    fusionados_por_telefono: fusionadosTel,
    fusionados_por_nombre_geo: fusionadosNombre,
    total_fusionados: fusionadosTel + fusionadosNombre,
  };
}
