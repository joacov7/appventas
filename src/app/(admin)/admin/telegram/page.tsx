"use client";

import { useEffect, useState } from "react";
import { Send, Check, Bell } from "lucide-react";

export default function TelegramPage() {
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [configurado, setConfigurado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [probando, setProbando] = useState(false);

  async function load() {
    const r = await fetch("/api/telegram-config");
    if (r.ok) {
      const d = await r.json();
      setBotToken(d.botToken); setChatId(d.chatId); setConfigurado(d.configurado);
    }
  }
  useEffect(() => { load(); }, []);

  async function guardar() {
    setGuardando(true); setMsg(null);
    const r = await fetch("/api/telegram-config", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ botToken, chatId }),
    });
    setGuardando(false);
    if (r.ok) { setMsg("Guardado ✓"); load(); } else setMsg((await r.json()).error ?? "Error");
  }
  async function probar() {
    setProbando(true); setMsg(null);
    const r = await fetch("/api/telegram-config", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ test: true }),
    });
    setProbando(false);
    const d = await r.json();
    setMsg(d.ok ? "📨 Te mandé un mensaje de prueba a Telegram. ¿Te llegó?" : "No se pudo enviar. Revisá el token y el Chat ID.");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Bell className="text-indigo-600" size={24} />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Avisos por Telegram</h1>
          <p className="text-sm text-gray-500">Recibí un aviso al instante cada vez que un cliente te escribe por WhatsApp.</p>
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-sm text-indigo-900 space-y-1.5">
        <p className="font-medium">Cómo obtener los datos (2 minutos):</p>
        <p>1. En Telegram, abrí <b>@BotFather</b> → escribí <b>/newbot</b> → seguí los pasos → te da un <b>Token</b>.</p>
        <p>2. Abrí <b>@userinfobot</b> → te dice tu <b>Chat ID</b> (un número).</p>
        <p>3. Pegá los dos acá abajo, guardá y tocá “Enviar prueba”.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div>
          <label className="text-xs text-gray-500">Bot Token</label>
          <input value={botToken} onChange={e => setBotToken(e.target.value)} placeholder="123456:ABC-..."
            className="w-full mt-1 text-sm border rounded-lg px-3 py-2 outline-none font-mono" />
        </div>
        <div>
          <label className="text-xs text-gray-500">Chat ID</label>
          <input value={chatId} onChange={e => setChatId(e.target.value)} placeholder="123456789"
            className="w-full mt-1 text-sm border rounded-lg px-3 py-2 outline-none font-mono" />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={guardar} disabled={guardando}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl">
            <Check size={16} /> {guardando ? "Guardando..." : "Guardar"}
          </button>
          <button onClick={probar} disabled={probando || !configurado}
            className="flex items-center gap-1.5 border text-gray-700 hover:bg-gray-50 disabled:opacity-50 text-sm font-medium px-4 py-2 rounded-xl">
            <Send size={15} /> {probando ? "Enviando..." : "Enviar prueba"}
          </button>
          {configurado && <span className="text-xs text-emerald-600 flex items-center gap-1"><Check size={13} /> Configurado</span>}
        </div>
        {msg && <p className="text-sm text-gray-600">{msg}</p>}
      </div>
    </div>
  );
}
