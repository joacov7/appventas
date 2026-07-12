import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { normalizarTelefonoAR } from "@/lib/telefono";

// ─── Deduplicación de prospectos ──────────────────────────────────────────────
// El mismo negocio puede entrar dos veces: una por OSM y otra por Google Places.
// Fusionamos por (a) teléfono normalizado igual, o (b) nombre normalizado igual
// y ubicación cercana (<200 m). Conservamos la fila más completa/avanzada.

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

// 1) Rellena telefono_norm en todas las filas que tengan teléfono y no la tengan.
export async function backfillTelefonoNorm(): Promise<number> {
  await ensureSchema("captacion");
  const rows: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT id, telefono FROM prospectos WHERE telefono IS NOT NULL AND telefono <> '' AND (telefono_norm IS NULL OR telefono_norm = '')`
  );
  let n = 0;
  for (const r of rows) {
    const norm = normalizarTelefonoAR(r.telefono);
    if (norm) {
      await (prisma as any).$executeRawUnsafe(`UPDATE prospectos SET telefono_norm = $1 WHERE id = $2`, norm, r.id);
      n++;
    }
  }
  return n;
}

// Fusiona `perdedor` dentro de `ganador`: completa huecos y borra el perdedor.
async function fusionar(ganador: Fila, perdedor: Fila): Promise<void> {
  const merged = {
    rubro: ganador.rubro ?? perdedor.rubro,
    direccion: ganador.direccion ?? perdedor.direccion,
    telefono: ganador.telefono ?? perdedor.telefono,
    telefono_norm: ganador.telefono_norm ?? perdedor.telefono_norm,
    website: ganador.website ?? perdedor.website,
    instagram: ganador.instagram ?? perdedor.instagram,
    facebook: ganador.facebook ?? perdedor.facebook,
    email: ganador.email ?? perdedor.email,
    provincia: ganador.provincia ?? perdedor.provincia,
    mensaje_abordaje: ganador.mensaje_abordaje ?? perdedor.mensaje_abordaje,
  };
  await (prisma as any).$executeRawUnsafe(
    `UPDATE prospectos SET rubro=$1, direccion=$2, telefono=$3, telefono_norm=$4, website=$5,
       instagram=$6, facebook=$7, email=$8, provincia=$9, mensaje_abordaje=$10 WHERE id=$11`,
    merged.rubro, merged.direccion, merged.telefono, merged.telefono_norm, merged.website,
    merged.instagram, merged.facebook, merged.email, merged.provincia, merged.mensaje_abordaje, ganador.id
  );
  await (prisma as any).$executeRawUnsafe(`DELETE FROM prospectos WHERE id = $1`, perdedor.id);
}

// Resuelve un grupo de duplicados: elige el ganador y fusiona el resto.
async function fusionarGrupo(grupo: Fila[]): Promise<number> {
  if (grupo.length < 2) return 0;
  grupo.sort((a, b) => score(b) - score(a));
  const ganador = grupo[0];
  let fusionados = 0;
  for (let i = 1; i < grupo.length; i++) {
    await fusionar(ganador, grupo[i]);
    // Mantener al ganador con los datos ya fusionados en memoria para el siguiente merge.
    ganador.telefono ??= grupo[i].telefono;
    ganador.website ??= grupo[i].website;
    ganador.email ??= grupo[i].email;
    ganador.instagram ??= grupo[i].instagram;
    ganador.facebook ??= grupo[i].facebook;
    fusionados++;
  }
  return fusionados;
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

  // ── Fase A: por teléfono normalizado exacto (señal fuerte) ──
  let fusionadosTel = 0;
  const porTel = new Map<string, Fila[]>();
  for (const f of filas) {
    if (!f.telefono_norm) continue;
    if (!porTel.has(f.telefono_norm)) porTel.set(f.telefono_norm, []);
    porTel.get(f.telefono_norm)!.push(f);
  }
  const idsFusionados = new Set<number>();
  for (const grupo of porTel.values()) {
    if (grupo.length < 2) continue;
    const antes = grupo.length;
    const fus = await fusionarGrupo(grupo);
    fusionadosTel += fus;
    // marcar perdedores como ya procesados
    for (let i = 1; i < antes; i++) idsFusionados.add(grupo[i].id);
  }

  // ── Fase B: por nombre normalizado + geo cercana, dentro de la misma provincia ──
  const vivas = filas.filter(f => !idsFusionados.has(f.id));
  const porProv = new Map<string, Fila[]>();
  for (const f of vivas) {
    const k = (f.provincia ?? "").toLowerCase();
    if (!porProv.has(k)) porProv.set(k, []);
    porProv.get(k)!.push(f);
  }

  let fusionadosNombre = 0;
  for (const lista of porProv.values()) {
    const usados = new Set<number>();
    for (let i = 0; i < lista.length; i++) {
      if (usados.has(lista[i].id)) continue;
      const base = lista[i];
      const nb = normalizarNombre(base.nombre);
      if (!nb) continue;
      const grupo: Fila[] = [base];
      for (let j = i + 1; j < lista.length; j++) {
        const otro = lista[j];
        if (usados.has(otro.id)) continue;
        if (normalizarNombre(otro.nombre) !== nb) continue;
        // Requiere geo cercana para confirmar que es el mismo local.
        const cercano =
          base.lat != null && base.lon != null && otro.lat != null && otro.lon != null
            ? haversineM(base.lat, base.lon, otro.lat, otro.lon) < 200
            : false;
        if (cercano) { grupo.push(otro); usados.add(otro.id); }
      }
      if (grupo.length > 1) {
        usados.add(base.id);
        fusionadosNombre += await fusionarGrupo(grupo);
      }
    }
  }

  return {
    telefonos_normalizados,
    fusionados_por_telefono: fusionadosTel,
    fusionados_por_nombre_geo: fusionadosNombre,
    total_fusionados: fusionadosTel + fusionadosNombre,
  };
}
