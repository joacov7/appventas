export const dynamic = "force-dynamic";
export const maxDuration = 90;

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

// Rubros de OSM que suelen revender mates/bombillas/regionales
const RUBROS: Record<string, { osm: string; label: string }> = {
  regaleria:    { osm: "gift",           label: "Regalería" },
  tabaqueria:   { osm: "tobacco",        label: "Tabaquería" },
  kiosco:       { osm: "convenience",    label: "Kiosco / Almacén" },
  bazar:        { osm: "variety_store",  label: "Bazar" },
  hogar:        { osm: "houseware",      label: "Artículos de hogar" },
  artesanias:   { osm: "craft",          label: "Artesanías" },
  kiosk:        { osm: "kiosk",          label: "Kiosco de calle" },
};

async function ensureTable() {
  await (prisma as any).$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS prospectos (
      id        SERIAL PRIMARY KEY,
      nombre    TEXT NOT NULL,
      rubro     TEXT,
      direccion TEXT,
      telefono  TEXT,
      website   TEXT,
      provincia TEXT,
      lat       DOUBLE PRECISION,
      lon       DOUBLE PRECISION,
      osm_id    TEXT UNIQUE,
      estado    TEXT DEFAULT 'nuevo',
      notas     TEXT,
      creado_en TIMESTAMPTZ DEFAULT now()
    )
  `);
}

function buildQuery(zona: string, rubrosOsm: string[]): string {
  const filtro = rubrosOsm.join("|");
  // Busca el área administrativa por nombre (provincia o ciudad) dentro de Argentina
  return `
    [out:json][timeout:80];
    area["name"="Argentina"]["admin_level"="2"]->.ar;
    area["name"="${zona.replace(/"/g, "")}"]["boundary"="administrative"](area.ar)->.z;
    (
      nwr["shop"~"^(${filtro})$"]["name"](area.z);
    );
    out center tags 600;
  `;
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  await ensureTable();
  const estado = req.nextUrl.searchParams.get("estado");
  const rows = estado
    ? await (prisma as any).$queryRawUnsafe(
        `SELECT * FROM prospectos WHERE estado = $1 ORDER BY creado_en DESC`, estado)
    : await (prisma as any).$queryRawUnsafe(
        `SELECT * FROM prospectos ORDER BY creado_en DESC`);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  await ensureTable();

  const { zona, rubros } = await req.json();
  if (!zona?.trim()) return NextResponse.json({ error: "Zona (provincia o ciudad) requerida" }, { status: 400 });

  const claves: string[] = Array.isArray(rubros) && rubros.length ? rubros : Object.keys(RUBROS);
  const rubrosOsm = claves.map(k => RUBROS[k]?.osm).filter(Boolean);
  if (!rubrosOsm.length) return NextResponse.json({ error: "Rubros inválidos" }, { status: 400 });

  // Mapa inverso osm -> label para etiquetar cada resultado
  const osmLabel = new Map<string, string>();
  for (const v of Object.values(RUBROS)) osmLabel.set(v.osm, v.label);

  let data: any;
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(buildQuery(zona.trim(), rubrosOsm)),
      signal: AbortSignal.timeout(85000),
    });
    if (!res.ok) return NextResponse.json({ error: `Overpass respondió ${res.status}. Probá de nuevo en un momento.` }, { status: 502 });
    data = await res.json();
  } catch (e: any) {
    return NextResponse.json({ error: `No se pudo consultar el mapa: ${e?.message ?? "error"}` }, { status: 502 });
  }

  const elements: any[] = data.elements ?? [];
  if (!elements.length) {
    return NextResponse.json({ error: `No se encontraron comercios en "${zona}". Revisá que el nombre coincida con la provincia o ciudad (ej: "Córdoba", "Rosario").`, total: 0 }, { status: 200 });
  }

  const prospectos = elements.map(el => {
    const t = el.tags ?? {};
    const dir = [t["addr:street"], t["addr:housenumber"], t["addr:city"]].filter(Boolean).join(" ");
    return {
      nombre: String(t.name ?? "").trim(),
      rubro: osmLabel.get(t.shop) ?? t.shop ?? null,
      direccion: dir || null,
      telefono: t.phone ?? t["contact:phone"] ?? t.mobile ?? null,
      website: t.website ?? t["contact:website"] ?? t["contact:instagram"] ?? t["contact:facebook"] ?? null,
      lat: el.lat ?? el.center?.lat ?? null,
      lon: el.lon ?? el.center?.lon ?? null,
      osm_id: `${el.type}/${el.id}`,
    };
  }).filter(p => p.nombre);

  if (!prospectos.length) return NextResponse.json({ error: "Se encontraron comercios pero sin nombre público.", total: 0 }, { status: 200 });

  // Bulk upsert por osm_id
  const CHUNK = 100;
  let insertados = 0;
  for (let i = 0; i < prospectos.length; i += CHUNK) {
    const chunk = prospectos.slice(i, i + CHUNK);
    const values: string[] = [];
    const paramsArr: any[] = [];
    let idx = 1;
    for (const p of chunk) {
      values.push(`($${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++})`);
      paramsArr.push(p.nombre, p.rubro, p.direccion, p.telefono, p.website, zona.trim(), p.lat, p.lon, p.osm_id);
    }
    await (prisma as any).$executeRawUnsafe(`
      INSERT INTO prospectos (nombre, rubro, direccion, telefono, website, provincia, lat, lon, osm_id)
      VALUES ${values.join(",")}
      ON CONFLICT (osm_id) DO UPDATE SET
        nombre    = EXCLUDED.nombre,
        rubro     = EXCLUDED.rubro,
        direccion = EXCLUDED.direccion,
        telefono  = COALESCE(EXCLUDED.telefono, prospectos.telefono),
        website   = COALESCE(EXCLUDED.website, prospectos.website),
        provincia = EXCLUDED.provincia
    `, ...paramsArr);
    insertados += chunk.length;
  }

  return NextResponse.json({ ok: true, total: insertados });
}
