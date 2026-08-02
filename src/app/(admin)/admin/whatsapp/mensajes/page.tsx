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
  // Plantillas de abordaje (API), una por segmento.
  const TIPOS_PL: { clave: string; etiqueta: string; ayuda: string }[] = [
    { clave: "mayorista", etiqueta: "Comercios mayoristas", ayuda: "Revendedores / comercios (ej: abordaje_inicial)" },
    { clave: "empresa", etiqueta: "Regalos empresariales", ayuda: "Empresas para regalería corporativa (ej: abordajecorpo)" },
    { clave: "concesionaria", etiqueta: "Concesionarias", ayuda: "Concesionarias / automotrices (ej: abordaje_con)" },
  ];
  const [plantillas, setPlantillas] = useState<Record<string, { nombre: string; idioma: string }>>({
    mayorista: { nombre: "", idioma: "es_AR" },
    empresa: { nombre: "", idioma: "es_AR" },
    concesionaria: { nombre: "", idioma: "es_AR" },
  });
  const [plGuardado, setPlGuardado] = useState("");
  const [presu, setPresu] = useState<{ limite_usd: number; enviados: number; gasto_usd: number } | null>(null);
  // A dónde manda el catálogo (página web o link de Drive provisorio).
  const [catalogo, setCatalogo] = useState<{ modo: "web" | "drive"; drive_url: string }>({ modo: "web", drive_url: "" });
  const [catGuardado, setCatGuardado] = useState("");
  // Modo IA conversacional.
  const [ia, setIa] = useState<{ activo: boolean; instrucciones: string; nombre: string; demora: boolean }>({ activo: false, instrucciones: "", nombre: "", demora: false });
  const [iaGuardado, setIaGuardado] = useState("");

  useEffect(() => {
    fetch("/api/whatsapp/textos").then(r => r.json()).then(d => {
      if (d.textos) { setTextos(d.textos); setDefaults(d.defaults); }
    });
    fetch("/api/whatsapp/plantilla").then(r => r.json()).then(d => {
      const pl = d?.plantillas ?? {};
      setPlantillas(prev => ({
        mayorista: pl.mayorista ?? (d?.nombre ? { nombre: d.nombre, idioma: d.idioma || "es_AR" } : prev.mayorista),
        empresa: pl.empresa ?? prev.empresa,
        concesionaria: pl.concesionaria ?? prev.concesionaria,
      }));
    });
    fetch("/api/whatsapp/catalogo").then(r => r.json()).then(d => {
      if (d?.modo) setCatalogo({ modo: d.modo, drive_url: d.drive_url ?? "" });
    }).catch(() => {});
    fetch("/api/whatsapp/ia").then(r => r.json()).then(d => {
      if (typeof d?.activo === "boolean") setIa({ activo: d.activo, instrucciones: d.instrucciones ?? "", nombre: d.nombre ?? "", demora: !!d.demora });
    }).catch(() => {});
    cargarPresupuesto();
  }, []);

  async function guardarCatalogo() {
    setCatGuardado("");
    const r = await fetch("/api/whatsapp/catalogo", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(catalogo),
    });
    setCatGuardado(r.ok ? "✅ Guardado" : "Error");
  }

  async function guardarIA() {
    setIaGuardado("");
    const r = await fetch("/api/whatsapp/ia", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ia),
    });
    setIaGuardado(r.ok ? "✅ Guardado" : "Error");
  }

  function cargarPresupuesto() {
    fetch("/api/whatsapp/plantilla/presupuesto").then(r => r.json()).then(d => {
      if (d && typeof d.limite_usd === "number") setPresu(d);
    }).catch(() => {});
  }

  async function guardarPlantilla() {
    setPlGuardado("");
    const r = await fetch("/api/whatsapp/plantilla", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plantillas }),
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

      {/* A dónde manda el catálogo */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <p className="text-sm font-medium text-gray-800 mb-1">📎 Cuando piden el catálogo, enviar…</p>
        <p className="text-xs text-gray-500 mb-3">Elegí a dónde manda el bot. Usá el link de Drive mientras terminás de cargar las fotos; después cambiá a la página web.</p>
        <div className="space-y-2">
          <label className={`flex items-start gap-2 p-3 rounded-xl border cursor-pointer ${catalogo.modo === "web" ? "border-emerald-300 bg-emerald-50" : "border-gray-200"}`}>
            <input type="radio" name="catmodo" checked={catalogo.modo === "web"} onChange={() => setCatalogo({ ...catalogo, modo: "web" })} className="mt-0.5 accent-emerald-600" />
            <span className="text-sm text-gray-700"><b>La página web</b> (catálogo con precios y pedido)</span>
          </label>
          <label className={`flex items-start gap-2 p-3 rounded-xl border cursor-pointer ${catalogo.modo === "drive" ? "border-emerald-300 bg-emerald-50" : "border-gray-200"}`}>
            <input type="radio" name="catmodo" checked={catalogo.modo === "drive"} onChange={() => setCatalogo({ ...catalogo, modo: "drive" })} className="mt-0.5 accent-emerald-600" />
            <span className="text-sm text-gray-700 flex-1"><b>Un link de Drive</b> (provisorio, fotos del catálogo)</span>
          </label>
          {catalogo.modo === "drive" && (
            <input value={catalogo.drive_url} onChange={e => setCatalogo({ ...catalogo, drive_url: e.target.value })}
              placeholder="Pegá el link de la carpeta de Drive (https://drive.google.com/...)"
              className="w-full text-sm border rounded-xl px-3 py-2 outline-none" />
          )}
        </div>
        <div className="flex items-center gap-3 mt-3">
          <button onClick={guardarCatalogo}
            className="bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-xl">Guardar</button>
          {catGuardado && <span className="text-xs text-gray-500">{catGuardado}</span>}
        </div>
        {catalogo.modo === "drive" && !catalogo.drive_url && (
          <p className="text-xs text-amber-600 mt-2">⚠️ Sin link cargado, el bot manda igual a la página web.</p>
        )}
        <p className="text-[11px] text-gray-400 mt-2">Tip: en Drive, compartí la carpeta como “Cualquier persona con el enlace” para que se vea sin permisos.</p>
      </div>

      {/* Modo IA conversacional */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={ia.activo} onChange={e => setIa({ ...ia, activo: e.target.checked })} className="accent-emerald-600" />
          <span className="text-sm font-medium text-gray-800">🤖 Modo IA conversacional</span>
        </label>
        <p className="text-xs text-gray-500 mt-1 mb-3">Cuando el cliente escribe algo que no cae en un flujo, en vez de repetir el menú la IA responde con contexto (historial + info del negocio). No inventa precios y ofrece derivar a una persona.</p>

        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-gray-500">Nombre del asistente</label>
            <input value={ia.nombre} onChange={e => setIa({ ...ia, nombre: e.target.value })}
              placeholder="Ej: Sofi"
              className="w-full mt-1 text-sm border rounded-xl px-3 py-2 outline-none" />
            <p className="text-[11px] text-gray-400 mt-1">Se presenta como asistente cálido con ese nombre (sin fingir ser una persona real).</p>
          </div>
          <label className="flex items-start gap-2 text-sm text-gray-700 mt-5">
            <input type="checkbox" checked={ia.demora} onChange={e => setIa({ ...ia, demora: e.target.checked })} className="accent-emerald-600 mt-0.5" />
            <span>Demora “escribiendo…”<br /><span className="text-[11px] text-gray-400">Espera unos segundos y muestra que está escribiendo, en vez de responder al instante.</span></span>
          </label>
        </div>

        <label className="text-xs text-gray-500">Instrucciones / tono (opcional)</label>
        <textarea value={ia.instrucciones} onChange={e => setIa({ ...ia, instrucciones: e.target.value })} rows={3}
          placeholder="Ej: Sé breve y amable. Tuteá con voseo. Sugerí el mate imperial cuando pregunten por regalos."
          className="w-full mt-1 text-sm border rounded-xl px-3 py-2 outline-none resize-y" />
        <div className="flex items-center gap-3 mt-3">
          <button onClick={guardarIA} className="bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-xl">Guardar</button>
          {iaGuardado && <span className="text-xs text-gray-500">{iaGuardado}</span>}
        </div>
        <p className="text-[11px] text-gray-400 mt-2">Requiere tener configurada la IA en Admin → Inteligencia Artificial.</p>
      </div>

      {/* Plantilla de abordaje (API) */}
      <div className="bg-white rounded-2xl border border-amber-200 p-4">
        <p className="text-sm font-medium text-gray-800 mb-1">📤 Abordaje en frío (plantilla de la API)</p>
        <p className="text-xs text-gray-500 mb-3">
          Para escribirle a un prospecto que nunca te escribió, Meta exige una <b>plantilla aprobada</b>.
          Creala en Meta Business Manager con <b>una variable</b> {"{{1}}"} (el nombre del negocio) y pegá acá su nombre exacto e idioma.
          Configurá una plantilla por <b>segmento</b>: al abordar elegís cuál mandar.
        </p>
        <div className="space-y-3">
          {TIPOS_PL.map(({ clave, etiqueta, ayuda }) => (
            <div key={clave}>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-xs font-semibold text-gray-700">{etiqueta}</span>
                <span className="text-[11px] text-gray-400">{ayuda}</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input value={plantillas[clave]?.nombre ?? ""}
                  onChange={e => setPlantillas({ ...plantillas, [clave]: { ...plantillas[clave], nombre: e.target.value } })}
                  placeholder="Nombre de la plantilla"
                  className="flex-1 text-sm border rounded-xl px-3 py-2 outline-none" />
                <input value={plantillas[clave]?.idioma ?? "es_AR"}
                  onChange={e => setPlantillas({ ...plantillas, [clave]: { ...plantillas[clave], idioma: e.target.value } })}
                  placeholder="es_AR"
                  className="sm:w-24 text-sm border rounded-xl px-3 py-2 outline-none" />
              </div>
            </div>
          ))}
          <button onClick={guardarPlantilla}
            className="bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-xl">Guardar plantillas</button>
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
