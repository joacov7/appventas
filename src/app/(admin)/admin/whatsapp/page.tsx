"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Users, ArrowDownLeft, ArrowUpRight, RefreshCw, ExternalLink } from "lucide-react";

interface Mensaje {
  id: number;
  wa_id: string;
  direccion: "entrante" | "saliente";
  texto: string;
  creado_en: string;
}

interface Stats {
  conversaciones: number;
  entrantes: number;
  salientes: number;
}

const SETUP_STEPS = [
  {
    n: 1,
    title: "Crear app en Meta for Developers",
    desc: "Ir a developers.facebook.com → Create App → Business → agregar producto WhatsApp.",
    link: "https://developers.facebook.com",
  },
  {
    n: 2,
    title: "Obtener credenciales",
    desc: "En WhatsApp → API Setup: copiá el Access Token temporal y el Phone Number ID.",
    link: null,
  },
  {
    n: 3,
    title: "Configurar env vars en Vercel",
    desc: "Agregar en Settings → Environment Variables:",
    code: `WHATSAPP_ACCESS_TOKEN=<tu_token>\nWHATSAPP_PHONE_NUMBER_ID=<tu_phone_id>\nWHATSAPP_VERIFY_TOKEN=<cualquier_string_secreto>`,
  },
  {
    n: 4,
    title: "Registrar el webhook",
    desc: "En Meta → WhatsApp → Configuration → Webhook:",
    code: `URL: https://tudominio.vercel.app/api/whatsapp/webhook\nVerify Token: (el mismo que WHATSAPP_VERIFY_TOKEN)\nSuscribir a: messages`,
  },
  {
    n: 5,
    title: "Agregar número de prueba",
    desc: "En WhatsApp → API Setup agregá tu número como recipient de prueba para testear antes de producción.",
    link: null,
  },
];

export default function WhatsAppBotPage() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [stats, setStats] = useState<Stats>({ conversaciones: 0, entrantes: 0, salientes: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"historial" | "config">("historial");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/whatsapp/historial");
    const data = await res.json();
    setMensajes(data.mensajes ?? []);
    setStats(data.stats ?? { conversaciones: 0, entrantes: 0, salientes: 0 });
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Group messages by wa_id for conversation view
  const byContact = mensajes.reduce<Record<string, Mensaje[]>>((acc, m) => {
    if (!acc[m.wa_id]) acc[m.wa_id] = [];
    acc[m.wa_id].push(m);
    return acc;
  }, {});

  const contacts = Object.entries(byContact).slice(0, 20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageCircle size={22} className="text-emerald-600" />
          <h1 className="text-2xl font-bold text-gray-900">Bot de WhatsApp</h1>
        </div>
        <button onClick={load} className="p-2 text-gray-400 hover:text-gray-600">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(["historial", "config"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "historial" ? "Historial" : "Configuración"}
          </button>
        ))}
      </div>

      {tab === "historial" && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600"><Users size={20} /></div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.conversaciones}</p>
                <p className="text-xs text-gray-500">Conversaciones</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-50 text-blue-600"><ArrowDownLeft size={20} /></div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.entrantes}</p>
                <p className="text-xs text-gray-500">Mensajes recibidos</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-violet-50 text-violet-600"><ArrowUpRight size={20} /></div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.salientes}</p>
                <p className="text-xs text-gray-500">Respuestas enviadas</p>
              </div>
            </div>
          </div>

          {/* Conversations */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50">
              <span className="text-sm font-semibold text-gray-700">Conversaciones recientes</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : contacts.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-16">
                Sin conversaciones aún. Configurá el bot y empezá a recibir mensajes.
              </p>
            ) : (
              <div className="divide-y divide-gray-50">
                {contacts.map(([waId, msgs]) => {
                  const last = msgs[0];
                  return (
                    <details key={waId} className="group">
                      <summary className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50 list-none">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs shrink-0">
                          {waId.slice(-2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">+{waId}</p>
                          <p className="text-xs text-gray-400 truncate">{last.texto.slice(0, 60)}{last.texto.length > 60 ? "…" : ""}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-gray-400">{new Date(last.creado_en).toLocaleDateString("es-AR")}</p>
                          <p className="text-xs text-gray-300">{msgs.length} msgs</p>
                        </div>
                      </summary>
                      <div className="px-5 pb-4 space-y-2 bg-gray-50">
                        {[...msgs].reverse().map((m) => (
                          <div
                            key={m.id}
                            className={`flex ${m.direccion === "saliente" ? "justify-end" : "justify-start"}`}
                          >
                            <div className={`max-w-xs px-3 py-2 rounded-xl text-xs ${
                              m.direccion === "saliente"
                                ? "bg-emerald-600 text-white"
                                : "bg-white border border-gray-200 text-gray-800"
                            }`}>
                              <p className="whitespace-pre-wrap">{m.texto}</p>
                              <p className={`text-[10px] mt-1 ${m.direccion === "saliente" ? "text-emerald-200" : "text-gray-400"}`}>
                                {new Date(m.creado_en).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {tab === "config" && (
        <div className="space-y-4 max-w-2xl">
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700">
            El bot usa <strong>Meta WhatsApp Cloud API</strong> (gratuito). Seguí los pasos para activarlo.
          </div>

          <div className="bg-gray-900 rounded-xl px-4 py-3 font-mono text-xs text-emerald-400 space-y-1">
            <p className="text-gray-500"># Comandos que entiende el bot:</p>
            <p>hola / hey / buenos días → menú principal</p>
            <p>1 / catalogo → lista de productos con precios y links</p>
            <p>2 / precio [producto] → búsqueda de precio</p>
            <p>3 / ayuda → mensaje para hablar con humano</p>
            <p>[nombre de producto] → búsqueda directa</p>
            <p>comprar / pedido → link al checkout</p>
            <p>horario → horario de atención</p>
          </div>

          {SETUP_STEPS.map((step) => (
            <div key={step.n} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {step.n}
                </span>
                <h3 className="font-semibold text-gray-900 text-sm">{step.title}</h3>
                {step.link && (
                  <a href={step.link} target="_blank" rel="noopener noreferrer" className="ml-auto text-gray-400 hover:text-emerald-600">
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
              <p className="text-sm text-gray-500 ml-9">{step.desc}</p>
              {"code" in step && step.code && (
                <pre className="ml-9 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-xs font-mono text-gray-700 whitespace-pre-wrap">{step.code}</pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
