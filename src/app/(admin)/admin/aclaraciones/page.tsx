"use client";

import { useEffect, useState } from "react";
import { Info, Plus, Trash2, ArrowUp, ArrowDown, Save } from "lucide-react";

interface Item { titulo: string; texto: string }

export default function AclaracionesPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/aclaraciones").then(r => r.json()).then(d => { setItems(d.items ?? []); setCargando(false); }).catch(() => setCargando(false));
  }, []);

  function set(i: number, campo: keyof Item, valor: string) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [campo]: valor } : it));
  }
  function agregar() { setItems(prev => [...prev, { titulo: "", texto: "" }]); }
  function eliminar(i: number) { setItems(prev => prev.filter((_, idx) => idx !== i)); }
  function mover(i: number, dir: -1 | 1) {
    setItems(prev => {
      const n = [...prev]; const j = i + dir;
      if (j < 0 || j >= n.length) return prev;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  }

  async function guardar() {
    setGuardando(true); setMsg("");
    const r = await fetch("/api/aclaraciones", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }),
    });
    setGuardando(false);
    setMsg(r.ok ? "✅ Guardado" : "Error al guardar");
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Info className="text-emerald-600" size={22} />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Aclaraciones y condiciones</h1>
          <p className="text-sm text-gray-500">Se muestran en el catálogo, el portal y el checkout, y el bot puede enviarlas.</p>
        </div>
      </div>

      {cargando ? <p className="text-sm text-gray-400">Cargando...</p> : (
        <>
          <div className="space-y-3">
            {items.map((it, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <input value={it.titulo} onChange={e => set(i, "titulo", e.target.value)}
                    placeholder="Título (ej: Garantía)" className="flex-1 text-sm font-medium border rounded-lg px-3 py-2 outline-none" />
                  <button onClick={() => mover(i, -1)} disabled={i === 0} className="text-gray-300 hover:text-gray-600 disabled:opacity-30"><ArrowUp size={16} /></button>
                  <button onClick={() => mover(i, 1)} disabled={i === items.length - 1} className="text-gray-300 hover:text-gray-600 disabled:opacity-30"><ArrowDown size={16} /></button>
                  <button onClick={() => eliminar(i)} className="text-gray-300 hover:text-red-500"><Trash2 size={16} /></button>
                </div>
                <textarea value={it.texto} onChange={e => set(i, "texto", e.target.value)} rows={3}
                  placeholder="Texto de la aclaración…" className="w-full text-sm border rounded-lg px-3 py-2 outline-none resize-y" />
              </div>
            ))}
          </div>

          <button onClick={agregar} className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-800 font-medium">
            <Plus size={16} /> Agregar aclaración
          </button>

          <div className="flex items-center gap-3 sticky bottom-4 bg-white/80 backdrop-blur rounded-xl p-2">
            <button onClick={guardar} disabled={guardando}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl">
              <Save size={16} /> {guardando ? "Guardando..." : "Guardar cambios"}
            </button>
            {msg && <span className="text-sm text-gray-600">{msg}</span>}
          </div>
        </>
      )}
    </div>
  );
}
