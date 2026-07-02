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
  // Columnas nuevas (para tablas ya creadas antes de esta feature)
  await (prisma as any).$executeRawUnsafe(`ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS instagram TEXT`);
  await (prisma as any).$executeRawUnsafe(`ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS facebook TEXT`);
}

// Normaliza un handle o URL de Instagram a URL completa
function normInstagram(v?: string): string | null {
  if (!v) return null;
  const s = v.trim();
  if (s.startsWith("http")) return s;
  return `https://instagram.com/${s.replace(/^@/, "").replace(/\/$/, "")}`;
}
function normFacebook(v?: string): string | null {
  if (!v) return null;
  const s = v.trim();
  if (s.startsWith("http")) return s;
  return `https://facebook.com/${s.replace(/^@/, "").replace(/\/$/, "")}`;
}

// Geocodifica "zona, país" a un area id de Overpass usando Nominatim.
// Devuelve null si no encuentra un área (relación/way) para esa zona.
async function geocodeArea(zona: string, pais: string): Promise<{ areaId: number; displayName: string } | null> {
  const q = `${zona}, ${pais}`;
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=0`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "AppVentas/1.0 (prospector; contacto tienda)",
      Accept: "application/json",
      "Accept-Language": "es",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return null;
  const arr: any[] = await res.json();
  const hit = arr[0];
  if (!hit) return null;
  // Overpass area id: relation -> 3600000000 + id ; way -> 2400000000 + id
  const osmId = Number(hit.osm_id);
  if (hit.osm_type === "relation") return { areaId: 3600000000 + osmId, displayName: hit.display_name };
  if (hit.osm_type === "way")      return { areaId: 2400000000 + osmId, displayName: hit.display_name };
  return null; // un nodo no define un área
}

function buildQuery(areaId: number, rubrosOsm: string[]): string {
  const filtro = rubrosOsm.join("|");
  return `
    [out:json][timeout:80];
    area(${areaId})->.z;
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

  const { zona, rubros, pais } = await req.json();
  if (!zona?.trim()) return NextResponse.json({ error: "Zona (provincia o ciudad) requerida" }, { status: 400 });
  const paisFinal = (pais?.trim() || "Argentina");

  const claves: string[] = Array.isArray(rubros) && rubros.length ? rubros : Object.keys(RUBROS);
  const rubrosOsm = claves.map(k => RUBROS[k]?.osm).filter(Boolean);
  if (!rubrosOsm.length) return NextResponse.json({ error: "Rubros inválidos" }, { status: 400 });

  // Geocodificar la zona dentro del país para acotar bien el área
  let area: { areaId: number; displayName: string } | null = null;
  try {
    area = await geocodeArea(zona.trim(), paisFinal);
  } catch {
    return NextResponse.json({ error: "No se pudo geolocalizar la zona. Probá de nuevo en un momento." }, { status: 502 });
  }
  if (!area) {
    return NextResponse.json({ error: `No se encontró "${zona}" en ${paisFinal}. Revisá el nombre de la provincia/ciudad y el país.`, total: 0 }, { status: 200 });
  }

  // Mapa inverso osm -> label para etiquetar cada resultado
  const osmLabel = new Map<string, string>();
  for (const v of Object.values(RUBROS)) osmLabel.set(v.osm, v.label);

  const ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  ];
  const body = "data=" + encodeURIComponent(buildQuery(area.areaId, rubrosOsm));

  let data: any = null;
  let lastStatus = 0;
  let lastErr = "";
  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": "AppVentas/1.0 (prospector; contacto tienda)",
        },
        body,
        signal: AbortSignal.timeout(85000),
      });
      if (res.ok) { data = await res.json(); break; }
      lastStatus = res.status;
      // 429/504/502/406: probar siguiente mirror
    } catch (e: any) {
      lastErr = e?.message ?? "error";
    }
  }

  if (!data) {
    const detalle = lastStatus ? `respondió ${lastStatus}` : lastErr;
    return NextResponse.json({ error: `No se pudo consultar el mapa (${detalle}). Probá de nuevo en un momento.` }, { status: 502 });
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
      website: t.website ?? t["contact:website"] ?? null,
      instagram: normInstagram(t["contact:instagram"] ?? t.instagram),
      facebook: normFacebook(t["contact:facebook"] ?? t.facebook),
      lat: el.lat ?? el.center?.lat ?? null,
      lon: el.lon ?? el.center?.lon ?? null,
      osm_id: `${el.type}/${el.id}`,
    };
  }).filter(p => p.nombre);

  // Deduplicar por osm_id (evita "cannot affect row a second time" en el upsert)
  const vistos = new Set<string>();
  const unicos = prospectos.filter(p => vistos.has(p.osm_id) ? false : (vistos.add(p.osm_id), true));

  if (!unicos.length) return NextResponse.json({ error: "Se encontraron comercios pero sin nombre público.", total: 0 }, { status: 200 });

  // Etiqueta de zona a guardar (incluye país si no es Argentina)
  const zonaLabel = paisFinal.toLowerCase() === "argentina" ? zona.trim() : `${zona.trim()}, ${paisFinal}`;

  // Bulk upsert por osm_id
  const CHUNK = 100;
  let insertados = 0;
  for (let i = 0; i < unicos.length; i += CHUNK) {
    const chunk = unicos.slice(i, i + CHUNK);
    const values: string[] = [];
    const paramsArr: any[] = [];
    let idx = 1;
    for (const p of chunk) {
      values.push(`($${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++})`);
      paramsArr.push(p.nombre, p.rubro, p.direccion, p.telefono, p.website, p.instagram, p.facebook, zonaLabel, p.lat, p.lon, p.osm_id);
    }
    await (prisma as any).$executeRawUnsafe(`
      INSERT INTO prospectos (nombre, rubro, direccion, telefono, website, instagram, facebook, provincia, lat, lon, osm_id)
      VALUES ${values.join(",")}
      ON CONFLICT (osm_id) DO UPDATE SET
        nombre    = EXCLUDED.nombre,
        rubro     = EXCLUDED.rubro,
        direccion = EXCLUDED.direccion,
        telefono  = COALESCE(EXCLUDED.telefono, prospectos.telefono),
        website   = COALESCE(EXCLUDED.website, prospectos.website),
        instagram = COALESCE(EXCLUDED.instagram, prospectos.instagram),
        facebook  = COALESCE(EXCLUDED.facebook, prospectos.facebook),
        provincia = EXCLUDED.provincia
    `, ...paramsArr);
    insertados += chunk.length;
  }

  return NextResponse.json({ ok: true, total: insertados });
}
