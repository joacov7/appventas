import { cookies } from "next/headers";
import { verificarSesion } from "./admin-token";

export const CLIENTE_COOKIE = "cliente-token";

// Sesión del cliente mayorista (portal). Reusa el firmador de tokens, con
// rol "cliente" y sub = email. Cookie separada de la del panel admin.
export interface SesionCliente { email: string; }

export async function getClienteSesion(): Promise<SesionCliente | null> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return null;
  const store = await cookies();
  const token = store.get(CLIENTE_COOKIE)?.value;
  const s = await verificarSesion(token, secret);
  if (!s || s.rol !== "cliente") return null;
  return { email: s.sub };
}
