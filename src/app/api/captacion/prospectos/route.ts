export const dynamic = "force-dynamic";
export const maxDuration = 60; // límite del plan Hobby de Vercel

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";

// Rubros de OSM. `key` es la clave OSM (shop, office, man_made, ...) y
// `value` el valor. Así podemos buscar tanto comercios (revendedores)
// como empresas/industrias (clientes B2B de personalizados).
const RUBROS: Record<string, { key: string; value: string; label: string }> = {
  // ── Barrido amplio: TODOS los comercios / oficinas de la zona ──
  todos_comercios: { key: "shop",   value: "*", label: "Todos los comercios" },
  todas_oficinas:  { key: "office", value: "*", label: "Todas las oficinas/empresas" },
  // ── Comercios (revendedores de mates/regionales) ──
  regaleria:    { key: "shop",     value: "gift",               label: "Regalería" },
  tabaqueria:   { key: "shop",     value: "tobacco",            label: "Tabaquería" },
  kiosco:       { key: "shop",     value: "convenience",        label: "Kiosco / Almacén" },
  bazar:        { key: "shop",     value: "variety_store",      label: "Bazar" },
  hogar:        { key: "shop",     value: "houseware",          label: "Artículos de hogar" },
  artesanias:   { key: "shop",     value: "craft",              label: "Artesanías" },
  ropa:         { key: "shop",     value: "clothes",            label: "Indumentaria" },
  joyeria:      { key: "shop",     value: "jewelry",            label: "Joyería / bijou" },
  floreria:     { key: "shop",     value: "florist",            label: "Florería" },
  libreria:     { key: "shop",     value: "stationery",         label: "Librería" },
  deportes:     { key: "shop",     value: "sports",             label: "Deportes" },
  supermercado: { key: "shop",     value: "supermarket",        label: "Supermercado" },
  ferreteria:   { key: "shop",     value: "hardware",           label: "Ferretería" },
  mascotas:     { key: "shop",     value: "pet",                label: "Mascotas" },
  agropecuaria: { key: "shop",     value: "agrarian",           label: "Agropecuaria" },
  // ── B2B: clientes de personalizados / merchandising ──
  industria:    { key: "man_made", value: "works",              label: "Industrias / fábricas" },
  empresa:      { key: "office",   value: "company",            label: "Empresas / oficinas" },
  publicidad:   { key: "office",   value: "advertising_agency", label: "Agencias de publicidad" },
  seguros:      { key: "office",   value: "insurance",          label: "Agencias de seguros" },
  inmobiliaria: { key: "office",   value: "estate_agent",       label: "Inmobiliarias" },
  cooperativa:  { key: "office",   value: "cooperative",        label: "Cooperativas" },
  acopio:       { key: "man_made", value: "silo",               label: "Silos / acopio" },
  gobierno:     { key: "office",   value: "government",         label: "Organismos públicos" },
};

async function ensureTable() {
  await ensureSchema("captacion");
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

// Ámbito geográfico para Overpass: un área (relación/way) o un bounding box
// (para ciudades/pueblos mapeados solo como nodo, que no definen un área).
type Ambito =
  | { kind: "area"; areaId: number; displayName: string }
  | { kind: "bbox"; bbox: [number, number, number, number]; displayName: string }; // south,west,north,east

// Geocodifica "zona, país" a un ámbito de Overpass usando Nominatim.
async function geocodeArea(zona: string, pais: string): Promise<Ambito | null> {
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
  if (hit.osm_type === "relation") return { kind: "area", areaId: 3600000000 + osmId, displayName: hit.display_name };
  if (hit.osm_type === "way")      return { kind: "area", areaId: 2400000000 + osmId, displayName: hit.display_name };
  // Nodo (pueblo chico): usamos su bounding box. Nominatim lo da como
  // [south, north, west, east] en strings.
  const bb = hit.boundingbox;
  if (Array.isArray(bb) && bb.length === 4) {
    const [south, north, west, east] = bb.map(Number);
    if ([south, north, west, east].every(Number.isFinite)) {
      return { kind: "bbox", bbox: [south, west, north, east], displayName: hit.display_name };
    }
  }
  return null;
}

function buildQuery(ambito: Ambito, seleccionados: { key: string; value: string }[]): string {
  // Agrupar por clave OSM: una cláusula nwr por cada key (shop, office, ...)
  const porKey = new Map<string, string[]>();
  for (const r of seleccionados) {
    if (!porKey.has(r.key)) porKey.set(r.key, []);
    porKey.get(r.key)!.push(r.value);
  }
  // Filtro de ámbito que se pega a cada cláusula nwr.
  const filtro = ambito.kind === "area"
    ? "(area.z)"
    : `(${ambito.bbox.join(",")})`;
  const clausulas = Array.from(porKey.entries())
    .map(([key, vals]) =>
      // "*" = barrido amplio: todos los elementos con esa clave y nombre.
      vals.includes("*")
        ? `nwr["${key}"]["name"]${filtro};`
        : `nwr["${key}"~"^(${vals.join("|")})$"]["name"]${filtro};`
    )
    .join("\n      ");
  const encabezado = ambito.kind === "area" ? `area(${ambito.areaId})->.z;` : "";
  return `
    [out:json][timeout:60];
    ${encabezado}
    (
      ${clausulas}
    );
    out center tags 2500;
  `;
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  await ensureTable();
  const sp = req.nextUrl.searchParams;
  const estado = sp.get("estado");
  const zona = sp.get("zona")?.trim();
  // Paginado: sin límite el navegador no aguanta una cartera de miles.
  const limit = Math.min(Math.max(Number(sp.get("limit")) || 200, 1), 500);
  const offset = Math.max(Number(sp.get("offset")) || 0, 0);

  const cond: string[] = [];
  const args: any[] = [];
  if (estado) { args.push(estado); cond.push(`estado = $${args.length}`); }
  if (zona)   { args.push(`%${zona}%`); cond.push(`provincia ILIKE $${args.length}`); }
  const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";
  // Mejor puntuados primero (los A arriba de todo); lo sin puntuar, al final por fecha.
  const rows = await (prisma as any).$queryRawUnsafe(
    `SELECT * FROM prospectos ${where}
     ORDER BY puntos DESC NULLS LAST, creado_en DESC LIMIT ${limit} OFFSET ${offset}`,
    ...args
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  await ensureTable();

  const payload = await req.json();

  // ── Alta manual de un contacto (no pasa por el mapa) ──
  if (payload?.manual) {
    const nombre = String(payload.nombre ?? "").trim();
    if (!nombre) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    const rows = await (prisma as any).$queryRawUnsafe(
      `INSERT INTO prospectos
         (nombre, rubro, direccion, telefono, email, website, instagram, facebook, provincia, notas, osm_id, estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'nuevo') RETURNING *`,
      nombre, payload.rubro?.trim() || null, payload.direccion?.trim() || null, payload.telefono?.trim() || null,
      payload.email?.trim() || null, payload.website?.trim() || null, normInstagram(payload.instagram), normFacebook(payload.facebook),
      payload.provincia?.trim() || null, payload.notas?.trim() || null, `manual/${Date.now()}`
    );
    return NextResponse.json({ ok: true, manual: true, prospecto: rows[0] }, { status: 201 });
  }

  const { zona, rubros, pais } = payload;
  if (!zona?.trim()) return NextResponse.json({ error: "Zona (provincia o ciudad) requerida" }, { status: 400 });
  const paisFinal = (pais?.trim() || "Argentina");

  const claves: string[] = Array.isArray(rubros) && rubros.length ? rubros : Object.keys(RUBROS);
  const seleccionados = claves.map(k => RUBROS[k]).filter(Boolean);
  if (!seleccionados.length) return NextResponse.json({ error: "Rubros inválidos" }, { status: 400 });

  // Geocodificar la zona dentro del país para acotar bien el ámbito
  let area: Ambito | null = null;
  try {
    area = await geocodeArea(zona.trim(), paisFinal);
  } catch {
    return NextResponse.json({ error: "No se pudo geolocalizar la zona. Probá de nuevo en un momento." }, { status: 502 });
  }
  if (!area) {
    return NextResponse.json({ error: `No se encontró "${zona}" en ${paisFinal}. Revisá el nombre de la provincia/ciudad y el país.`, total: 0 }, { status: 200 });
  }

  // Mapa inverso "key=value" -> label para etiquetar cada resultado
  const osmLabel = new Map<string, string>();
  for (const v of Object.values(RUBROS)) osmLabel.set(`${v.key}=${v.value}`, v.label);
  const CLAVES_OSM = ["shop", "office", "man_made", "building"];
  const etiquetaRubro = (t: any): string | null => {
    for (const k of CLAVES_OSM) {
      if (t[k] && osmLabel.has(`${k}=${t[k]}`)) return osmLabel.get(`${k}=${t[k]}`)!;
    }
    return t.shop ?? t.office ?? t.man_made ?? null;
  };

  const ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  ];
  const body = "data=" + encodeURIComponent(buildQuery(area, seleccionados));

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
        signal: AbortSignal.timeout(50000),
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
      rubro: etiquetaRubro(t),
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
