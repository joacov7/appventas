import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";

// ─── Scoring A/B/C de prospectos ──────────────────────────────────────────────
// Convierte la base en una lista de trabajo: A = atacar ya (rubro afín y
// contactable), B = vale la pena, C = baja prioridad. Determinístico y barato
// (sin IA): se recalcula entero en segundos y se persiste (puntos + letra).

// Rubros que REVENDEN mates/regionales (mejor prospecto para mayorista).
const RUBRO_AFIN = /regal|gift|bazar|variety|tabac|tobacco|kiosc|convenien|almac|artesan|craft|souvenir|hogar|housew|deco|regionale|mate|talabart|marroquin|cuchill|jugueter|libr|station/i;
// Rubros B2B de personalizados (empresas que regalan con logo).
const RUBRO_B2B = /empresa|oficina|company|office|industri|fabrica|works|agencia|advertis|seguro|insurance|inmobil|estate|cooperativ|silo|acopio|gobierno|government|municip|concesion|corporat/i;

export interface Puntuado {
  puntos: number;
  letra: "A" | "B" | "C";
}

// Regla de puntaje. Contactabilidad pesa más que rubro: sin teléfono no hay venta.
export function puntuarProspecto(p: {
  rubro?: string | null; nombre?: string | null; telefono?: string | null; email?: string | null;
  website?: string | null; instagram?: string | null; facebook?: string | null; estado?: string | null;
}): Puntuado {
  if (p.estado === "descartado") return { puntos: 0, letra: "C" };

  let puntos = 0;
  const texto = `${p.rubro ?? ""} ${p.nombre ?? ""}`;
  if (RUBRO_AFIN.test(texto)) puntos += 30;
  else if (RUBRO_B2B.test(texto)) puntos += 22;
  else if (p.rubro) puntos += 10; // rubro conocido pero no afín

  if (p.telefono) puntos += 30;
  if (p.email) puntos += 10;
  if (p.website) puntos += 6;
  if (p.instagram || p.facebook) puntos += 6;

  if (p.estado === "interesado") puntos += 30;
  else if (p.estado === "contactado") puntos += 5;

  const letra: "A" | "B" | "C" = puntos >= 60 ? "A" : puntos >= 35 ? "B" : "C";
  return { puntos, letra };
}

// Recalcula y persiste el puntaje de TODA la base, en tandas (apto 10k+).
export async function puntuarTodos(): Promise<{ total: number; A: number; B: number; C: number }> {
  await ensureSchema("captacion");
  const filas: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT id, nombre, rubro, telefono, email, website, instagram, facebook, estado FROM prospectos`
  );

  const conteo = { A: 0, B: 0, C: 0 };
  const pares = filas.map(f => {
    const { puntos, letra } = puntuarProspecto(f);
    conteo[letra]++;
    return { id: Number(f.id), puntos, letra };
  });

  const CHUNK = 300;
  for (let i = 0; i < pares.length; i += CHUNK) {
    const lote = pares.slice(i, i + CHUNK);
    const values: string[] = [];
    const params: any[] = [];
    let j = 1;
    for (const p of lote) {
      values.push(`($${j++}::int, $${j++}::int, $${j++}::text)`);
      params.push(p.id, p.puntos, p.letra);
    }
    await (prisma as any).$executeRawUnsafe(
      `UPDATE prospectos AS p SET puntos = v.puntos, puntaje = v.letra
       FROM (VALUES ${values.join(",")}) AS v(id, puntos, letra)
       WHERE p.id = v.id`,
      ...params
    );
  }

  return { total: pares.length, ...conteo };
}
