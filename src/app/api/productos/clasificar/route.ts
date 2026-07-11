export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

// Rubros y las palabras clave para detectarlos en el nombre. El ORDEN importa:
// se asigna el primer rubro que matchea (de lo más específico a lo más general).
const RUBROS: { nombre: string; slug: string; patrones: string[] }[] = [
  { nombre: "Bombillas", slug: "bombillas", patrones: ["bombilla"] },
  { nombre: "Materas", slug: "materas", patrones: ["matera"] },
  { nombre: "Termos", slug: "termos", patrones: ["termo"] },
  { nombre: "Yerberas", slug: "yerberas", patrones: ["yerbera"] },
  { nombre: "Azucareras", slug: "azucareras", patrones: ["azucarera"] },
  { nombre: "Cuchillos", slug: "cuchillos", patrones: ["cuchillo", "cuchilla"] },
  { nombre: "Tablas", slug: "tablas", patrones: ["tabla"] },
  { nombre: "Sets y juegos", slug: "sets-juegos", patrones: ["juego", "set ", "kit", "combo"] },
  { nombre: "Virolas", slug: "virolas", patrones: ["virola"] },
  { nombre: "Llaveros", slug: "llaveros", patrones: ["llavero"] },
  { nombre: "Mates", slug: "mates", patrones: ["mate"] },
];

export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Sin autorización" }, { status: 401 });
  const resultado: Record<string, number> = {};
  const errores: string[] = [];
  let categoriasOk = 0;

  for (const r of RUBROS) {
    try {
      // Asegura la categoría (idempotente por slug). createdAt por si la tabla no tiene default.
      await (prisma as any).$executeRawUnsafe(
        `INSERT INTO categories (id, name, slug, active, "createdAt")
         VALUES (gen_random_uuid()::text, $1, $2, true, now())
         ON CONFLICT (slug) DO NOTHING`, r.nombre, r.slug
      );
      const cat: any[] = await (prisma as any).$queryRawUnsafe(`SELECT id FROM categories WHERE slug = $1`, r.slug);
      const catId = cat[0]?.id;
      if (!catId) { errores.push(`${r.nombre}: no se pudo crear/ubicar la categoría`); continue; }
      categoriasOk++;

      const like = r.patrones.map((_, i) => `"name" ILIKE $${i + 2}`).join(" OR ");
      const args = [catId, ...r.patrones.map(p => `%${p}%`)];
      const upd: any = await (prisma as any).$executeRawUnsafe(
        `UPDATE products SET "categoryId" = $1 WHERE "categoryId" IS NULL AND (${like})`, ...args
      );
      resultado[r.nombre] = Number(upd ?? 0);
    } catch (e: any) {
      errores.push(`${r.nombre}: ${e?.message ?? "error"}`);
    }
  }

  return NextResponse.json({ ok: errores.length === 0, resultado, categoriasOk, errores });
}
