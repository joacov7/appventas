// Research de "productos ganadores" en MercadoLibre.
// Lee la página pública de resultados y extrae señales de éxito (vendidos,
// reseñas, badge "Más vendido") para rankear oportunidades. 100% determinístico.
//
// FRÁGIL POR NATURALEZA: depende del HTML de ML, que cambia seguido y a veces
// bloquea. Es "best-effort": si algo falla, devuelve lo que pudo.

export interface ProductoGanador {
  nombre: string;
  precio: number;
  url: string;
  imagen: string | null;
  vendidos: number | null;
  reviews: number | null;
  rating: number | null;
  mas_vendido: boolean;
  score: number;          // ranking de "ganador"
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, " ").trim();
}

async function fetchHTML(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "es-AR,es;q=0.9" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// "+100 vendidos" → 100 · "1000+ vendidos" → 1000 · "50 vendidos" → 50
function parseVendidos(bloque: string): number | null {
  const m = bloque.match(/([\d.]+)\s*\+?\s*vendidos?/i) || bloque.match(/\+\s*([\d.]+)\s*vendidos?/i);
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseReviews(bloque: string): { rating: number | null; reviews: number | null } {
  // rating tipo "Calificación 4.8 de 5" y cantidad "(1234)"
  const rat = bloque.match(/poly-reviews__rating[^>]*>\s*([\d.,]+)/) || bloque.match(/Calificación\s+([\d.,]+)\s+de\s+5/i);
  const rev = bloque.match(/poly-reviews__total[^>]*>\s*\(?([\d.]+)\)?/) || bloque.match(/\(([\d.]{1,7})\)/);
  const rating = rat ? Number(rat[1].replace(",", ".")) : null;
  const reviews = rev ? Number(rev[1].replace(/\./g, "")) : null;
  return {
    rating: rating != null && rating <= 5 ? rating : null,
    reviews: reviews != null && Number.isFinite(reviews) ? reviews : null,
  };
}

// Busca productos en ML por término y los rankea por señales de éxito.
export async function buscarGanadoresML(termino: string, paginas = 3): Promise<ProductoGanador[]> {
  const slug = encodeURIComponent(termino.trim().replace(/\s+/g, "-").toLowerCase());
  const results: ProductoGanador[] = [];
  const vistos = new Set<string>();

  for (let page = 0; page < Math.min(paginas, 5); page++) {
    const desde = page * 50 + 1;
    const url = page === 0
      ? `https://listado.mercadolibre.com.ar/${slug}`
      : `https://listado.mercadolibre.com.ar/${slug}_Desde_${desde}`;

    const html = await fetchHTML(url);
    if (!html) break;

    const tarjetas = html.split(/<li[^>]*class="[^"]*ui-search-layout__item/).slice(1);
    let nuevos = 0;

    for (const bloque of tarjetas.length ? tarjetas : [html]) {
      const linkMatch = bloque.match(/<a[^>]+class="[^"]*poly-component__title[^"]*"[^>]+href="([^"]+)"[^>]*>([^<]+)</)
        || bloque.match(/<a[^>]+href="(https:\/\/[^"]*(?:articulo\.mercadolibre|www\.mercadolibre)[^"]+)"[^>]*>([^<]{6,})</);
      if (!linkMatch) continue;
      const urlProd = decodeEntities(linkMatch[1]).split("#")[0].split("?")[0];
      const nombre = decodeEntities(linkMatch[2]);
      if (!urlProd || !nombre || vistos.has(urlProd)) continue;

      const precioMatch = bloque.match(/andes-money-amount__fraction[^>]*>([\d.]+)</);
      if (!precioMatch) continue;
      const precio = Number(precioMatch[1].replace(/\./g, ""));
      if (!precio) continue;

      const imgMatch = bloque.match(/<img[^>]+(?:data-src|src)="(https:\/\/http2\.mlstatic\.com[^"]+)"/);
      const vendidos = parseVendidos(bloque);
      const { rating, reviews } = parseReviews(bloque);
      const masVendido = /MÁS VENDIDO|Más vendido|MAS VENDIDO/i.test(bloque);

      // Score de "ganador": ventas pesan más; reseñas y badge suman.
      const score = (vendidos ?? 0) * 1 + (reviews ?? 0) * 2 + (masVendido ? 200 : 0) + (rating ?? 0) * 10;

      vistos.add(urlProd);
      nuevos++;
      results.push({ nombre, precio, url: urlProd, imagen: imgMatch?.[1] ?? null, vendidos, reviews, rating, mas_vendido: masVendido, score: Math.round(score) });
    }

    if (nuevos === 0) break;
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

export interface ResumenGanadores {
  termino: string;
  total: number;
  precio_min: number | null;
  precio_prom: number | null;
  precio_max: number | null;
  ganadores: ProductoGanador[];
}

// Arma el resumen con estadística de precios de los mejores rankeados.
export async function researchGanadores(termino: string): Promise<ResumenGanadores> {
  const ganadores = await buscarGanadoresML(termino);
  const precios = ganadores.map(g => g.precio).filter(p => p > 0).sort((a, b) => a - b);
  const prom = precios.length ? precios.reduce((a, b) => a + b, 0) / precios.length : null;
  return {
    termino,
    total: ganadores.length,
    precio_min: precios.length ? precios[0] : null,
    precio_prom: prom,
    precio_max: precios.length ? precios[precios.length - 1] : null,
    ganadores: ganadores.slice(0, 40),
  };
}
