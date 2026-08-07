export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";

// Lista las ciudades y pueblos de una provincia (OSM). Alimenta el barrido:
// el cliente después busca comercios ciudad por ciudad, en tandas que entran
// en el límite de 60 s por request.

async function geocodeArea(zona: string, pais: string): Promise<number | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${zona}, ${pais}`)}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "AppVentas/1.0 (prospector; contacto tienda)", Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return null;
  const hit = (await res.json())[0];
  if (!hit) return null;
  const osmId = Number(hit.osm_id);
  if (hit.osm_type === "relation") return 3600000000 + osmId;
  if (hit.osm_type === "way") return 2400000000 + osmId;
  return null;
}

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const zona = sp.get("zona")?.trim();
  const pais = sp.get("pais")?.trim() || "Argentina";
  if (!zona) return NextResponse.json({ error: "Zona requerida" }, { status: 400 });

  const areaId = await geocodeArea(zona, pais).catch(() => null);
  if (!areaId) return NextResponse.json({ error: `No se encontró "${zona}" en ${pais}.` }, { status: 200 });

  // Incluimos village y hamlet: muchas localidades chicas/turísticas (ej. Las
  // Grutas) no están taggeadas como city/town y quedaban afuera del barrido.
  const query = `
    [out:json][timeout:60];
    area(${areaId})->.z;
    node[place~"^(city|town|village|hamlet)$"]["name"](area.z);
    out tags 1200;
  `;
  const body = "data=" + encodeURIComponent(query);

  let data: any = null;
  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "AppVentas/1.0 (prospector)" },
        body,
        signal: AbortSignal.timeout(45000),
      });
      if (res.ok) { data = await res.json(); break; }
    } catch { /* probar siguiente mirror */ }
  }
  if (!data) return NextResponse.json({ error: "No se pudo consultar el mapa. Probá de nuevo en un momento." }, { status: 502 });

  // Ordena por tamaño (city > town > village > hamlet), alfabético dentro.
  const ORDEN_PLACE: Record<string, number> = { city: 0, town: 1, village: 2, hamlet: 3 };
  const vistos = new Set<string>();
  const ciudades = (data.elements ?? [])
    .map((el: any) => ({ nombre: String(el.tags?.name ?? "").trim(), tipo: el.tags?.place ?? "town" }))
    .filter((c: any) => c.nombre && !vistos.has(c.nombre.toLowerCase()) && (vistos.add(c.nombre.toLowerCase()), true))
    .sort((a: any, b: any) => {
      const d = (ORDEN_PLACE[a.tipo] ?? 9) - (ORDEN_PLACE[b.tipo] ?? 9);
      return d !== 0 ? d : a.nombre.localeCompare(b.nombre);
    });

  return NextResponse.json({ ok: true, zona, total: ciudades.length, ciudades });
}
