import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";

// ─── Aclaraciones / condiciones de compra ────────────────────────────────────
// Lista editable desde el admin. Se muestra en el catálogo, el portal y el
// checkout, y el bot puede enviarlas cuando preguntan por envíos/garantía.

export interface AclaracionItem { titulo: string; texto: string }

export const ACLARACIONES_DEFAULT: AclaracionItem[] = [
  { titulo: "Compra mínima", texto: "El pedido mínimo mayorista es de $100.000." },
  { titulo: "Demora de despacho", texto: "Consultá la demora de despacho con tu vendedor al momento de hacer el pedido." },
  { titulo: "Despachos", texto: "Despachamos por Andreani, OCA, Vía Cargo, Credifin, Buspack e Integral Pack. El envío va con seguro mínimo siempre, salvo que el cliente indique lo contrario al hacer el pedido. Una vez despachado, los daños que pueda generar el transporte pasan a ser responsabilidad de la empresa de encomienda." },
  { titulo: "Precios", texto: "Los artículos que no tengan precio se cotizan al valor del día. Para más información, consultanos por WhatsApp." },
  { titulo: "Garantía", texto: "Los mates tienen garantía sólo por fallas de fabricación. Los termos y artículos térmicos no tienen garantía." },
  { titulo: "Fotos ilustrativas", texto: "Las fotos del catálogo son ilustrativas: al ser productos artesanales, cada mate es diferente." },
  { titulo: "Pedidos", texto: "Por cuestiones de organización, no realizamos modificaciones en el pedido una vez realizado el pago." },
];

export async function loadAclaraciones(): Promise<AclaracionItem[]> {
  try {
    await ensureSchema("config");
    const rows: any[] = await (prisma as any).$queryRawUnsafe(
      `SELECT config FROM catalog_config WHERE tipo = 'aclaraciones'`);
    const items = rows[0]?.config?.items;
    if (Array.isArray(items)) {
      return items
        .map((i: any) => ({ titulo: String(i?.titulo ?? "").trim(), texto: String(i?.texto ?? "").trim() }))
        .filter(i => i.titulo || i.texto);
    }
    return ACLARACIONES_DEFAULT;
  } catch {
    return ACLARACIONES_DEFAULT;
  }
}

export async function saveAclaraciones(items: AclaracionItem[]): Promise<void> {
  await ensureSchema("config");
  const limpio = (Array.isArray(items) ? items : [])
    .map(i => ({ titulo: String(i?.titulo ?? "").trim(), texto: String(i?.texto ?? "").trim() }))
    .filter(i => i.titulo || i.texto);
  await (prisma as any).$executeRawUnsafe(
    `INSERT INTO catalog_config (tipo, config) VALUES ('aclaraciones', $1::jsonb)
     ON CONFLICT (tipo) DO UPDATE SET config = $1::jsonb, updated_at = NOW()`,
    JSON.stringify({ items: limpio })
  );
}
