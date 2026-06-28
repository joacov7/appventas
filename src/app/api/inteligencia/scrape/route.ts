export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

async function scrapeTiendanube(url: string): Promise<{ nombre: string; precio: number; categoria: string | null; url: string; imagen: string | null }[]> {
  const base = url.replace(/\/$/, "");
  const results: any[] = [];
  let page = 1;
  while (page <= 5) {
    const res = await fetch(`${base}/productos.json?per_page=200&page=${page}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PriceBot/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) break;
    const data = await res.json();
    const items: any[] = Array.isArray(data) ? data : (data.products ?? data.result ?? []);
    if (!items.length) break;
    for (const item of items) {
      const variants: any[] = item.variants ?? [];
      const precio = variants.length > 0
        ? Math.min(...variants.map((v: any) => Number(v.price ?? v.promotional_price ?? 0)).filter(Boolean))
        : Number(item.price ?? 0);
      if (!precio) continue;
      results.push({
        nombre: String(item.name ?? item.nombre ?? ""),
        precio,
        categoria: item.categories?.[0]?.name ?? null,
        url: item.permalink ?? item.url ?? `${base}/productos/${item.handle ?? item.id}`,
        imagen: item.images?.[0]?.src ?? item.images?.[0]?.url ?? null,
      });
    }
    if (items.length < 200) break;
    page++;
  }
  return results;
}

async function scrapeEmpretienda(url: string): Promise<{ nombre: string; precio: number; categoria: string | null; url: string; imagen: string | null }[]> {
  const base = url.replace(/\/$/, "");
  const res = await fetch(`${base}/catalog/api/products?per_page=100`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PriceBot/1.0)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  const items: any[] = data.data ?? data.products ?? (Array.isArray(data) ? data : []);
  return items
    .map((item: any) => ({
      nombre: String(item.name ?? ""),
      precio: Number(item.price ?? item.variants?.[0]?.price ?? 0),
      categoria: item.category?.name ?? null,
      url: item.url ?? `${base}/productos/${item.slug ?? item.id}`,
      imagen: item.image?.url ?? item.images?.[0]?.src ?? null,
    }))
    .filter(p => p.precio > 0);
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });

  const { tiendaId } = await req.json();
  if (!tiendaId) return NextResponse.json({ error: "tiendaId requerido" }, { status: 400 });

  const tiendas: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT * FROM tiendas_competidoras WHERE id = $1`, Number(tiendaId)
  );
  const tienda = tiendas[0];
  if (!tienda) return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 });

  let productos: { nombre: string; precio: number; categoria: string | null; url: string; imagen: string | null }[] = [];

  try {
    if (tienda.plataforma === "empretienda") {
      productos = await scrapeEmpretienda(tienda.url);
    } else {
      // tiendanube or unknown — try Tiendanube JSON API
      productos = await scrapeTiendanube(tienda.url);
    }
  } catch (e: any) {
    return NextResponse.json({ error: `Error al scrapear: ${e?.message}` }, { status: 500 });
  }

  if (!productos.length) {
    return NextResponse.json({ error: "No se encontraron productos. La tienda puede no tener una API pública de productos." }, { status: 422 });
  }

  // Upsert cada producto: try UPDATE first, then INSERT if not exists
  let actualizados = 0;
  for (const p of productos) {
    const updated: any[] = await (prisma as any).$queryRawUnsafe(`
      UPDATE productos_competidores SET
        precio_anterior = CASE WHEN precio IS DISTINCT FROM $3 THEN precio ELSE precio_anterior END,
        precio = $3, nombre = $2, categoria = $4, imagen = $5, ultima_vez = NOW(), disponible = true
      WHERE tienda_id = $1 AND url = $6
      RETURNING id
    `, Number(tiendaId), p.nombre, p.precio, p.categoria, p.imagen, p.url);

    if (!updated.length) {
      await (prisma as any).$executeRawUnsafe(`
        INSERT INTO productos_competidores (tienda_id, nombre, precio, categoria, url, imagen, disponible, ultima_vez)
        VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
      `, Number(tiendaId), p.nombre, p.precio, p.categoria, p.url, p.imagen);
    }
    actualizados++;
  }

  // Actualizar ultimo_scrape de la tienda
  await (prisma as any).$executeRawUnsafe(
    `UPDATE tiendas_competidoras SET ultimo_scrape = NOW() WHERE id = $1`, Number(tiendaId)
  );

  return NextResponse.json({ ok: true, total: actualizados });
}
