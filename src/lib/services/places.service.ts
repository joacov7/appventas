// Integración con Google Places API (New) — Text Search.
// Complementa al motor OSM/Overpass: Places suele traer TELÉFONO y SITIO WEB
// que OSM no tiene, a cambio de un costo por request.
//
// Doc: https://developers.google.com/maps/documentation/places/web-service/text-search

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

// Campos que pedimos. Incluir teléfono/web sube el SKU pero es el objetivo:
// conseguir datos de contacto reales.
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.location",
  "places.primaryTypeDisplayName",
  "places.businessStatus",
  "nextPageToken",
].join(",");

export interface LugarPlaces {
  placeId: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  website: string | null;
  rubro: string | null;
  lat: number | null;
  lon: number | null;
}

export function placesConfigurado(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY);
}

// ─── Control de gastos ────────────────────────────────────────────────────────
// Cada request de Text Search con datos de contacto cuesta ~US$0.035 (SKU
// Advanced). Contamos los requests del mes en catalog_config y frenamos al
// llegar al límite que fije el dueño (default US$10/mes).

export const COSTO_POR_REQUEST_USD = 0.035;
const LIMITE_DEFAULT_USD = 10;

function mesActual(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

export async function limitePlacesUsd(): Promise<number> {
  const { prisma } = await import("@/lib/prisma");
  const { ensureSchema } = await import("@/lib/db/schema");
  await ensureSchema("config");
  try {
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT config FROM catalog_config WHERE tipo = 'places_config'`);
    const v = Number(rows[0]?.config?.limite_usd);
    return Number.isFinite(v) && v >= 0 ? v : LIMITE_DEFAULT_USD;
  } catch { return LIMITE_DEFAULT_USD; }
}

export async function setLimitePlacesUsd(limite: number): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  const { ensureSchema } = await import("@/lib/db/schema");
  await ensureSchema("config");
  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO catalog_config (tipo, config) VALUES ('places_config', $1::jsonb)
     ON CONFLICT (tipo) DO UPDATE SET config = $1::jsonb, updated_at = NOW()`,
    JSON.stringify({ limite_usd: limite })
  );
}

export async function usoPlacesMes(): Promise<{ requests: number; gasto_usd: number }> {
  const { prisma } = await import("@/lib/prisma");
  const { ensureSchema } = await import("@/lib/db/schema");
  await ensureSchema("config");
  try {
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT config FROM catalog_config WHERE tipo = $1`, `places_uso:${mesActual()}`);
    const requests = Number(rows[0]?.config?.requests ?? 0);
    return { requests, gasto_usd: Math.round(requests * COSTO_POR_REQUEST_USD * 100) / 100 };
  } catch { return { requests: 0, gasto_usd: 0 }; }
}

async function registrarUsoPlaces(n: number): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  try {
    await (prisma as any).$executeRawUnsafe(
      `INSERT INTO catalog_config (tipo, config) VALUES ($1, jsonb_build_object('requests', $2::int))
       ON CONFLICT (tipo) DO UPDATE SET
         config = jsonb_set(catalog_config.config, '{requests}',
           (COALESCE((catalog_config.config->>'requests')::int, 0) + $2::int)::text::jsonb),
         updated_at = NOW()`,
      `places_uso:${mesActual()}`, n
    );
  } catch { /* no crítico: el conteo no debe romper la búsqueda */ }
}

// ¿Queda presupuesto? Devuelve el estado para decidir/informar.
export async function presupuestoPlaces(): Promise<{ limite_usd: number; requests: number; gasto_usd: number; disponible: boolean }> {
  const [limite_usd, uso] = await Promise.all([limitePlacesUsd(), usoPlacesMes()]);
  return { limite_usd, ...uso, disponible: uso.gasto_usd < limite_usd };
}

function mapPlace(p: any): LugarPlaces | null {
  const nombre = String(p?.displayName?.text ?? "").trim();
  if (!nombre) return null;
  // Solo negocios operativos (descartamos cerrados definitivamente).
  if (p?.businessStatus && p.businessStatus !== "OPERATIONAL") return null;
  return {
    placeId: String(p.id),
    nombre,
    direccion: p.formattedAddress ?? null,
    telefono: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? null,
    website: p.websiteUri ?? null,
    rubro: p?.primaryTypeDisplayName?.text ?? null,
    lat: p?.location?.latitude ?? null,
    lon: p?.location?.longitude ?? null,
  };
}

// Busca lugares por consulta de texto, paginando hasta `maxPaginas` (20 x página).
export async function buscarLugares(
  textQuery: string,
  opts: { regionCode?: string; maxPaginas?: number } = {}
): Promise<LugarPlaces[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY no configurada");

  const maxPaginas = Math.min(Math.max(opts.maxPaginas ?? 2, 1), 3);
  const out: LugarPlaces[] = [];
  let pageToken: string | undefined;

  for (let pagina = 0; pagina < maxPaginas; pagina++) {
    const body: any = { textQuery, languageCode: "es" };
    if (opts.regionCode) body.regionCode = opts.regionCode;
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    // Cada POST es un request facturable, salga bien o con error de datos.
    await registrarUsoPlaces(1);

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Places respondió ${res.status}: ${txt.slice(0, 200)}`);
    }

    const data = await res.json();
    for (const p of data.places ?? []) {
      const m = mapPlace(p);
      if (m) out.push(m);
    }
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return out;
}
