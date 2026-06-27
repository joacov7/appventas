import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number | string, currency = "ARS"): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

// Cuotas sin interés — configurable vía env var NEXT_PUBLIC_CUOTAS (default 6)
export function formatCuotas(price: number): { cuotas: number; valorCuota: string } | null {
  const cuotas = Number(process.env.NEXT_PUBLIC_CUOTAS ?? 6);
  if (!cuotas || cuotas < 2) return null;
  return { cuotas, valorCuota: formatPrice(price / cuotas) };
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}
