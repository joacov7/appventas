import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";

// Config pública de la tienda (guardada en catalog_config 'store_config').
export interface StoreConfig {
  storeName: string;
  modoMayorista: boolean;   // tienda en modo mayorista: sin pago/envío online
  pedidoMinimo: number;     // monto mínimo para enviar un pedido (0 = sin mínimo)
  logoUrl?: string | null;
  [k: string]: any;
}

export async function loadStoreConfig(): Promise<StoreConfig> {
  try {
    await ensureSchema("config");
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT config FROM catalog_config WHERE tipo = 'store_config'`);
    const c = rows[0]?.config ?? {};
    return {
      storeName: c.storeName || "nuestra tienda",
      modoMayorista: c.modoMayorista === true,
      pedidoMinimo: Number(c.pedidoMinimo) || 0,
      logoUrl: c.logoUrl ?? null,
      ...c,
    };
  } catch {
    return { storeName: "nuestra tienda", modoMayorista: false, pedidoMinimo: 0 };
  }
}
