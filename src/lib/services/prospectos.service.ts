import { prisma } from "@/lib/prisma";

export interface ProspectoResumen {
  id: number;
  nombre: string;
  rubro: string | null;
  provincia: string | null;
  telefono: string | null;
  instagram: string | null;
  estado: string;
}

// Lista prospectos guardados con filtros (para que un agente comercial trabaje la cartera).
export async function buscarProspectos(opts: {
  estado?: string; rubro?: string; conTelefono?: boolean; limit?: number;
} = {}): Promise<ProspectoResumen[]> {
  const { estado, rubro, conTelefono, limit = 30 } = opts;
  const cond: string[] = [];
  const args: any[] = [];
  let i = 1;
  if (estado)      { cond.push(`estado = $${i++}`); args.push(estado); }
  if (rubro)       { cond.push(`rubro = $${i++}`); args.push(rubro); }
  if (conTelefono) { cond.push(`telefono IS NOT NULL AND telefono <> ''`); }
  const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";
  args.push(limit);

  try {
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT id, nombre, rubro, provincia, telefono, instagram, estado
       FROM prospectos ${where} ORDER BY creado_en DESC LIMIT $${i}`, ...args
    );
    return rows;
  } catch {
    return [];
  }
}

export async function contarProspectosPorEstado(): Promise<Record<string, number>> {
  try {
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT estado, COUNT(*)::int AS n FROM prospectos GROUP BY estado`
    );
    return Object.fromEntries(rows.map(r => [r.estado, r.n]));
  } catch {
    return {};
  }
}
