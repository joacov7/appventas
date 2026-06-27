import { cookies } from "next/headers";

export async function isAdmin(): Promise<boolean> {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return false;
  const store = await cookies();
  const token = store.get("admin-token")?.value;
  return token === adminSecret;
}

export async function adminAuthError(): Promise<string | null> {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return "ADMIN_SECRET no configurado";
  const store = await cookies();
  const token = store.get("admin-token")?.value;
  if (!token) return "Sesión no iniciada";
  if (token !== adminSecret) return "Sesión inválida — volvé a iniciar sesión";
  return null;
}
