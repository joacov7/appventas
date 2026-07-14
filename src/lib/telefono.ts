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

// ¿Es PROBABLEMENTE una línea fija (sin WhatsApp)? Heurística: los celulares
// argentinos traen el marcador de móvil (9 internacional o 15 nacional). Si no
// tiene ninguno, es muy probable que sea fija. No es 100% (algunos datos vienen
// sin el marcador), por eso es "probable", no definitivo.
export function esProbableFijo(raw?: string | null): boolean {
  if (!raw) return false;
  let d = String(raw).replace(/\D/g, "");
  if (d.length < 8) return false; // muy corto: no arriesgamos
  if (d.startsWith("00")) d = d.slice(2);
  // Internacional móvil: 54 9 ...
  if (d.startsWith("549")) return false;
  // Nacional: quitamos 54 o el 0 troncal y buscamos el "15" de móvil tras el área.
  const nac = d.startsWith("54") ? d.slice(2) : d.replace(/^0/, "");
  if (/^\d{2,4}15\d{6,8}$/.test(nac)) return false;
  return true; // sin marcador de móvil → probable línea fija
}
