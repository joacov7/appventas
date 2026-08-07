"use client";

import { useState } from "react";
import { HelpCircle, ChevronDown, Search } from "lucide-react";

interface Tema { titulo: string; pasos: string[] }
interface Seccion { grupo: string; temas: Tema[] }

const AYUDA: Seccion[] = [
  {
    grupo: "Catálogo",
    temas: [
      { titulo: "Cargar un producto y su fabricante", pasos: [
        "Entrá a Productos → Nuevo (o editá uno existente).",
        "Cargá nombre, fotos, variantes y precios.",
        "Abajo, en 'Fabricante / proveedor', elegí de qué fabricante viene y su costo. Eso lo usa el Cotizador.",
        "Los fabricantes y sus reglas de precio (margen, descuento B2B) se cargan en la sección Fabricantes.",
      ] },
      { titulo: "Combos y Catálogos", pasos: [
        "Combos: armá packs de varios productos con su propio precio.",
        "Catálogos: generá un PDF de catálogo para mandar a clientes, con tu logo y datos.",
      ] },
    ],
  },
  {
    grupo: "Ventas",
    temas: [
      { titulo: "Hacer un presupuesto (Cotizador)", pasos: [
        "Entrá a Cotizador y buscá productos para agregarlos.",
        "Elegí canal (Minorista/Mayorista), medio de pago y descuento. El total se calcula solo.",
        "Descargá el PDF, generá el mensaje para el cliente, o guardalo en el historial.",
        "En el historial, cuando lo marcás 'aceptado', se registra como venta automáticamente.",
      ] },
      { titulo: "Registrar una venta por fuera de la web", pasos: [
        "Entrá a Ventas manuales → Cargar venta.",
        "Poné cliente, canal (WhatsApp/mostrador/mayorista), total y fecha.",
        "Esa venta suma en Finanzas y habilita el seguimiento de postventa.",
      ] },
    ],
  },
  {
    grupo: "Clientes",
    temas: [
      { titulo: "Buscar posibles clientes (Captación)", pasos: [
        "Entrá a Captación, poné una ciudad o provincia.",
        "Para traer todo, elegí '🏬 Todos los comercios' (o rubros puntuales).",
        "Tocá Buscar. Filtrá la lista por rubro o 'con contacto'.",
        "En cada uno, generá el mensaje de abordaje (se adapta: reventa a comercios, regalos empresariales a empresas) y mandalo por WhatsApp.",
        "Marcalo como 'contactado' para que después aparezca en Seguimiento.",
      ] },
      { titulo: "Seguir lo que quedó tibio (Seguimiento)", pasos: [
        "Muestra prospectos contactados hace 5+ días sin respuesta y presupuestos enviados sin cerrar.",
        "Copiá el recordatorio o mandalo por WhatsApp. 'Marcar seguido' lo saca de la lista.",
      ] },
      { titulo: "Fidelizar a los que compraron (Postventa)", pasos: [
        "Detecta a quién pedirle reseña (compra reciente) y a quién reactivar (sin comprar hace 60+ días).",
        "Enviá el mensaje por email o WhatsApp con un clic.",
      ] },
      { titulo: "Responder mensajes (Bandeja)", pasos: [
        "Todas las conversaciones en un solo lugar. Elegí una a la izquierda y respondé.",
        "Con '← Volver' regresás a la lista.",
      ] },
    ],
  },
  {
    grupo: "Marketing e Inteligencia",
    temas: [
      { titulo: "Campañas por fecha (Marketing)", pasos: [
        "Muestra el calendario comercial con cuenta regresiva (Día de la Madre, etc.).",
        "Tocá 'Generar campaña' en una fecha, elegí el producto y arma el borrador (la IA redacta los textos).",
      ] },
      { titulo: "Espiar la competencia (Inteligencia)", pasos: [
        "Cargá tiendas o búsquedas para scrapear precios de la competencia.",
        "'Mi posición' compara tus precios con el mercado.",
        "'Alertas' te dice dónde estás caro o barato.",
        "'Ganadores ML' busca productos que se venden en MercadoLibre (best-effort).",
      ] },
    ],
  },
  {
    grupo: "Empresa IA (los agentes)",
    temas: [
      { titulo: "Cómo funcionan los agentes", pasos: [
        "Cada agente sigue: memoria → reglas → datos → IA (último recurso). Casi todo lo resuelve sin gastar tokens.",
        "Configurás 3 cosas: activo/inactivo, autonomía (Manual = solo recomienda; Asistido = propone y aprobás; Autónomo = ejecuta) y frecuencia (manual/diario/semanal).",
      ] },
      { titulo: "Aprobar acciones", pasos: [
        "Cuando un agente propone algo que cambia datos (mandar WhatsApp, aplicar precio), va a Aprobaciones.",
        "Ahí lo revisás y aprobás. Nada se manda sin tu OK (salvo modo Autónomo).",
      ] },
    ],
  },
  {
    grupo: "Sistema",
    temas: [
      { titulo: "Configuración y bot de WhatsApp", pasos: [
        "Configuración: nombre de la tienda, logo, márgenes y medios de pago.",
        "Bot WhatsApp: estado de la conexión e historial de mensajes.",
      ] },
    ],
  },
];

export default function AyudaPage() {
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);

  const filtradas = AYUDA.map(s => ({
    ...s,
    temas: s.temas.filter(t =>
      !q.trim() ||
      t.titulo.toLowerCase().includes(q.toLowerCase()) ||
      t.pasos.some(p => p.toLowerCase().includes(q.toLowerCase()))
    ),
  })).filter(s => s.temas.length > 0);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <HelpCircle className="text-indigo-600" size={24} />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Ayuda</h1>
          <p className="text-sm text-gray-500">Cómo usar cada parte del sistema, paso a paso.</p>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-3 text-gray-400" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar en la ayuda... (ej: presupuesto, captación, agentes)"
          className="w-full pl-9 pr-3 py-2.5 text-sm border rounded-xl outline-none" />
      </div>

      <div className="space-y-5">
        {filtradas.map(s => (
          <div key={s.grupo}>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{s.grupo}</p>
            <div className="space-y-2">
              {s.temas.map(t => {
                const id = s.grupo + t.titulo;
                const open = abierto === id || !!q.trim();
                return (
                  <div key={id} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                    <button onClick={() => setAbierto(open && !q.trim() ? null : id)}
                      className="w-full flex items-center justify-between gap-2 p-4 text-left">
                      <span className="font-medium text-gray-900 text-sm">{t.titulo}</span>
                      <ChevronDown size={16} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
                    </button>
                    {open && (
                      <ol className="px-5 pb-4 space-y-1.5 list-decimal list-inside">
                        {t.pasos.map((p, i) => <li key={i} className="text-sm text-gray-600">{p}</li>)}
                      </ol>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {filtradas.length === 0 && <p className="text-gray-400 text-sm">No encontré nada con "{q}".</p>}
      </div>
    </div>
  );
}
