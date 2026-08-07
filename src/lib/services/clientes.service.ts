import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { hashPassword } from "@/lib/password";

// ─── Clientes mayoristas (portal de autogestión) ─────────────────────────────
// Se registran solos y quedan pendientes hasta que el admin los aprueba.

export interface ClienteMayorista {
  id: number;
  email: string;
  nombre: string | null;
  empresa: string | null;
  telefono: string | null;
  aprobado: boolean;
  activo: boolean;
  created_at: string;
}

export async function listarClientes(): Promise<ClienteMayorista[]> {
  await ensureSchema("clientes");
  const rows: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT id, email, nombre, empresa, telefono, aprobado, activo, created_at
     FROM clientes_mayoristas ORDER BY aprobado ASC, created_at DESC`);
  return rows.map(mapCliente);
}

function mapCliente(r: any): ClienteMayorista {
  return {
    id: Number(r.id), email: r.email, nombre: r.nombre ?? null, empresa: r.empresa ?? null,
    telefono: r.telefono ?? null, aprobado: !!r.aprobado, activo: !!r.activo, created_at: r.created_at,
  };
}

// Para el login: incluye el hash. No exponer por API.
export async function buscarClientePorEmail(email: string): Promise<(ClienteMayorista & { password_hash: string }) | null> {
  await ensureSchema("clientes");
  const rows: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT * FROM clientes_mayoristas WHERE lower(email) = lower($1) LIMIT 1`, email);
  const r = rows[0];
  if (!r) return null;
  return { ...mapCliente(r), password_hash: r.password_hash };
}

export async function registrarCliente(input: { email: string; password: string; nombre?: string; empresa?: string; telefono?: string }): Promise<{ ok: boolean; error?: string }> {
  await ensureSchema("clientes");
  const email = String(input.email ?? "").trim().toLowerCase();
  const password = String(input.password ?? "");
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Email inválido" };
  if (password.length < 6) return { ok: false, error: "La contraseña debe tener al menos 6 caracteres" };

  const existe: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT 1 FROM clientes_mayoristas WHERE lower(email) = $1 LIMIT 1`, email);
  if (existe.length) return { ok: false, error: "Ya existe una cuenta con ese email" };

  const hash = await hashPassword(password);
  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO clientes_mayoristas (email, password_hash, nombre, empresa, telefono) VALUES ($1, $2, $3, $4, $5)`,
    email, hash, input.nombre?.trim() || null, input.empresa?.trim() || null, input.telefono?.trim() || null);
  return { ok: true };
}

export async function actualizarCliente(id: number, cambios: { aprobado?: boolean; activo?: boolean; password?: string }): Promise<{ ok: boolean; error?: string }> {
  await ensureSchema("clientes");
  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  if (cambios.aprobado !== undefined) { sets.push(`aprobado = $${i++}`); vals.push(!!cambios.aprobado); }
  if (cambios.activo !== undefined) { sets.push(`activo = $${i++}`); vals.push(!!cambios.activo); }
  if (cambios.password !== undefined && cambios.password !== "") {
    if (String(cambios.password).length < 6) return { ok: false, error: "La contraseña debe tener al menos 6 caracteres" };
    sets.push(`password_hash = $${i++}`); vals.push(await hashPassword(String(cambios.password)));
  }
  if (!sets.length) return { ok: true };
  vals.push(id);
  await (prisma as any).$executeRawUnsafe(
    `UPDATE clientes_mayoristas SET ${sets.join(", ")} WHERE id = $${i}`, ...vals);
  return { ok: true };
}

export async function eliminarCliente(id: number): Promise<void> {
  await ensureSchema("clientes");
  await (prisma as any).$executeRawUnsafe(`DELETE FROM clientes_mayoristas WHERE id = $1`, id);
}
