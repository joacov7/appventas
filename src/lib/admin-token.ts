// Token de sesión admin firmado (HMAC-SHA256) con expiración.
// Formato: "<expiraEpochMs>.<firmaHex>". Usa Web Crypto para funcionar
// tanto en Node (route handlers) como en Edge (middleware).

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 días

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface Sesion {
  sub: string; // identidad: email del usuario, o "admin" para el súper-admin por variables
  rol: string; // "admin" | "deposito" | ...
}

// Token de sesión nuevo (lleva sujeto + rol). Formato: "<sub>~<rol>~<expira>.<firma>".
// La firma es hex (sin puntos), por eso parseamos por el ÚLTIMO punto.
export async function signSessionToken(secret: string, sub: string, rol: string): Promise<string> {
  const expires = Date.now() + TOKEN_TTL_MS;
  const payload = `${sub}~${rol}~${expires}`;
  const sig = await hmacHex(secret, payload);
  return `${payload}.${sig}`;
}

// Compat: el admin por variables sigue teniendo un helper propio (rol admin).
export async function signAdminToken(secret: string): Promise<string> {
  return signSessionToken(secret, "admin", "admin");
}

// Verifica y devuelve la sesión (o null). Soporta el formato viejo
// ("<expira>.<firma>" firmado sobre "admin:<expira>") como sesión de admin.
export async function verificarSesion(token: string | undefined, secret: string | undefined): Promise<Sesion | null> {
  if (!token || !secret) return null;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  if (payload.includes("~")) {
    const parts = payload.split("~");
    if (parts.length !== 3) return null;
    const [sub, rol, expiresStr] = parts;
    const expires = Number(expiresStr);
    if (!Number.isFinite(expires) || Date.now() > expires) return null;
    const expected = await hmacHex(secret, payload);
    if (!timingSafeEqualHex(sig, expected)) return null;
    return { sub, rol };
  }

  // Formato viejo (admin por variables ya logueado).
  const expires = Number(payload);
  if (!Number.isFinite(expires) || Date.now() > expires) return null;
  const expected = await hmacHex(secret, `admin:${payload}`);
  if (!timingSafeEqualHex(sig, expected)) return null;
  return { sub: "admin", rol: "admin" };
}

// Compat: sigue devolviendo boolean (token válido = hay sesión).
export async function verifyAdminToken(token: string | undefined, secret: string | undefined): Promise<boolean> {
  return (await verificarSesion(token, secret)) !== null;
}
