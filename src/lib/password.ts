// Hash de contraseñas con PBKDF2-SHA256 (Web Crypto, sin dependencias).
// Formato guardado: "<saltHex>.<hashHex>". Funciona en Node y Edge.

const ITERACIONES = 100_000;
const LARGO_HASH = 32; // bytes

function toHex(buf: ArrayBuffer | Uint8Array): string {
  const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return arr;
}

async function pbkdf2(plain: string, salt: Uint8Array): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(plain), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations: ITERACIONES, hash: "SHA-256" },
    key, LARGO_HASH * 8
  );
  return new Uint8Array(bits);
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(plain, salt);
  return `${toHex(salt)}.${toHex(hash)}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const dot = stored.indexOf(".");
  if (dot === -1) return false;
  const salt = fromHex(stored.slice(0, dot));
  const esperado = stored.slice(dot + 1);
  const hash = toHex(await pbkdf2(plain, salt));
  // Comparación de tiempo constante.
  if (hash.length !== esperado.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ esperado.charCodeAt(i);
  return diff === 0;
}
