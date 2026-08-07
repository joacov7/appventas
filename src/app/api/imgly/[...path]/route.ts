export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";

// Proxy same-origin para el modelo de "Quitar fondo". Algunos navegadores
// (Safari/iOS) fallan al bajar el modelo del CDN externo por CORS. Sirviéndolo
// desde nuestro propio dominio se evita ese problema.
const BASE = "https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const url = BASE + (path ?? []).join("/");
  const upstream = await fetch(url);
  if (!upstream.ok || !upstream.body) {
    return new Response("No encontrado", { status: upstream.status || 502 });
  }
  const headers = new Headers();
  const ct = upstream.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(upstream.body, { status: 200, headers });
}
