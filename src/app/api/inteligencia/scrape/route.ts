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
          "User-Agent": "Mozilla/5.0 (compatible; PriceBot/1.0)",
          Accept: "application/json",
          ...((opts.headers as Record<string, string>) ?? {}),
        },
      });
      if (res.ok) return res;
      if (res.status === 404 || res.status === 403) throw new Error(`HTTP ${res.status}`);
      lastError = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastError = e;
    }
    if (i < retries - 1) await new Promise(r => setTimeout(r, 500 * 2 ** i));
  }
  throw lastError;
}

// ─── Tiendanube ───────────────────────────────────────────────────────────────
async function scrapeTiendanube(base: string): Promise<Producto[]> {
  const results: Producto[] = [];
  let page = 1;
  while (true) {
    let res: Response;
    try {
      res = await fetchWithRetry(`${base}/productos.json?per_page=200&page=${page}`);
    } catch {
      break;
    }
    const data = await res.json();
    const items: any[] = Array.isArray(data) ? data : (data.products ?? data.result ?? []);
    if (!items.length) break;
    for (const item of items) {
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
        url: item.canonical_url ?? item.permalink ?? `${base}/productos/${item.handle ?? item.id}`,
        imagen: item.images?.[0]?.src ?? item.images?.[0]?.url ?? null,
      });
    }
    if (items.length < 200) break;
    page++;
  }
  return results;
}

// ─── Empretienda ──────────────────────────────────────────────────────────────
async function scrapeEmpretienda(base: string): Promise<Producto[]> {
  const results: Producto[] = [];
  let page = 1;
  while (true) {
    let res: Response;
    try {
      res = await fetchWithRetry(`${base}/catalog/api/products?per_page=100&page=${page}`);
    } catch {
      break;
    }
    const data = await res.json();
    const items: any[] = data.data ?? data.products ?? (Array.isArray(data) ? data : []);
    if (!items.length) break;
    for (const item of items) {
      const precio = Number(item.price ?? item.variants?.[0]?.price ?? 0);
      if (!precio) continue;
      results.push({
        nombre: String(item.name ?? ""),
        precio,
        categoria: item.category?.name ?? null,
        url: item.url ?? `${base}/productos/${item.slug ?? item.id}`,
        imagen: item.image?.url ?? item.images?.[0]?.src ?? null,
      });
    }
    if (items.length < 100) break;
    page++;
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

// ─── Auto-detect platform ─────────────────────────────────────────────────────
async function detectAndScrape(url: string, plataforma: string): Promise<{ productos: Producto[]; plataformaDetectada: string }> {
  const base = url.replace(/\/$/, "");

  // Si ya sabemos la plataforma, usarla directamente
  if (plataforma === "empretienda") {
    return { productos: await scrapeEmpretienda(base), plataformaDetectada: "empretienda" };
  }

  // Intentar Tiendanube primero (incluso para dominios propios)
  try {
    const res = await fetchWithRetry(`${base}/productos.json?per_page=1&page=1`);
    const data = await res.json();
    if (Array.isArray(data) || data.products || data.result) {
      const productos = await scrapeTiendanube(base);
      if (productos.length) return { productos, plataformaDetectada: "tiendanube" };
    }
  } catch {}

  // Intentar Empretienda
  try {
    const res = await fetchWithRetry(`${base}/catalog/api/products?per_page=1&page=1`);
    const data = await res.json();
    if (data.data || data.products || Array.isArray(data)) {
      const productos = await scrapeEmpretienda(base);
      if (productos.length) return { productos, plataformaDetectada: "empretienda" };
    }
  } catch {}

  return { productos: [], plataformaDetectada: plataforma };
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
async function bulkUpsert(tiendaId: number, productos: Producto[]): Promise<number> {
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
  if (productos.length > 0) {
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
      const total = await bulkUpsert(mlTiendaId, productos);
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
    const { productos, plataformaDetectada } = await detectAndScrape(tienda.url, tienda.plataforma);

    if (!productos.length) {
      return NextResponse.json({
        error: "No se encontraron productos. La tienda puede no tener API pública o el formato no es compatible.",
      }, { status: 422 });
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
