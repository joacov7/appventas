import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";

// ─── Seguimiento comercial ────────────────────────────────────────────────────
// Detecta (determinísticamente) a quién conviene re-contactar: prospectos
// contactados sin respuesta y presupuestos enviados sin cerrar. La IA, si se
// usa, solo redacta el recordatorio.

export interface SeguimientoProspecto {
  tipo: "prospecto";
  id: number;
  nombre: string;
  rubro: string | null;
  telefono: string | null;
  dias: number;                 // días desde el contacto
  mensaje_sugerido: string;
}

export interface SeguimientoPresupuesto {
  tipo: "presupuesto";
  id: number;
  cliente: string;
  total: number;
  dias: number;                 // días desde el envío
  mensaje_sugerido: string;
}

export type Seguimiento = SeguimientoProspecto | SeguimientoPresupuesto;

const money = (n: number) => "$" + Math.round(Number(n)).toLocaleString("es-AR");

// Prospectos "contactado" hace >= diasMin, que no se siguieron recientemente.
export async function prospectosParaSeguir(diasMin = 5): Promise<SeguimientoProspecto[]> {
  await ensureSchema("captacion");
  let rows: any[] = [];
  try {
    rows = await (prisma as any).$queryRawUnsafe(`
      SELECT id, nombre, rubro, telefono, contactado_en,
             EXTRACT(DAY FROM now() - contactado_en)::int AS dias
      FROM prospectos
      WHERE estado = 'contactado'
        AND contactado_en IS NOT NULL
        AND contactado_en <= now() - ($1 || ' days')::interval
        AND (ultimo_seguimiento_en IS NULL OR ultimo_seguimiento_en <= now() - ($1 || ' days')::interval)
      ORDER BY contactado_en ASC
      LIMIT 30
    `, String(diasMin));
  } catch { return []; }

  return rows.map(r => ({
    tipo: "prospecto" as const,
    id: Number(r.id), nombre: r.nombre, rubro: r.rubro, telefono: r.telefono,
    dias: Number(r.dias),
    mensaje_sugerido: `¡Hola! 👋 Te escribí hace unos días desde nuestra tienda de mates y artículos personalizados. ¿Lo pudiste ver? Cualquier duda quedo a disposición. ¡Gracias!`,
  }));
}

// Presupuestos "enviado" hace >= diasMin sin cerrar (aceptado/rechazado).
export async function presupuestosParaSeguir(diasMin = 4): Promise<SeguimientoPresupuesto[]> {
  await ensureSchema("cotizador");
  let rows: any[] = [];
  try {
    rows = await (prisma as any).$queryRawUnsafe(`
      SELECT id, cliente_nombre, cliente_empresa, total::float,
             EXTRACT(DAY FROM now() - actualizado_en)::int AS dias
      FROM presupuestos
      WHERE estado = 'enviado'
        AND actualizado_en <= now() - ($1 || ' days')::interval
      ORDER BY actualizado_en ASC
      LIMIT 30
    `, String(diasMin));
  } catch { return []; }

  return rows.map(r => {
    const cliente = r.cliente_empresa || r.cliente_nombre || "el cliente";
    return {
      tipo: "presupuesto" as const,
      id: Number(r.id), cliente, total: Number(r.total), dias: Number(r.dias),
      mensaje_sugerido: `¡Hola! 👋 Te paso para saber si pudiste ver el presupuesto que te envié (total ${money(Number(r.total))}). Si necesitás ajustar algo o tenés alguna duda, decime. ¡Gracias!`,
    };
  });
}

// Todo lo que necesita seguimiento, junto.
export async function seguimientosPendientes(): Promise<Seguimiento[]> {
  const [prospectos, presupuestos] = await Promise.all([
    prospectosParaSeguir(),
    presupuestosParaSeguir(),
  ]);
  return [...prospectos, ...presupuestos].sort((a, b) => b.dias - a.dias);
}

// Marca que ya se siguió a un prospecto (para no repetir el recordatorio).
export async function marcarSeguido(prospectoId: number): Promise<void> {
  await ensureSchema("captacion");
  await (prisma as any).$executeRawUnsafe(
    `UPDATE prospectos SET ultimo_seguimiento_en = now() WHERE id = $1`, prospectoId
  ).catch(() => {});
}
