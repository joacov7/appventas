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
