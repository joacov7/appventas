"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, ArrowLeft, RotateCcw, Save } from "lucide-react";

interface Textos {
  bienvenida: string; menu: string; catalogo_intro: string; regalos: string;
  consultar: string; asesor: string; horarios: string; fallback: string;
  cotizacion_recibida: string;
}

const CAMPOS: { key: keyof Textos; label: string; ayuda: string }[] = [
  { key: "menu", label: "Menú principal", ayuda: "Lo primero que ve el cliente al saludar." },
  { key: "catalogo_intro", label: "Antes del catálogo", ayuda: "Se muestra arriba de la lista de categorías." },
  { key: "regalos", label: "Regalos empresariales", ayuda: "Cuando elige la opción de personalizados / empresa." },
  { key: "cotizacion_recibida", label: "Datos de cotización recibidos", ayuda: "Cuando la empresa ya dio producto/cantidad/logo: acusa recibo y avisa que lo sigue una persona." },
  { key: "consultar", label: "Consultar un producto", ayuda: "Cuando pide consultar un producto puntual." },
  { key: "asesor", label: "Hablar con un asesor", ayuda: "Cuando pide hablar con una persona." },
  { key: "horarios", label: "Horarios", ayuda: "Cuando pregunta por horarios de atención." },
  { key: "bienvenida", label: "Bienvenida (primer contacto)", ayuda: "Se antepone la primera vez que alguien escribe." },
  { key: "fallback", label: "No entendí", ayuda: "Cuando el bot no sabe qué responder." },
];

export default function MensajesBotPage() {
  const [textos, setTextos] = useState<Textos | null>(null);
  const [defaults, setDefaults] = useState<Textos | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState("");
  // Plantilla de abordaje (API).
  const [plantilla, setPlantilla] = useState({ nombre: "", idioma: "es_AR" });
  const [plGuardado, setPlGuardado] = useState("");
  const [presu, setPresu] = useState<{ limite_usd: number; enviados: number; gasto_usd: number } | null>(null);

  useEffect(() => {
    fetch("/api/whatsapp/textos").then(r => r.json()).then(d => {
      if (d.textos) { setTextos(d.textos); setDefaults(d.defaults); }
    });
    fetch("/api/whatsapp/plantilla").then(r => r.json()).then(d => {
      if (d?.idioma) setPlantilla({ nombre: d.nombre ?? "", idioma: d.idioma });
    });
    cargarPresupuesto();
  }, []);

  function cargarPresupuesto() {
    fetch("/api/whatsapp/plantilla/presupuesto").then(r => r.json()).then(d => {
      if (d && typeof d.limite_usd === "number") setPresu(d);
    }).catch(() => {});
  }

  async function guardarPlantilla() {
    setPlGuardado("");
    const r = await fetch("/api/whatsapp/plantilla", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(plantilla),
    });
    setPlGuardado(r.ok ? "✅ Guardado" : "Error");
  }

  async function cambiarTope() {
    const v = prompt("Tope de gasto mensual del abordaje por WhatsApp (USD):", String(presu?.limite_usd ?? 40));
    if (v === null) return;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) { alert("Poné un número válido"); return; }
    const r = await fetch("/api/whatsapp/plantilla/presupuesto", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limite_usd: n }),
    });
    if (r.ok) setPresu(await r.json());
  }

  async function guardar() {
    if (!textos) return;
    setGuardando(true); setMsg("");
    const r = await fetch("/api/whatsapp/textos", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(textos),
    });
    setGuardando(false);
    setMsg(r.ok ? "✅ Guardado. Ya está activo en el bot." : "Error al guardar");
  }

  if (!textos) return <p className="text-sm text-gray-400">Cargando textos del bot...</p>;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <MessageCircle className="text-emerald-600" size={22} />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mensajes del bot</h1>
          <p className="text-sm text-gray-500">Editá lo que responde el bot de WhatsApp. Se aplica al instante.</p>
        </div>
        <Link href="/admin/whatsapp" className="ml-auto flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={15} /> Bot
        </Link>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3 text-xs text-indigo-900">
        Podés usar <b>{"{tienda}"}</b> (nombre de la tienda) y <b>{"{link}"}</b> (dirección de la tienda) — se reemplazan solos.
        El bot arma las <b>categorías</b> y los <b>precios</b> automáticamente según tu catálogo.
      </div>

      {/* Plantilla de abordaje (API) */}
      <div className="bg-white rounded-2xl border border-amber-200 p-4">
        <p className="text-sm font-medium text-gray-800 mb-1">📤 Abordaje en frío (plantilla de la API)</p>
        <p className="text-xs text-gray-500 mb-3">
          Para escribirle a un prospecto que nunca te escribió, Meta exige una <b>plantilla aprobada</b>.
          Creala en Meta Business Manager con <b>una variable</b> {"{{1}}"} (el nombre del negocio) y pegá acá su nombre exacto e idioma.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input value={plantilla.nombre} onChange={e => setPlantilla({ ...plantilla, nombre: e.target.value })}
            placeholder="Nombre de la plantilla (ej: abordaje_inicial)"
            className="flex-1 text-sm border rounded-xl px-3 py-2 outline-none" />
          <input value={plantilla.idioma} onChange={e => setPlantilla({ ...plantilla, idioma: e.target.value })}
            placeholder="Idioma (es_AR)"
            className="sm:w-28 text-sm border rounded-xl px-3 py-2 outline-none" />
          <button onClick={guardarPlantilla}
            className="bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-xl">Guardar</button>
        </div>
        {plGuardado && <p className="text-xs text-gray-500 mt-2">{plGuardado}</p>}
        {presu && (
          <p className="text-xs text-gray-500 mt-3 pt-3 border-t">
            Gasto de abordaje este mes: <b className={presu.gasto_usd >= presu.limite_usd ? "text-red-500" : "text-gray-700"}>~US${presu.gasto_usd}</b> de US${presu.limite_usd} ({presu.enviados} envíos) ·{" "}
            <button onClick={cambiarTope} className="text-indigo-500 hover:underline">cambiar tope</button>
          </p>
        )}
      </div>

      {CAMPOS.map(({ key, label, ayuda }) => (
        <div key={key} className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-800">{label}</label>
            {defaults && textos[key] !== defaults[key] && (
              <button onClick={() => setTextos({ ...textos, [key]: defaults[key] })}
                className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1">
                <RotateCcw size={11} /> Restaurar
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mb-2">{ayuda}</p>
          <textarea
            value={textos[key]}
            onChange={e => setTextos({ ...textos, [key]: e.target.value })}
            rows={key === "menu" || key === "regalos" || key === "fallback" ? 6 : 3}
            className="w-full text-sm border rounded-xl px-3 py-2 outline-none resize-y focus:ring-2 focus:ring-emerald-300 font-mono"
          />
        </div>
      ))}

      <div className="sticky bottom-4 flex items-center gap-3 bg-white/90 backdrop-blur border border-gray-100 rounded-2xl p-3 shadow-sm">
        <button onClick={guardar} disabled={guardando}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-xl">
          <Save size={16} /> {guardando ? "Guardando..." : "Guardar cambios"}
        </button>
        {msg && <span className="text-sm text-gray-600">{msg}</span>}
      </div>
    </div>
  );
}
