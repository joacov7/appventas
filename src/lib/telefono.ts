// Normalización de teléfonos argentinos a una forma canónica E.164 (+54XXXXXXXXXX).
// El objetivo es doble: (1) tener un formato consistente para mostrar/contactar,
// y (2) una CLAVE estable para deduplicar (dos formatos del mismo número matchean).
//
// Argentina es un lío: 0 troncal, 15 de móvil, 9 internacional, +54, espacios,
// guiones. Reducimos todo a "área + número" (10 dígitos) y anteponemos +54.

export function normalizarTelefonoAR(raw?: string | null): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, "");
  if (!d) return null;

  // Prefijo internacional
  if (d.startsWith("0054")) d = d.slice(4);
  else if (d.startsWith("54")) d = d.slice(2);

  // "9" de móvil en formato internacional (54 9 ...)
  if (d.length > 10 && d.startsWith("9")) d = d.slice(1);

  // "0" troncal nacional
  if (d.startsWith("0")) d = d.slice(1);

  // Número demasiado corto → no es un teléfono válido
  if (d.length < 8) return null;

  // Nos quedamos con los últimos 10 dígitos (área + abonado). Si el número trae
  // "15" incrustado y queda en 11, recortar a 10 igual da una clave estable.
  const key = d.slice(-10);
  if (key.length < 8) return null;

  return `+54${key}`;
}

// Clave canónica (solo dígitos, sin +54) para comparar/deduplicar.
export function claveTelefono(raw?: string | null): string | null {
  const n = normalizarTelefonoAR(raw);
  return n ? n.replace(/\D/g, "") : null;
}
