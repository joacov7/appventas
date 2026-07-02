export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type Producto = {
  nombre: string;
  precio: number;
  categoria: string | null;
  url: string;
  imagen: string | null;
};

// ─── Retry with exponential backoff ──────────────────────────────────────────
async function fetchWithRetry(url: string, opts: RequestInit = {}, retries = 3): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        ...opts,
        signal: AbortSignal.timeout(15000),
        headers: {
          // UA de navegador real: los UA tipo "bot" activan el bloqueo
          // anti-bot (Cloudflare). Sin headers Sec-Fetch-*: mandarlos con
          // valores inconsistentes es una señal de bot peor que no mandarlos.
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
          ...((opts.headers as Record<string, string>) ?? {}),
        },
      });
      if (res.ok) return res;
      // Solo 404/410 son definitivos (recurso inexistente). 403/401 pueden ser
      // un WAF/Cloudflare transitorio: conviene reintentar.
      if (res.status === 404 || res.status === 410) {
        throw new Error(`HTTP ${res.status}`);
      }
      lastError = new Error(`HTTP ${res.status}`);
    } catch (e: any) {
      if (/^HTTP (404|410)$/.test(e?.message ?? "")) throw e;
      lastError = e;
    }
    if (i < retries - 1) await new Promise(r => setTimeout(r, 500 * 2 ** i));
  }
  throw lastError;
}

// Tope de páginas para no exceder el maxDuration del serverless
const MAX_PAGES = 30;

// ─── Tiendanube ───────────────────────────────────────────────────────────────
// Algunas tiendas sirven el catálogo en /products.json en vez de /productos.json
async function resolverRutaTiendanube(base: string): Promise<string | null> {
  for (const ruta of ["productos.json", "products.json"]) {
    try {
      const res = await fetchWithRetry(`${base}/${ruta}?per_page=1&page=1`, {}, 2);
      const data = await res.json();
      if (Array.isArray(data) || data.products || data.result) return ruta;
    } catch {}
  }
  return null;
}

async function scrapeTiendanube(base: string): Promise<Producto[]> {
  const ruta = await resolverRutaTiendanube(base);
  if (!ruta) return [];

  const results: Producto[] = [];
  const vistos = new Set<string>();
  // No asumimos que la tienda respete per_page: paginamos hasta página vacía
  // o hasta que una página no aporte URLs nuevas (servidor que ignora `page`).
  for (let page = 1; page <= MAX_PAGES; page++) {
    let res: Response;
    try {
      res = await fetchWithRetry(`${base}/${ruta}?per_page=200&page=${page}`);
    } catch {
      break;
    }
    const data = await res.json();
    const items: any[] = Array.isArray(data) ? data : (data.products ?? data.result ?? []);
    if (!items.length) break;

    let nuevos = 0;
    for (const item of items) {
      const url = item.canonical_url ?? item.permalink ?? `${base}/productos/${item.handle ?? item.id}`;
      if (vistos.has(url)) continue;
      vistos.add(url);
      nuevos++;

      const variants: any[] = item.variants ?? [];
      const prices = variants.length > 0
        ? variants.map((v: any) => Number(v.promotional_price || v.price || 0)).filter(p => p > 0)
        : [Number(item.promotional_price || item.price || 0)].filter(p => p > 0);
      const precio = prices.length > 0 ? Math.min(...prices) : 0;
      if (!precio) continue;
      results.push({
        nombre: String(item.name ?? item.nombre ?? ""),
        precio,
        categoria: item.categories?.[0]?.name ?? null,
        url,
        imagen: item.images?.[0]?.src ?? item.images?.[0]?.url ?? null,
      });
    }
    if (nuevos === 0) break; // el servidor repite la misma página
  }
  return results;
}

// ─── Empretienda ──────────────────────────────────────────────────────────────
async function scrapeEmpretienda(base: string): Promise<Producto[]> {
  const results: Producto[] = [];
  const vistos = new Set<string>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    let res: Response;
    try {
      res = await fetchWithRetry(`${base}/catalog/api/products?per_page=100&page=${page}`);
    } catch {
      break;
    }
    const data = await res.json();
    const items: any[] = data.data ?? data.products ?? (Array.isArray(data) ? data : []);
    if (!items.length) break;

    let nuevos = 0;
    for (const item of items) {
      const url = item.url ?? `${base}/productos/${item.slug ?? item.id}`;
      if (vistos.has(url)) continue;
      vistos.add(url);
      nuevos++;

      const precio = Number(item.price ?? item.variants?.[0]?.price ?? 0);
      if (!precio) continue;
      results.push({
        nombre: String(item.name ?? ""),
        precio,
        categoria: item.category?.name ?? null,
        url,
        imagen: item.image?.url ?? item.images?.[0]?.src ?? null,
      });
    }
    if (nuevos === 0) break;
  }
  return results;
}

// ─── Shopify ──────────────────────────────────────────────────────────────────
async function scrapeShopify(base: string): Promise<Producto[]> {
  const results: Producto[] = [];
  const vistos = new Set<string>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    let res: Response;
    try {
      res = await fetchWithRetry(`${base}/products.json?limit=250&page=${page}`);
    } catch {
      break;
    }
    const data = await res.json();
    const items: any[] = data.products ?? [];
    if (!items.length) break;

    let nuevos = 0;
    for (const item of items) {
      const url = `${base}/products/${item.handle}`;
      if (vistos.has(url)) continue;
      vistos.add(url);
      nuevos++;

      const variants: any[] = item.variants ?? [];
      const prices = variants
        .filter((v: any) => v.available !== false)
        .map((v: any) => Number(v.price || 0))
        .filter(p => p > 0);
      const todas = prices.length ? prices : variants.map((v: any) => Number(v.price || 0)).filter(p => p > 0);
      const precio = todas.length ? Math.min(...todas) : 0;
      if (!precio) continue;
      results.push({
        nombre: String(item.title ?? ""),
        precio,
        categoria: item.product_type || null,
        url,
        imagen: item.images?.[0]?.src ?? null,
      });
    }
    if (nuevos === 0) break;
  }
  return results;
}

// ─── WooCommerce (Store API pública) ─────────────────────────────────────────
async function scrapeWoo(base: string): Promise<Producto[]> {
  const results: Producto[] = [];
  const vistos = new Set<string>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    let res: Response;
    try {
      res = await fetchWithRetry(`${base}/wp-json/wc/store/v1/products?per_page=100&page=${page}`);
    } catch {
      break;
    }
    const data = await res.json();
    const items: any[] = Array.isArray(data) ? data : [];
    if (!items.length) break;

    let nuevos = 0;
    for (const item of items) {
      const url = item.permalink ?? `${base}/?p=${item.id}`;
      if (vistos.has(url)) continue;
      vistos.add(url);
      nuevos++;

      // La Store API devuelve precios en unidades menores (centavos)
      const minorUnit = Number(item.prices?.currency_minor_unit ?? 2);
      const raw = Number(item.prices?.price ?? 0);
      const precio = raw / Math.pow(10, minorUnit);
      if (!precio) continue;
      results.push({
        nombre: String(item.name ?? ""),
        precio,
        categoria: item.categories?.[0]?.name ?? null,
        url,
        imagen: item.images?.[0]?.src ?? null,
      });
    }
    if (nuevos === 0) break;
  }
  return results;
}

// ─── MercadoLibre (por término de búsqueda) ──────────────────────────────────
async function scrapeML(termino: string): Promise<Producto[]> {
  const results: Producto[] = [];
  let offset = 0;
  const limit = 50;
  while (offset < 200) {
    let res: Response;
    try {
      res = await fetchWithRetry(
        `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(termino)}&limit=${limit}&offset=${offset}`
      );
    } catch {
      break;
    }
    const data = await res.json();
    const items: any[] = data.results ?? [];
    if (!items.length) break;
    for (const item of items) {
      const precio = Number(item.price ?? 0);
      if (!precio) continue;
      results.push({
        nombre: String(item.title ?? ""),
        precio,
        categoria: item.category_id ?? null,
        url: item.permalink ?? "",
        imagen: item.thumbnail?.replace(/\-I\.jpg$/, "-O.jpg") ?? null,
      });
    }
    if (items.length < limit) break;
    offset += limit;
  }
  return results;
}

// ─── Detección por huellas en el HTML de la portada ──────────────────────────
async function sniffPlataforma(base: string): Promise<string | null> {
  try {
    const res = await fetchWithRetry(base, { headers: { Accept: "text/html" } }, 2);
    const html = (await res.text()).slice(0, 200_000).toLowerCase();
    if (html.includes("cdn.shopify.com") || html.includes("shopify.theme") || html.includes("myshopify.com")) return "shopify";
    if (html.includes("tiendanube") || html.includes("nuvemshop") || html.includes("tienda-nube")) return "tiendanube";
    if (html.includes("woocommerce") || html.includes("wp-content/plugins/woocommerce")) return "woocommerce";
    if (html.includes("empretienda")) return "empretienda";
    if (html.includes("wixstatic.com") || html.includes("wix.com")) return "wix";
    if (html.includes("vtex")) return "vtex";
    if (html.includes("mercadoshops")) return "mercadoshops";
  } catch {}
  return null;
}

// ─── Auto-detect platform ─────────────────────────────────────────────────────
async function detectAndScrape(url: string, plataforma: string): Promise<{ productos: Producto[]; plataformaDetectada: string; detalle?: string }> {
  // Normalizar a la raíz del dominio: si guardaron la URL con path
  // (ej. https://tienda.com/productos), la API vive igual en la raíz.
  let base = url.replace(/\/$/, "");
  try { base = new URL(base).origin; } catch {}

  // Si ya sabemos la plataforma, ir directo al scrape (sin re-probar la
  // detección: un fallo transitorio del probe tiraba abajo todo el scrape)
  if (plataforma === "empretienda") {
    return { productos: await scrapeEmpretienda(base), plataformaDetectada: "empretienda" };
  }
  if (plataforma === "shopify") {
    const productos = await scrapeShopify(base);
    if (productos.length) return { productos, plataformaDetectada: "shopify" };
  }
  if (plataforma === "woocommerce") {
    const productos = await scrapeWoo(base);
    if (productos.length) return { productos, plataformaDetectada: "woocommerce" };
  }
  if (plataforma === "tiendanube") {
    const productos = await scrapeTiendanube(base);
    if (productos.length) return { productos, plataformaDetectada: "tiendanube" };
    // Si no trajo nada, seguir con la detección normal por las dudas
  }

  let detalle: string | undefined;

  // Plataforma desconocida: oler el HTML de la portada para ir directo
  const olfateada = await sniffPlataforma(base);
  if (olfateada === "shopify") {
    const productos = await scrapeShopify(base);
    if (productos.length) return { productos, plataformaDetectada: "shopify" };
  } else if (olfateada === "woocommerce") {
    const productos = await scrapeWoo(base);
    if (productos.length) return { productos, plataformaDetectada: "woocommerce" };
  } else if (olfateada === "tiendanube") {
    const productos = await scrapeTiendanube(base);
    if (productos.length) return { productos, plataformaDetectada: "tiendanube" };
  } else if (olfateada === "empretienda") {
    const productos = await scrapeEmpretienda(base);
    if (productos.length) return { productos, plataformaDetectada: "empretienda" };
  } else if (olfateada) {
    // Plataforma identificada pero sin API pública que podamos leer
    return {
      productos: [],
      plataformaDetectada: olfateada,
      detalle: `plataforma ${olfateada} — no tiene catálogo público accesible`,
    };
  }

  // Intentar Tiendanube primero (incluso para dominios propios),
  // salvo que ya lo hayamos intentado directo arriba
  if (plataforma !== "tiendanube") {
    try {
      const productos = await scrapeTiendanube(base); // se auto-verifica (resuelve la ruta o devuelve vacío)
      if (productos.length) return { productos, plataformaDetectada: "tiendanube" };
    } catch (e: any) {
      detalle = e?.message;
    }
  }

  // Intentar Shopify
  if (plataforma !== "shopify") {
    try {
      const res = await fetchWithRetry(`${base}/products.json?limit=1`);
      const data = await res.json();
      if (Array.isArray(data.products)) {
        const productos = await scrapeShopify(base);
        if (productos.length) return { productos, plataformaDetectada: "shopify" };
      }
    } catch (e: any) {
      detalle = detalle ?? e?.message;
    }
  }

  // Intentar Empretienda
  try {
    const res = await fetchWithRetry(`${base}/catalog/api/products?per_page=1&page=1`);
    const data = await res.json();
    if (data.data || data.products || Array.isArray(data)) {
      const productos = await scrapeEmpretienda(base);
      if (productos.length) return { productos, plataformaDetectada: "empretienda" };
    }
  } catch (e: any) {
    detalle = detalle ?? e?.message;
  }

  // Intentar WooCommerce (Store API pública)
  if (plataforma !== "woocommerce") {
    try {
      const res = await fetchWithRetry(`${base}/wp-json/wc/store/v1/products?per_page=1`);
      const data = await res.json();
      if (Array.isArray(data)) {
        const productos = await scrapeWoo(base);
        if (productos.length) return { productos, plataformaDetectada: "woocommerce" };
      }
    } catch (e: any) {
      detalle = detalle ?? e?.message;
    }
  }

  return { productos: [], plataformaDetectada: plataforma, detalle };
}

// ─── Ensure unique constraint exists ─────────────────────────────────────────
async function ensureConstraint() {
  await (prisma as any).$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'productos_competidores_tienda_url_unique'
      ) THEN
        ALTER TABLE productos_competidores
          ADD CONSTRAINT productos_competidores_tienda_url_unique UNIQUE (tienda_id, url);
      END IF;
    END $$
  `).catch(() => {});
}

// ─── Bulk upsert ─────────────────────────────────────────────────────────────
// marcarFaltantes: marcar disponible=false lo que no vino en este scrape.
// Debe ser false para MercadoLibre: cada búsqueda trae un subconjunto distinto
// y no debe pisar los resultados de búsquedas anteriores.
async function bulkUpsert(tiendaId: number, productos: Producto[], marcarFaltantes = true): Promise<number> {
  // Dedupe por URL: dos filas iguales en el mismo INSERT rompen el ON CONFLICT
  const porUrl = new Map<string, Producto>();
  for (const p of productos) porUrl.set(p.url, p);
  productos = Array.from(porUrl.values());
  if (!productos.length) return 0;

  await ensureConstraint();

  // Fetch existing products for this store to detect price changes
  const existing: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT url, precio FROM productos_competidores WHERE tienda_id = $1`,
    tiendaId
  );
  const existingMap = new Map<string, number>(existing.map(e => [e.url, Number(e.precio)]));

  // Build bulk upsert in chunks of 100
  const CHUNK = 100;
  let total = 0;

  for (let i = 0; i < productos.length; i += CHUNK) {
    const chunk = productos.slice(i, i + CHUNK);
    const values: string[] = [];
    const params: any[] = [];
    let idx = 1;

    for (const p of chunk) {
      const precioAnterior = existingMap.get(p.url) ?? null;
      values.push(`($${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},true,NOW())`);
      params.push(tiendaId, p.nombre, p.precio, precioAnterior, p.categoria, p.imagen, p.url);
    }

    await (prisma as any).$executeRawUnsafe(`
      INSERT INTO productos_competidores
        (tienda_id, nombre, precio, precio_anterior, categoria, imagen, url, disponible, ultima_vez)
      VALUES ${values.join(",")}
      ON CONFLICT (tienda_id, url) DO UPDATE SET
        nombre       = EXCLUDED.nombre,
        precio_anterior = CASE
          WHEN productos_competidores.precio IS DISTINCT FROM EXCLUDED.precio
          THEN productos_competidores.precio
          ELSE productos_competidores.precio_anterior
        END,
        precio       = EXCLUDED.precio,
        categoria    = EXCLUDED.categoria,
        imagen       = EXCLUDED.imagen,
        disponible   = true,
        ultima_vez   = NOW()
    `, ...params);

    total += chunk.length;
  }

  // Mark products not in this scrape as unavailable
  if (marcarFaltantes && productos.length > 0) {
    const urls = productos.map(p => p.url);
    await (prisma as any).$executeRawUnsafe(`
      UPDATE productos_competidores
      SET disponible = false
      WHERE tienda_id = $1
        AND url != ALL($2::text[])
        AND disponible = true
    `, tiendaId, urls);
  }

  return total;
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });

  const body = await req.json();
  const { tiendaId, termino } = body;

  // Scrape by search term on MercadoLibre
  if (termino) {
    try {
      const productos = await scrapeML(termino);
      if (!productos.length) return NextResponse.json({ error: "Sin resultados en MercadoLibre" }, { status: 422 });

      // Store under a virtual ML store
      const stores: any[] = await (prisma as any).$queryRawUnsafe(`
        INSERT INTO tiendas_competidoras (nombre, url, plataforma)
        VALUES ('MercadoLibre', 'https://mercadolibre.com.ar', 'mercadolibre')
        ON CONFLICT (url) DO UPDATE SET nombre = 'MercadoLibre'
        RETURNING id
      `);
      const mlTiendaId = stores[0].id;
      const total = await bulkUpsert(mlTiendaId, productos, false);
      await (prisma as any).$executeRawUnsafe(
        `UPDATE tiendas_competidoras SET ultimo_scrape = NOW() WHERE id = $1`, mlTiendaId
      );
      return NextResponse.json({ ok: true, total, plataforma: "mercadolibre" });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message }, { status: 500 });
    }
  }

  // Scrape by store URL
  if (!tiendaId) return NextResponse.json({ error: "tiendaId o termino requerido" }, { status: 400 });

  const tiendas: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT * FROM tiendas_competidoras WHERE id = $1`, Number(tiendaId)
  );
  const tienda = tiendas[0];
  if (!tienda) return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 });

  try {
    const { productos, plataformaDetectada, detalle } = await detectAndScrape(tienda.url, tienda.plataforma);

    if (!productos.length) {
      const esBloqueo = detalle?.includes("403") || detalle?.includes("401");
      let msg: string;
      if (detalle?.startsWith("plataforma ")) {
        msg = `Detectamos la ${detalle}. Si la tienda vende en MercadoLibre, seguila desde la pestaña Búsquedas.`;
      } else if (esBloqueo) {
        msg = `La tienda bloquea el acceso automático (${detalle}). Su protección anti-bots no permite leer el catálogo desde un servidor.`;
      } else {
        msg = `No se encontraron productos${detalle ? ` (${detalle})` : ""}. La tienda puede no tener API pública o el formato no es compatible.`;
      }
      return NextResponse.json({ error: msg, plataforma: plataformaDetectada }, { status: 422 });
    }

    const total = await bulkUpsert(Number(tiendaId), productos);

    // Update store metadata
    await (prisma as any).$executeRawUnsafe(`
      UPDATE tiendas_competidoras
      SET ultimo_scrape = NOW(), plataforma = $2
      WHERE id = $1
    `, Number(tiendaId), plataformaDetectada);

    return NextResponse.json({ ok: true, total, plataforma: plataformaDetectada });
  } catch (e: any) {
    return NextResponse.json({ error: `Error al scrapear: ${e?.message}` }, { status: 500 });
  }
}
