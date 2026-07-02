import { cookies } from "next/headers";
import { verifyAdminToken } from "./admin-token";

export async function isAdmin(): Promise<boolean> {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return false;
  const store = await cookies();
  const token = store.get("admin-token")?.value;
  return verifyAdminToken(token, adminSecret);
}

export async function adminAuthError(): Promise<string | null> {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return "ADMIN_SECRET no configurado";
  const store = await cookies();
  const token = store.get("admin-token")?.value;
  if (!token) return "Sesión no iniciada";
  if (!(await verifyAdminToken(token, adminSecret))) return "Sesión inválida o vencida — volvé a iniciar sesión";
  return null;
}
