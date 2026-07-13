import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";

// Busca un prospecto por nombre (parcial, sin distinguir mayúsculas). Devuelve
// el mejor candidato con teléfono, para que el Jefe de Gabinete lo contacte.
export async function buscarProspectoPorNombre(nombre: string): Promise<{ id: number; nombre: string; telefono: string | null; email: string | null } | null> {
  const q = nombre.trim();
  if (!q) return null;
  try {
    await ensureSchema("captacion");
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT id, nombre, telefono, email FROM prospectos
       WHERE nombre ILIKE $1 ORDER BY (telefono IS NOT NULL) DESC, creado_en DESC LIMIT 1`,
      `%${q}%`
    );
    return rows[0] ?? null;
  } catch { return null; }
}

// Alta manual de un prospecto (usada desde el panel y desde el Jefe de Gabinete).
export async function agregarProspecto(p: {
  nombre: string; telefono?: string; email?: string; rubro?: string; provincia?: string; notas?: string;
}): Promise<{ id: number; nombre: string } | null> {
  if (!p.nombre?.trim()) return null;
  try {
    await ensureSchema("captacion");
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `INSERT INTO prospectos (nombre, telefono, email, rubro, provincia, notas, osm_id, estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'nuevo') RETURNING id, nombre`,
      p.nombre.trim(), p.telefono?.trim() || null, p.email?.trim() || null,
      p.rubro?.trim() || null, p.provincia?.trim() || null, p.notas?.trim() || null, `manual/${Date.now()}`
    );
    return rows[0] ?? null;
  } catch { return null; }
}

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

// ─── Historial de interacciones ───────────────────────────────────────────────
// Registro de cada toque con el prospecto: mensajes, cambios de estado, notas.
// tipo: contacto | seguimiento | estado | abordaje | nota · canal: whatsapp | email | telefono | otro

export interface Interaccion {
  id: number;
  tipo: string;
  canal: string | null;
  detalle: string | null;
  creado_en: string;
}

export async function registrarInteraccion(
  prospectoId: number,
  i: { tipo: string; canal?: string; detalle?: string }
): Promise<void> {
  try {
    await ensureSchema("captacion");
    await (prisma as any).$executeRawUnsafe(
      `INSERT INTO prospecto_interacciones (prospecto_id, tipo, canal, detalle) VALUES ($1,$2,$3,$4)`,
      prospectoId, i.tipo, i.canal ?? null, (i.detalle ?? "").slice(0, 600) || null
    );
  } catch { /* el historial nunca debe romper la acción principal */ }
}

export async function listarInteracciones(prospectoId: number, limit = 50): Promise<Interaccion[]> {
  try {
    await ensureSchema("captacion");
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT id, tipo, canal, detalle, creado_en FROM prospecto_interacciones
       WHERE prospecto_id = $1 ORDER BY creado_en DESC LIMIT ${Math.min(limit, 200)}`,
      prospectoId
    );
    return rows.map(r => ({ ...r, id: Number(r.id) }));
  } catch { return []; }
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
