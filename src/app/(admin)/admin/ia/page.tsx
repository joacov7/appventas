"use client";

import { useEffect, useState } from "react";
import { Bot, Check, X, RefreshCw, Zap, Eye, EyeOff, Save } from "lucide-react";

type Prov = {
  enabled: boolean;
  apiKey: string;
  hasKey: boolean;
  model: string;
  modelRapido?: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
};
type Config = { activo: string; debug: boolean; proveedores: Record<string, Prov> };

const META: Record<string, { label: string; desc: string; necesitaUrl?: boolean }> = {
  anthropic: { label: "Anthropic (Claude)", desc: "Modelos Claude. Recomendado por defecto." },
  openai:    { label: "OpenAI (GPT)", desc: "Modelos GPT-4o, GPT-4.1, etc." },
  custom:    { label: "Compatible-OpenAI por URL", desc: "OpenRouter, Ollama, LM Studio o tu propio endpoint.", necesitaUrl: true },
};

export default function IAConfigPage() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState("");
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [probando, setProbando] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/ai-config").then(r => r.json()).then(setCfg);
  }, []);

  function editProv(k: string, campo: keyof Prov, valor: any) {
    setCfg(c => c ? { ...c, proveedores: { ...c.proveedores, [k]: { ...c.proveedores[k], [campo]: valor } } } : c);
  }

  async function guardar() {
    if (!cfg) return;
    setGuardando(true); setMsg("");
    try {
      const r = await fetch("/api/ai-config", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg),
      });
      const data = await r.json();
      if (!r.ok) { setMsg(data.error ?? "Error al guardar"); return; }
      setCfg(data);
      setMsg("✓ Configuración guardada");
    } finally { setGuardando(false); }
  }

  async function probar(k: string) {
    setProbando(k); setTestResult(t => ({ ...t, [k]: "" }));
    // Guardar antes de probar para que el test use lo último
    if (cfg) await fetch("/api/ai-config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) });
    try {
      const r = await fetch("/api/ai-config/test", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proveedor: k }),
      });
      const d = await r.json();
      setTestResult(t => ({
        ...t,
        [k]: d.ok
          ? `✓ Conectado · ${d.model} · ${d.ms}ms${d.costUsd != null ? ` · ~$${d.costUsd.toFixed(5)}` : ""}`
          : `✗ ${d.error}`,
      }));
    } catch {
      setTestResult(t => ({ ...t, [k]: "✗ Error de conexión" }));
    } finally { setProbando(null); }
  }

  if (!cfg) return <p className="text-gray-400 text-sm">Cargando...</p>;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-2">
        <Bot className="text-indigo-600" size={24} />
        <h1 className="text-xl font-bold text-gray-900">Inteligencia Artificial</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Configurá qué proveedor de IA usa el sistema. Podés cambiarlo cuando quieras, sin tocar código.
        Toda la IA de la plataforma (resumen diario, sugeridor de precios, campañas, mensajes) pasa por acá.
      </p>

      {/* Proveedor activo + debug */}
      <div className="bg-white rounded-2xl border p-5 mb-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[220px]">
            <label className="text-sm font-medium text-gray-700">Proveedor activo</label>
            <select value={cfg.activo} onChange={e => setCfg({ ...cfg, activo: e.target.value })}
              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
              {Object.keys(cfg.proveedores).map(k => (
                <option key={k} value={k}>{META[k]?.label ?? k}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 mt-5 cursor-pointer">
            <input type="checkbox" checked={cfg.debug} onChange={e => setCfg({ ...cfg, debug: e.target.checked })}
              className="w-4 h-4 accent-indigo-600" />
            Modo debug (registra las llamadas en los logs)
          </label>
        </div>
      </div>

      {/* Cada proveedor */}
      <div className="space-y-4">
        {Object.entries(cfg.proveedores).map(([k, p]) => {
          const meta = META[k] ?? { label: k, desc: "" };
          const activo = cfg.activo === k;
          return (
            <div key={k} className={`bg-white rounded-2xl border p-5 shadow-sm ${activo ? "ring-2 ring-indigo-200" : ""}`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{meta.label}</h3>
                    {activo && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">Activo</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{meta.desc}</p>
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer shrink-0">
                  <input type="checkbox" checked={p.enabled} onChange={e => editProv(k, "enabled", e.target.checked)}
                    className="w-4 h-4 accent-emerald-600" />
                  {p.enabled ? "Habilitado" : "Deshabilitado"}
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-gray-600">API Key</label>
                  <div className="relative">
                    <input type={showKey[k] ? "text" : "password"}
                      value={p.apiKey}
                      onChange={e => editProv(k, "apiKey", e.target.value)}
                      placeholder={p.hasKey ? "•••• (guardada — dejá así para no cambiarla)" : "Pegá tu API key"}
                      className="mt-1 w-full border rounded-xl px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
                    <button type="button" onClick={() => setShowKey(s => ({ ...s, [k]: !s[k] }))}
                      className="absolute right-3 top-1/2 text-gray-400 hover:text-gray-600">
                      {showKey[k] ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {meta.necesitaUrl !== undefined && (
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-gray-600">URL base {meta.necesitaUrl && "(requerida)"}</label>
                    <input value={p.baseUrl} onChange={e => editProv(k, "baseUrl", e.target.value)}
                      placeholder={k === "custom" ? "https://openrouter.ai/api/v1  ·  http://localhost:11434/v1" : "https://api.openai.com/v1"}
                      className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-gray-600">Modelo</label>
                  <input value={p.model} onChange={e => editProv(k, "model", e.target.value)}
                    placeholder="ej: claude-sonnet-5 / gpt-4o"
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Modelo rápido (opcional)</label>
                  <input value={p.modelRapido ?? ""} onChange={e => editProv(k, "modelRapido", e.target.value)}
                    placeholder="para tareas simples/baratas"
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Temperatura</label>
                  <input type="number" step="0.1" min="0" max="2" value={p.temperature}
                    onChange={e => editProv(k, "temperature", Number(e.target.value))}
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Max tokens</label>
                  <input type="number" min="1" value={p.maxTokens}
                    onChange={e => editProv(k, "maxTokens", Number(e.target.value))}
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Timeout (ms)</label>
                  <input type="number" min="1000" step="1000" value={p.timeout}
                    onChange={e => editProv(k, "timeout", Number(e.target.value))}
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              <div className="flex items-center gap-3 mt-4">
                <button onClick={() => probar(k)} disabled={probando !== null}
                  className="flex items-center gap-1.5 text-sm bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white px-4 py-2 rounded-xl font-medium">
                  {probando === k ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
                  Probar conexión
                </button>
                {testResult[k] && (
                  <span className={`text-sm ${testResult[k].startsWith("✓") ? "text-emerald-600" : "text-red-600"}`}>
                    {testResult[k]}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Guardar */}
      <div className="flex items-center gap-4 mt-6 sticky bottom-4">
        <button onClick={guardar} disabled={guardando}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-medium shadow-lg">
          {guardando ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
          Guardar configuración
        </button>
        {msg && <span className={`text-sm ${msg.startsWith("✓") ? "text-emerald-600" : "text-red-600"}`}>{msg}</span>}
      </div>
    </div>
  );
}
