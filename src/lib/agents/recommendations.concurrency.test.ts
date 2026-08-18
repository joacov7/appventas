import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { createOrMerge, ESTADOS_VIVOS } from "./recommendations";

// Este test toca PostgreSQL real. Se salta si no hay DATABASE_URL (sandbox/CI
// sin base). Usa un tenant aislado y claramente identificable, que se limpia al
// final: NO toca datos de negocio.
const HAY_DB = !!process.env.DATABASE_URL;
const TENANT = `test-concurrency-${Date.now()}`;

async function contarVivas(dedupKey: string): Promise<number> {
  const vivos = ESTADOS_VIVOS.map(e => `'${e}'`).join(",");
  const r: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT COUNT(*)::int AS n FROM recommendations
      WHERE tenant_id = $1 AND dedup_key = $2 AND estado IN (${vivos})`, TENANT, dedupKey);
  return r[0]?.n ?? 0;
}
async function contarFuentes(dedupKey: string): Promise<number> {
  const r: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT COUNT(*)::int AS n FROM recommendation_sources s
       JOIN recommendations r ON r.id = s.recommendation_id
      WHERE r.tenant_id = $1 AND r.dedup_key = $2`, TENANT, dedupKey);
  return r[0]?.n ?? 0;
}

describe.skipIf(!HAY_DB)("createOrMerge — concurrencia / ON CONFLICT", () => {
  afterAll(async () => {
    await (prisma as any).$executeRawUnsafe(
      `DELETE FROM recommendation_sources WHERE recommendation_id IN
         (SELECT id FROM recommendations WHERE tenant_id = $1)`, TENANT).catch(() => {});
    await (prisma as any).$executeRawUnsafe(
      `DELETE FROM recommendations WHERE tenant_id = $1`, TENANT).catch(() => {});
  });

  it("10 llamadas simultáneas con la misma dedup_key → 1 sola recomendación viva y 10 fuentes", async () => {
    const key = `precio_alto:producto:CONC-${Date.now()}`;
    const N = 10;
    const results = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        createOrMerge({
          tenantId: TENANT, agentId: `agente_${i}`, tipo: "precio_alto",
          titulo: "Producto fuera de posición", entityType: "producto", entityId: "CONC",
          dedupKey: key, severidad: i === 3 ? "critica" : "oportunidad",
          origenConfianza: "calculo",
        })
      )
    );
    // Exactamente una fue INSERT (merged=false); el resto merges.
    const inserts = results.filter(r => !r.merged).length;
    expect(inserts).toBe(1);
    expect(await contarVivas(key)).toBe(1);        // sin duplicados
    expect(await contarFuentes(key)).toBe(N);      // no se perdió ninguna
    // La severidad crítica de una de las fuentes debe haber ganado en el merge.
    const fila: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT severidad FROM recommendations WHERE tenant_id = $1 AND dedup_key = $2 LIMIT 1`,
      TENANT, key);
    expect(fila[0].severidad).toBe("critica");
  });

  it("re-ejecución secuencial no crea una segunda recomendación activa", async () => {
    const key = `stock_bajo:producto:SEQ-${Date.now()}`;
    const a = await createOrMerge({
      tenantId: TENANT, agentId: "compras", tipo: "stock_bajo", titulo: "Reponer",
      entityType: "producto", entityId: "SEQ", dedupKey: key, origenConfianza: "deterministico",
    });
    const b = await createOrMerge({
      tenantId: TENANT, agentId: "ceo", tipo: "stock_bajo", titulo: "Reponer",
      entityType: "producto", entityId: "SEQ", dedupKey: key, origenConfianza: "deterministico",
    });
    expect(a.merged).toBe(false);
    expect(b.merged).toBe(true);
    expect(a.recommendation.id).toBe(b.recommendation.id); // misma fila
    expect(await contarVivas(key)).toBe(1);
    expect(await contarFuentes(key)).toBe(2);
  });
});
