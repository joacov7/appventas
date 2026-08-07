import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { hashPassword } from "@/lib/password";

// ─── Usuarios del panel (multiusuario + roles) ───────────────────────────────
// Roles soportados hoy: "admin" (total) y "deposito" (solo la sección Depósito).
// El admin por variables de entorno sigue existiendo como súper-admin aparte.

export const ROLES = ["admin", "deposito"] as const;
export type Rol = (typeof ROLES)[number];

export const ROL_LABEL: Record<string, string> = {
  admin: "Administrador",
  deposito: "Depósito",
};

export interface Usuario {
  id: number;
  email: string;
  nombre: string | null;
  rol: string;
  activo: boolean;
  created_at: string;
}

export async function listarUsuarios(): Promise<Usuario[]> {
  await ensureSchema("usuarios");
  const rows: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT id, email, nombre, rol, activo, created_at FROM usuarios_panel ORDER BY created_at DESC`);
  return rows.map(r => ({
    id: Number(r.id), email: r.email, nombre: r.nombre ?? null,
    rol: r.rol, activo: !!r.activo, created_at: r.created_at,
  }));
}

// Para el login: trae el hash. No exponer por API.
export async function buscarPorEmail(email: string): Promise<{ id: number; email: string; nombre: string | null; rol: string; activo: boolean; password_hash: string } | null> {
  await ensureSchema("usuarios");
  const rows: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT id, email, nombre, rol, activo, password_hash FROM usuarios_panel WHERE lower(email) = lower($1) LIMIT 1`, email);
  const r = rows[0];
  if (!r) return null;
  return { id: Number(r.id), email: r.email, nombre: r.nombre ?? null, rol: r.rol, activo: !!r.activo, password_hash: r.password_hash };
}

export async function crearUsuario(input: { email: string; nombre?: string; password: string; rol: string }): Promise<{ ok: boolean; error?: string }> {
  await ensureSchema("usuarios");
  const email = String(input.email ?? "").trim().toLowerCase();
  const password = String(input.password ?? "");
  const rol = ROLES.includes(input.rol as Rol) ? input.rol : "deposito";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Email inválido" };
  if (password.length < 6) return { ok: false, error: "La contraseña debe tener al menos 6 caracteres" };

  const existe: any[] = await (prisma as any).$queryRawUnsafe(
    `SELECT 1 FROM usuarios_panel WHERE lower(email) = $1 LIMIT 1`, email);
  if (existe.length) return { ok: false, error: "Ya existe un usuario con ese email" };

  const hash = await hashPassword(password);
  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO usuarios_panel (email, nombre, password_hash, rol) VALUES ($1, $2, $3, $4)`,
    email, input.nombre?.trim() || null, hash, rol);
  return { ok: true };
}

export async function actualizarUsuario(id: number, input: { nombre?: string; rol?: string; activo?: boolean; password?: string }): Promise<{ ok: boolean; error?: string }> {
  await ensureSchema("usuarios");
  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  if (input.nombre !== undefined) { sets.push(`nombre = $${i++}`); vals.push(input.nombre?.trim() || null); }
  if (input.rol !== undefined) {
    if (!ROLES.includes(input.rol as Rol)) return { ok: false, error: "Rol inválido" };
    sets.push(`rol = $${i++}`); vals.push(input.rol);
  }
  if (input.activo !== undefined) { sets.push(`activo = $${i++}`); vals.push(!!input.activo); }
  if (input.password !== undefined && input.password !== "") {
    if (String(input.password).length < 6) return { ok: false, error: "La contraseña debe tener al menos 6 caracteres" };
    sets.push(`password_hash = $${i++}`); vals.push(await hashPassword(String(input.password)));
  }
  if (!sets.length) return { ok: true };
  vals.push(id);
  await (prisma as any).$executeRawUnsafe(
    `UPDATE usuarios_panel SET ${sets.join(", ")} WHERE id = $${i}`, ...vals);
  return { ok: true };
}

export async function eliminarUsuario(id: number): Promise<void> {
  await ensureSchema("usuarios");
  await (prisma as any).$executeRawUnsafe(`DELETE FROM usuarios_panel WHERE id = $1`, id);
}
