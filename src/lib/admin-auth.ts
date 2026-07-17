import { cookies } from "next/headers";
import { verificarSesion, type Sesion } from "./admin-token";

// Devuelve la sesión actual (sujeto + rol) o null.
export async function getSesion(): Promise<Sesion | null> {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return null;
  const store = await cookies();
  const token = store.get("admin-token")?.value;
  return verificarSesion(token, adminSecret);
}

// Hay sesión válida (cualquier rol).
export async function isAuth(): Promise<boolean> {
  return (await getSesion()) !== null;
}

// Es admin (acceso total).
export async function isAdmin(): Promise<boolean> {
  const s = await getSesion();
  return s?.rol === "admin";
}

// Tiene alguno de los roles indicados.
export async function tieneRol(...roles: string[]): Promise<boolean> {
  const s = await getSesion();
  return !!s && roles.includes(s.rol);
}

export async function adminAuthError(): Promise<string | null> {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return "ADMIN_SECRET no configurado";
  const store = await cookies();
  const token = store.get("admin-token")?.value;
  if (!token) return "Sesión no iniciada";
  if (!(await verificarSesion(token, adminSecret))) return "Sesión inválida o vencida — volvé a iniciar sesión";
  return null;
}
