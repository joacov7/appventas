// Calendario comercial argentino: fechas clave para vender (con foco en mates,
// regalos y regionales). Incluye fechas fijas y movibles (Nº domingo del mes).

export interface FechaComercial {
  nombre: string;
  fecha: string;         // ISO YYYY-MM-DD
  dias_restantes: number;
  relevancia: "alta" | "media";
  angulo: string;        // gancho de venta para esa fecha
}

// N-ésimo día de la semana de un mes (weekday: 0=domingo ... 6=sábado)
function nthWeekday(year: number, month0: number, weekday: number, n: number): Date {
  const primero = new Date(year, month0, 1);
  const offset = (weekday - primero.getDay() + 7) % 7;
  return new Date(year, month0, 1 + offset + (n - 1) * 7);
}

// Genera todas las fechas comerciales de un año dado.
function fechasDelAnio(year: number): { nombre: string; fecha: Date; relevancia: "alta" | "media"; angulo: string }[] {
  return [
    { nombre: "Reyes Magos", fecha: new Date(year, 0, 6), relevancia: "media", angulo: "Último regalo de las fiestas." },
    { nombre: "San Valentín", fecha: new Date(year, 1, 14), relevancia: "media", angulo: "Mate en pareja, combos para regalar al amor." },
    { nombre: "Día de la Mujer", fecha: new Date(year, 2, 8), relevancia: "media", angulo: "Regalos y detalles." },
    { nombre: "Día del Padre", fecha: nthWeekday(year, 5, 0, 3), relevancia: "alta", angulo: "El mate es EL regalo del papá matero." },
    { nombre: "Día del Amigo", fecha: new Date(year, 6, 20), relevancia: "alta", angulo: "Mate = amistad. Combos para regalar entre amigos." },
    { nombre: "Día de las Infancias (Niño)", fecha: nthWeekday(year, 7, 0, 3), relevancia: "media", angulo: "Regalería, jugueterías (revendedores)." },
    { nombre: "Día de la Primavera / Estudiante", fecha: new Date(year, 8, 21), relevancia: "media", angulo: "Salidas al aire libre, matear en el parque." },
    { nombre: "Día de la Madre", fecha: nthWeekday(year, 9, 0, 3), relevancia: "alta", angulo: "La fecha más fuerte: el mate es el regalo estrella para mamá." },
    { nombre: "Black Friday", fecha: nthWeekday(year, 10, 5, 4), relevancia: "alta", angulo: "Descuentos y ofertas, arranque de compras navideñas." },
    { nombre: "Día Nacional del Mate", fecha: new Date(year, 10, 30), relevancia: "alta", angulo: "¡Tu fecha temática! Promoción de toda la línea." },
    { nombre: "Navidad", fecha: new Date(year, 11, 25), relevancia: "alta", angulo: "Regalos empresariales y personales, combos de fin de año." },
    { nombre: "Fin de año / Año Nuevo", fecha: new Date(year, 11, 31), relevancia: "media", angulo: "Regalos de último momento, brindis." },
  ];
}

// Próximas fechas dentro de una ventana de anticipación (por defecto 60 días).
export function proximasFechas(ventanaDias = 60, desde = new Date()): FechaComercial[] {
  const hoy = new Date(desde); hoy.setHours(0, 0, 0, 0);
  const year = hoy.getFullYear();
  // Este año + el que viene (para cubrir el cambio de año dentro de la ventana)
  const todas = [...fechasDelAnio(year), ...fechasDelAnio(year + 1)];

  return todas
    .map(f => {
      const fecha = new Date(f.fecha); fecha.setHours(0, 0, 0, 0);
      const dias = Math.round((fecha.getTime() - hoy.getTime()) / 86_400_000);
      return { nombre: f.nombre, fecha: fecha.toISOString().slice(0, 10), dias_restantes: dias, relevancia: f.relevancia, angulo: f.angulo };
    })
    .filter(f => f.dias_restantes >= 0 && f.dias_restantes <= ventanaDias)
    .sort((a, b) => a.dias_restantes - b.dias_restantes);
}
