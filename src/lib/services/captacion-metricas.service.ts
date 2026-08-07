import { prisma } from "@/lib/prisma";
import { ensureSchema } from "@/lib/db/schema";

// ─── Métricas del embudo de captación ─────────────────────────────────────────
// Responde: ¿cuántos capté, cuántos contacté, cuántos se interesaron, y a qué
// ritmo? Todo determinístico con SQL sobre prospectos + prospecto_interacciones.

export interface MetricasCaptacion {
  total: number;
  embudo: Record<string, number>;            // nuevo / contactado / interesado / descartado
  calidad: { A: number; B: number; C: number; con_telefono: number; con_email: number };
  tasa_contacto: number;                     // % de la base ya trabajada (contactado+interesado+descartado)
  tasa_interes: number;                      // % de interesados sobre los contactados
  semanas: { semana: string; captados: number; contactos: number; interesados: number }[];
  top_zonas: { zona: string; total: number; contactados: number }[];
  top_rubros: { rubro: string; total: number }[];
}

export async function metricasCaptacion(): Promise<MetricasCaptacion> {
  await ensureSchema("captacion");

  const [porEstado, calidadRows, semCaptados, semContactos, semInteresados, zonas, rubros]: any[][] =
    await Promise.all([
      (prisma as any).$queryRawUnsafe(
        `SELECT estado, COUNT(*)::int AS n FROM prospectos GROUP BY estado`),
      (prisma as any).$queryRawUnsafe(
        `SELECT
           COUNT(*) FILTER (WHERE puntaje = 'A')::int AS a,
           COUNT(*) FILTER (WHERE puntaje = 'B')::int AS b,
           COUNT(*) FILTER (WHERE puntaje = 'C')::int AS c,
           COUNT(*) FILTER (WHERE telefono IS NOT NULL AND telefono <> '')::int AS con_tel,
           COUNT(*) FILTER (WHERE email IS NOT NULL AND email <> '')::int AS con_mail,
           COUNT(*)::int AS total
         FROM prospectos`),
      (prisma as any).$queryRawUnsafe(
        `SELECT to_char(date_trunc('week', creado_en), 'DD/MM') AS semana, COUNT(*)::int AS n
         FROM prospectos WHERE creado_en >= now() - interval '8 weeks'
         GROUP BY date_trunc('week', creado_en) ORDER BY date_trunc('week', creado_en)`),
      (prisma as any).$queryRawUnsafe(
        `SELECT to_char(date_trunc('week', creado_en), 'DD/MM') AS semana, COUNT(*)::int AS n
         FROM prospecto_interacciones WHERE tipo = 'contacto' AND creado_en >= now() - interval '8 weeks'
         GROUP BY date_trunc('week', creado_en) ORDER BY date_trunc('week', creado_en)`),
      (prisma as any).$queryRawUnsafe(
        `SELECT to_char(date_trunc('week', creado_en), 'DD/MM') AS semana, COUNT(*)::int AS n
         FROM prospecto_interacciones
         WHERE tipo = 'estado' AND detalle ILIKE '%interesado%' AND creado_en >= now() - interval '8 weeks'
         GROUP BY date_trunc('week', creado_en) ORDER BY date_trunc('week', creado_en)`),
      (prisma as any).$queryRawUnsafe(
        `SELECT COALESCE(provincia, 'Sin zona') AS zona, COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE estado IN ('contactado','interesado'))::int AS contactados
         FROM prospectos GROUP BY provincia ORDER BY total DESC LIMIT 6`),
      (prisma as any).$queryRawUnsafe(
        `SELECT rubro, COUNT(*)::int AS total FROM prospectos
         WHERE rubro IS NOT NULL GROUP BY rubro ORDER BY total DESC LIMIT 6`),
    ]);

  const embudo: Record<string, number> = { nuevo: 0, contactado: 0, interesado: 0, descartado: 0 };
  for (const r of porEstado) embudo[r.estado] = Number(r.n);

  const q = calidadRows[0] ?? {};
  const total = Number(q.total ?? 0);
  const trabajados = embudo.contactado + embudo.interesado + embudo.descartado;
  const contactadosTotal = embudo.contactado + embudo.interesado;

  // Unificar las tres series semanales en una sola línea de tiempo.
  const semanasMap = new Map<string, { semana: string; captados: number; contactos: number; interesados: number }>();
  const tomar = (rows: any[], campo: "captados" | "contactos" | "interesados") => {
    for (const r of rows) {
      if (!semanasMap.has(r.semana)) semanasMap.set(r.semana, { semana: r.semana, captados: 0, contactos: 0, interesados: 0 });
      semanasMap.get(r.semana)![campo] = Number(r.n);
    }
  };
  tomar(semCaptados, "captados");
  tomar(semContactos, "contactos");
  tomar(semInteresados, "interesados");

  return {
    total,
    embudo,
    calidad: {
      A: Number(q.a ?? 0), B: Number(q.b ?? 0), C: Number(q.c ?? 0),
      con_telefono: Number(q.con_tel ?? 0), con_email: Number(q.con_mail ?? 0),
    },
    tasa_contacto: total ? Math.round((trabajados / total) * 100) : 0,
    tasa_interes: contactadosTotal ? Math.round((embudo.interesado / contactadosTotal) * 100) : 0,
    semanas: Array.from(semanasMap.values()),
    top_zonas: zonas.map((z: any) => ({ zona: z.zona, total: Number(z.total), contactados: Number(z.contactados) })),
    top_rubros: rubros.map((r: any) => ({ rubro: r.rubro, total: Number(r.total) })),
  };
}
