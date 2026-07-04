import { prisma } from "@/lib/prisma";
import type { MemoryEntry, RememberInput, RecallInput } from "./types";

const TENANT_DEFAULT = "default";
let tablaLista = false;

async function ensureTable() {
  if (tablaLista) return;
  await (prisma as any).$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS memory_entries (
      id          BIGSERIAL PRIMARY KEY,
      tenant_id   TEXT NOT NULL DEFAULT 'default',
      namespace   TEXT NOT NULL,
      kind        TEXT,
      mkey        TEXT NOT NULL,
      value       JSONB NOT NULL,
      tags        TEXT[] DEFAULT '{}',
      source      TEXT,
      confidence  REAL DEFAULT 0.5,
      hits        INT DEFAULT 0,
      created_at  TIMESTAMPTZ DEFAULT now(),
      updated_at  TIMESTAMPTZ DEFAULT now(),
      UNIQUE (tenant_id, namespace, mkey)
    )
  `);
  await (prisma as any).$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS idx_memory_ns ON memory_entries (tenant_id, namespace)`
  ).catch(() => {});
  tablaLista = true;
}

function mapRow(r: any): MemoryEntry {
  return {
    id: Number(r.id), tenant_id: r.tenant_id, namespace: r.namespace, kind: r.kind,
    key: r.mkey, value: r.value, tags: r.tags ?? [], source: r.source,
    confidence: Number(r.confidence), hits: r.hits,
    created_at: r.created_at, updated_at: r.updated_at,
  };
}

// Guarda o actualiza una entrada (upsert por tenant+namespace+key).
export async function remember(input: RememberInput): Promise<MemoryEntry> {
  await ensureTable();
  const tenant = input.tenantId ?? TENANT_DEFAULT;
  const rows: any[] = await (prisma as any).$queryRawUnsafe(`
    INSERT INTO memory_entries (tenant_id, namespace, kind, mkey, value, tags, source, confidence)
    VALUES ($1,$2,$3,$4,$5::jsonb,$6::text[],$7,$8)
    ON CONFLICT (tenant_id, namespace, mkey) DO UPDATE SET
      value = EXCLUDED.value,
      kind = COALESCE(EXCLUDED.kind, memory_entries.kind),
      tags = EXCLUDED.tags,
      source = COALESCE(EXCLUDED.source, memory_entries.source),
      confidence = GREATEST(memory_entries.confidence, EXCLUDED.confidence),
      updated_at = now()
    RETURNING *
  `, tenant, input.namespace, input.kind ?? null, input.key,
     JSON.stringify(input.value), input.tags ?? [], input.source ?? null,
     input.confidence ?? 0.5);
  return mapRow(rows[0]);
}

// Recupera entradas por namespace + filtros (key exacta, kind, tags, texto libre).
export async function recall(input: RecallInput): Promise<MemoryEntry[]> {
  await ensureTable();
  const tenant = input.tenantId ?? TENANT_DEFAULT;
  const cond: string[] = ["tenant_id = $1", "namespace = $2"];
  const args: any[] = [tenant, input.namespace];
  let i = 3;
  if (input.key)   { cond.push(`mkey = $${i++}`); args.push(input.key); }
  if (input.kind)  { cond.push(`kind = $${i++}`); args.push(input.kind); }
  if (input.tags?.length) { cond.push(`tags && $${i++}::text[]`); args.push(input.tags); }
  if (input.query) { cond.push(`value::text ILIKE $${i++}`); args.push(`%${input.query}%`); }
  args.push(input.limit ?? 20);

  try {
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT * FROM memory_entries WHERE ${cond.join(" AND ")}
       ORDER BY confidence DESC, hits DESC, updated_at DESC LIMIT $${i}`, ...args
    );
    return rows.map(mapRow);
  } catch {
    return [];
  }
}

// Refuerza una entrada usada con éxito (sube hits y confianza).
export async function reinforce(id: number): Promise<void> {
  await ensureTable();
  await (prisma as any).$executeRawUnsafe(
    `UPDATE memory_entries SET hits = hits + 1,
       confidence = LEAST(1.0, confidence + 0.05), updated_at = now() WHERE id = $1`, id
  ).catch(() => {});
}

export async function forget(id: number): Promise<void> {
  await ensureTable();
  await (prisma as any).$executeRawUnsafe(`DELETE FROM memory_entries WHERE id = $1`, id).catch(() => {});
}

// Estadísticas por namespace (para el Centro de Memoria).
export async function stats(tenantId = TENANT_DEFAULT): Promise<{ namespace: string; total: number }[]> {
  await ensureTable();
  try {
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT namespace, COUNT(*)::int AS total FROM memory_entries WHERE tenant_id = $1 GROUP BY namespace ORDER BY total DESC`,
      tenantId
    );
    return rows;
  } catch {
    return [];
  }
}
