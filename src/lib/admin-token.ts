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

export async function signAdminToken(secret: string): Promise<string> {
  const expires = Date.now() + TOKEN_TTL_MS;
  const sig = await hmacHex(secret, `admin:${expires}`);
  return `${expires}.${sig}`;
}

export async function verifyAdminToken(token: string | undefined, secret: string | undefined): Promise<boolean> {
  if (!token || !secret) return false;
  const dot = token.indexOf(".");
  if (dot === -1) return false;
  const expiresStr = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || Date.now() > expires) return false;
  const expected = await hmacHex(secret, `admin:${expiresStr}`);
  return timingSafeEqualHex(sig, expected);
}
