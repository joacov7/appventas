export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel Hobby

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { buscarLugares, placesConfigurado, presupuestoPlaces, type LugarPlaces } from "@/lib/services/places.service";

// Rubro (mismas claves que el buscador OSM) → término de búsqueda en criollo
// para Google Places. Places entiende lenguaje natural, así que apuntamos al
// término que un argentino usaría.
const RUBRO_QUERY: Record<string, string> = {
  todos_comercios: "comercios",
  todas_oficinas: "empresas",
  regaleria: "regalería",
  tabaqueria: "tabaquería",
  kiosco: "kiosco",
  bazar: "bazar",
  hogar: "artículos para el hogar",
  artesanias: "artesanías",
  ropa: "tienda de ropa",
  joyeria: "joyería",
  floreria: "florería",
  libreria: "librería",
  deportes: "artículos deportivos",
  supermercado: "supermercado",
  ferreteria: "ferretería",
  mascotas: "veterinaria pet shop",
  agropecuaria: "agropecuaria",
  industria: "fábrica industria",
  empresa: "empresa oficina",
  publicidad: "agencia de publicidad",
  seguros: "agencia de seguros",
  inmobiliaria: "inmobiliaria",
  cooperativa: "cooperativa",
  acopio: "acopio de cereales",
  gobierno: "municipalidad organismo público",
};

const REGION: Record<string, string> = { argentina: "AR", uruguay: "UY", chile: "CL", paraguay: "PY" };

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  if (!placesConfigurado()) {
    return NextResponse.json({ error: "Falta configurar GOOGLE_PLACES_API_KEY en las variables de entorno." }, { status: 400 });
  }

  // Control de gastos: si se llegó al límite mensual, no se consulta más.
  const presu = await presupuestoPlaces();
  if (!presu.disponible) {
    return NextResponse.json({
      error: `Límite de gasto de Google alcanzado: ~US$${presu.gasto_usd} de US$${presu.limite_usd} este mes. Subí el límite en Captación si querés seguir.`,
    }, { status: 402 });
  }

  await ensureSchema("captacion");

  const { zona, pais, rubros } = await req.json();
  if (!zona?.trim()) return NextResponse.json({ error: "Zona (provincia o ciudad) requerida" }, { status: 400 });
  const paisFinal = (pais?.trim() || "Argentina");
  const regionCode = REGION[paisFinal.toLowerCase()];

  const claves: string[] = Array.isArray(rubros) && rubros.length ? rubros : Object.keys(RUBRO_QUERY);
  const terminos = claves.map(k => RUBRO_QUERY[k]).filter(Boolean);
  if (!terminos.length) return NextResponse.json({ error: "Rubros inválidos" }, { status: 400 });

  // Para no pasar el límite de 60s: acotamos cuántos rubros consultamos por vez.
  const MAX_RUBROS = 6;
  const termsUsados = terminos.slice(0, MAX_RUBROS);

  // Busca cada término dentro de la zona y junta todo, deduplicando por placeId.
  const porId = new Map<string, LugarPlaces>();
  let errores = 0;
  let ultimoError = "";
  for (const term of termsUsados) {
    try {
      const query = `${term} en ${zona.trim()}, ${paisFinal}`;
      const lugares = await buscarLugares(query, { regionCode, maxPaginas: 2 });
      for (const l of lugares) if (!porId.has(l.placeId)) porId.set(l.placeId, l);
    } catch (e: any) {
      errores++;
      ultimoError = e?.message ?? "error";
    }
  }

  const unicos = Array.from(porId.values());
  if (!unicos.length) {
    // Si TODAS las consultas fallaron, mostramos el motivo real de Google
    // (suele decir exactamente qué habilitar/arreglar).
    if (errores === termsUsados.length && ultimoError) {
      return NextResponse.json({ error: `Google rechazó la consulta: ${ultimoError}`, total: 0 }, { status: 200 });
    }
    return NextResponse.json({ error: `No se encontraron resultados en "${zona}".`, total: 0 }, { status: 200 });
  }

  const zonaLabel = paisFinal.toLowerCase() === "argentina" ? zona.trim() : `${zona.trim()}, ${paisFinal}`;

  // Upsert usando osm_id como id de fuente: "gplaces/<placeId>".
  const CHUNK = 100;
  let insertados = 0;
  for (let i = 0; i < unicos.length; i += CHUNK) {
    const chunk = unicos.slice(i, i + CHUNK);
    // Columnas: (nombre, rubro, direccion, telefono, website, provincia, lat, lon, osm_id)
    const values: string[] = [];
    const params: any[] = [];
    let j = 1;
    for (const p of chunk) {
      values.push(`($${j++},$${j++},$${j++},$${j++},$${j++},$${j++},$${j++},$${j++},$${j++})`);
      params.push(p.nombre, p.rubro, p.direccion, p.telefono, p.website, zonaLabel, p.lat, p.lon, `gplaces/${p.placeId}`);
    }
    await (prisma as any).$executeRawUnsafe(`
      INSERT INTO prospectos (nombre, rubro, direccion, telefono, website, provincia, lat, lon, osm_id)
      VALUES ${values.join(",")}
      ON CONFLICT (osm_id) DO UPDATE SET
        nombre    = EXCLUDED.nombre,
        rubro     = COALESCE(prospectos.rubro, EXCLUDED.rubro),
        direccion = EXCLUDED.direccion,
        telefono  = COALESCE(EXCLUDED.telefono, prospectos.telefono),
        website   = COALESCE(EXCLUDED.website, prospectos.website),
        provincia = EXCLUDED.provincia
    `, ...params);
    insertados += chunk.length;
  }

  const conTel = unicos.filter(u => u.telefono).length;
  return NextResponse.json({ ok: true, total: insertados, con_telefono: conTel, fuente: "google_places" });
}
