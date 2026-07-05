import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";
import { buscarProductos } from "./productos.service";
import { MARGEN_PISO_PCT } from "./pricing.service";

// Recargos por medio de pago por defecto (se sobreescriben con pricing_config).
const MEDIOS_PAGO_DEFAULT: Record<string, number> = {
  efectivo: 0, transferencia: 0, debito: 1.5, credito1: 3.5,
  credito3: 8, credito6: 15, mercadoPago: 5.99, echeq: 2,
};

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface ProductoCotizable {
  id: string;
  nombre: string;
  precio: number | null;            // minorista (variante más barata)
  precio_mayorista: number | null;  // si está cargado
  costo: number | null;
  fabricante: string | null;
  descuento_b2b_pct: number;        // del fabricante (0 si no tiene)
}

export type Canal = "minorista" | "mayorista";

export interface ItemPresupuesto {
  productId: string;
  cantidad: number;
  precioUnitOverride?: number | null; // permite ajustar a mano
}

export interface EntradaPresupuesto {
  items: ItemPresupuesto[];
  canal: Canal;
  medioPago: string;             // clave de mediosPago (efectivo, transferencia, ...)
  descuentoGlobalPct?: number;   // descuento comercial extra sobre el total
}

export interface LineaPresupuesto {
  productId: string;
  nombre: string;
  cantidad: number;
  precio_base: number;          // según canal, antes de recargo/descuento
  precio_unitario: number;      // final por unidad (con recargo de medio de pago)
  subtotal: number;
  costo: number | null;
  margen_pct: number | null;
  bajo_piso: boolean;           // true si hubo que subir al margen piso
  aviso?: string;
}

export interface Presupuesto {
  lineas: LineaPresupuesto[];
  canal: Canal;
  medioPago: string;
  recargo_medio_pago_pct: number;
  subtotal: number;             // suma de líneas
  descuento_global_pct: number;
  descuento_global_monto: number;
  total: number;
  avisos: string[];
}

// ─── Carga de productos cotizables ────────────────────────────────────────────

// Lista productos con su precio/costo y la info de fabricante (para reglas B2B).
export async function productosParaCotizar(q?: string): Promise<ProductoCotizable[]> {
  const base = await buscarProductos({ q, limit: 100, soloActivos: true });
  if (base.length === 0) return [];

  await ensureSchema("fabricantes");
  const ids = base.map(p => p.id);
  let fabRows: any[] = [];
  try {
    fabRows = await (prisma as any).$queryRawUnsafe(
      `SELECT pf.product_id, pf.costo_proveedor, f.nombre AS fabricante, f.descuento_b2b_pct
       FROM producto_fabricante pf JOIN fabricantes f ON f.id = pf.fabricante_id
       WHERE pf.product_id = ANY($1::text[])`, ids
    );
  } catch { fabRows = []; }
  const fabByProd = new Map<string, any>(fabRows.map(r => [r.product_id, r]));

  return base.map(p => {
    const fab = fabByProd.get(p.id);
    return {
      id: p.id,
      nombre: p.nombre,
      precio: p.precio,
      precio_mayorista: p.precio_mayorista,
      // Preferimos el costo cargado en pricing; si no, el costo del proveedor.
      costo: p.costo ?? (fab?.costo_proveedor != null ? Number(fab.costo_proveedor) : null),
      fabricante: fab?.fabricante ?? null,
      descuento_b2b_pct: fab ? Number(fab.descuento_b2b_pct ?? 0) : 0,
    };
  });
}

// ─── Motor de cálculo determinístico ──────────────────────────────────────────

function redondear(n: number): number {
  return Math.round(n / 10) * 10;
}

async function getRecargoMedioPago(medioPago: string): Promise<number> {
  let cfg: any = MEDIOS_PAGO_DEFAULT;
  try {
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT config FROM catalog_config WHERE tipo = 'pricing_config'`
    );
    if (rows[0]?.config?.mediosPago) cfg = { ...cfg, ...rows[0].config.mediosPago };
  } catch { /* usa defaults */ }
  const r = Number(cfg[medioPago]);
  return Number.isFinite(r) ? r : 0;
}

// Calcula el presupuesto completo. Todo determinístico: sin IA.
export async function calcularPresupuesto(entrada: EntradaPresupuesto): Promise<Presupuesto> {
  const { items, canal, medioPago, descuentoGlobalPct = 0 } = entrada;
  const avisos: string[] = [];
  const recargo = await getRecargoMedioPago(medioPago);

  const catalogo = await productosParaCotizar();
  const porId = new Map(catalogo.map(p => [p.id, p]));

  const lineas: LineaPresupuesto[] = [];
  for (const item of items) {
    const p = porId.get(item.productId);
    const cantidad = Math.max(1, Math.floor(Number(item.cantidad) || 1));
    if (!p) {
      avisos.push(`Producto ${item.productId} no encontrado, se omitió.`);
      continue;
    }

    // 1) Precio base según canal.
    let base: number | null;
    if (item.precioUnitOverride != null && Number(item.precioUnitOverride) > 0) {
      base = Number(item.precioUnitOverride);
    } else if (canal === "mayorista") {
      base = p.precio_mayorista
        ?? (p.precio != null ? p.precio * (1 - p.descuento_b2b_pct / 100) : null);
    } else {
      base = p.precio;
    }

    if (base == null || base <= 0) {
      avisos.push(`"${p.nombre}" no tiene precio cargado, se omitió.`);
      continue;
    }

    // 2) Respetar el margen piso sobre el costo.
    let bajoPiso = false;
    let avisoLinea: string | undefined;
    if (p.costo != null && p.costo > 0) {
      const piso = p.costo / (1 - MARGEN_PISO_PCT / 100);
      if (base < piso) {
        base = redondear(piso);
        bajoPiso = true;
        avisoLinea = `Se ajustó al margen mínimo del ${MARGEN_PISO_PCT}%`;
      }
    }

    // 3) Recargo por medio de pago.
    const precioUnit = redondear(base * (1 + recargo / 100));
    const subtotal = precioUnit * cantidad;
    const margen = p.costo != null && precioUnit > 0
      ? ((precioUnit - p.costo) / precioUnit) * 100 : null;

    lineas.push({
      productId: p.id, nombre: p.nombre, cantidad,
      precio_base: Math.round(base), precio_unitario: precioUnit, subtotal,
      costo: p.costo, margen_pct: margen != null ? Math.round(margen) : null,
      bajo_piso: bajoPiso, aviso: avisoLinea,
    });
  }

  const subtotal = lineas.reduce((a, l) => a + l.subtotal, 0);
  const descPct = Math.min(100, Math.max(0, Number(descuentoGlobalPct) || 0));
  const descMonto = Math.round(subtotal * (descPct / 100));
  const total = subtotal - descMonto;

  return {
    lineas, canal, medioPago,
    recargo_medio_pago_pct: recargo,
    subtotal, descuento_global_pct: descPct, descuento_global_monto: descMonto, total,
    avisos,
  };
}
