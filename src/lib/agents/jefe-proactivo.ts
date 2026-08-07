import { aiComplete } from "@/lib/ai";
import { resumenFinanciero } from "@/lib/services/finanzas.service";
import { seguimientosPendientes } from "@/lib/services/seguimiento.service";
import { alertasPrecio } from "@/lib/services/inteligencia-comercial.service";
import { proximasFechas } from "@/lib/services/calendario.service";
import { conversacionesPendientes } from "@/lib/services/whatsapp.service";

// El jefe de gabinete PROACTIVO: junta las señales del negocio (determinístico),
// arma sugerencias de organización, y redacta un reporte breve para Telegram.
// La IA solo redacta el mensaje final.

const money = (n: number | null) => n == null ? "—" : "$" + Math.round(Number(n)).toLocaleString("es-AR");

export async function armarBriefingProactivo(): Promise<string | null> {
  // 1) Señales (cada una tolerante a fallos).
  const [fin, seg, alertas, convos] = await Promise.all([
    resumenFinanciero().catch(() => null),
    seguimientosPendientes().catch(() => [] as any[]),
    alertasPrecio().catch(() => null),
    conversacionesPendientes().catch(() => [] as any[]),
  ]);
  let fechas: any[] = [];
  try { fechas = proximasFechas(45); } catch { fechas = []; }

  const fechaFuerte = (fechas as any[]).find(f => f.relevancia === "alta") ?? (fechas as any[])[0] ?? null;

  // 2) Sugerencias de organización (reglas simples).
  const sugerencias: string[] = [];
  if ((seg as any[]).length > 0) sugerencias.push(`Tenés ${(seg as any[]).length} contacto(s)/presupuesto(s) para seguir. Convendría re-contactarlos hoy.`);
  if ((convos as any[]).length > 0) sugerencias.push(`Hay ${(convos as any[]).length} conversación(es) de WhatsApp sin resolver — corré el agente WhatsApp o respondé desde acá.`);
  if (alertas && (alertas as any).caros > 0) sugerencias.push(`Estás caro en ${(alertas as any).caros} producto(s) vs la competencia — revisá precios.`);
  if (fechaFuerte && fechaFuerte.dias_restantes <= 30) sugerencias.push(`${fechaFuerte.nombre} en ${fechaFuerte.dias_restantes} días: conviene ir armando la campaña.`);

  const datos = {
    caja: fin ? { ingresos_30d: money(fin.ingresos_30d), pendiente_de_cobro: money(fin.pendiente_de_cobro), ticket: fin.ticket_promedio ? money(fin.ticket_promedio) : null } : null,
    seguimientos: (seg as any[]).length,
    conversaciones_pendientes: (convos as any[]).length,
    alertas_precio: alertas ? { caros: (alertas as any).caros, baratos: (alertas as any).baratos } : null,
    proxima_fecha_fuerte: fechaFuerte ? { nombre: fechaFuerte.nombre, dias: fechaFuerte.dias_restantes } : null,
    sugerencias,
  };

  // Si no hay absolutamente nada para decir, no molestamos.
  const hayAlgo = sugerencias.length > 0 || (fin && (fin.ingresos_30d > 0 || fin.pendiente_de_cobro > 0));
  if (!hayAlgo) return null;

  // 3) Redacción (IA, breve, criollo, para Telegram).
  try {
    const txt = await aiComplete({
      system:
        "Sos el jefe de gabinete de una PyME argentina de mates y personalizados. Escribí un reporte matutino BREVE para el dueño, por Telegram. " +
        "Arrancá con un saludo corto. Mostrá 2-4 puntos con lo importante (usá <b>negrita</b> para los números/temas clave). " +
        "Cerrá con 1-2 sugerencias concretas de qué hacer hoy, y ofrecé ayuda ('decime si querés que...'). " +
        "Tono cercano y directo, sin relleno. NO inventes datos: usá SOLO lo que te paso. Máximo ~120 palabras.",
      fast: true, maxTokens: 450,
      messages: [{ role: "user", content: `Datos de hoy:\n${JSON.stringify(datos)}` }],
    });
    return txt.trim() || null;
  } catch {
    // Fallback determinístico si la IA no está.
    const lineas = ["☀️ <b>Reporte del día</b>"];
    if (datos.caja) lineas.push(`💰 Ingresos 30d: ${datos.caja.ingresos_30d} · Por cobrar: ${datos.caja.pendiente_de_cobro}`);
    for (const s of sugerencias) lineas.push(`• ${s}`);
    return lineas.join("\n");
  }
}
