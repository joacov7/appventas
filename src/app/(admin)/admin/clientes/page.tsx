"use client";

import { useEffect, useState } from "react";
import { Users, Check, Trash2 } from "lucide-react";

interface Cliente {
  id: number; email: string; nombre: string | null; empresa: string | null; telefono: string | null;
  aprobado: boolean; activo: boolean; created_at: string;
}

export default function ClientesMayoristasPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [msg, setMsg] = useState("");

  async function cargar() {
    setCargando(true);
    const r = await fetch("/api/clientes");
    const d = await r.json().catch(() => ({}));
    setClientes(d.clientes ?? []);
    setCargando(false);
  }
  useEffect(() => { cargar(); }, []);

  async function actualizar(id: number, cambios: Partial<Cliente>) {
    const r = await fetch("/api/clientes", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...cambios }),
    });
    if (r.ok) { setMsg("✅ Guardado"); cargar(); } else setMsg("Error");
  }
  async function eliminar(id: number, email: string) {
    if (!confirm(`Eliminar la cuenta de ${email}?`)) return;
    const r = await fetch("/api/clientes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (r.ok) cargar();
  }

  const pendientes = clientes.filter(c => !c.aprobado);
  const aprobados = clientes.filter(c => c.aprobado);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Users className="text-emerald-600" size={22} />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Clientes mayoristas</h1>
          <p className="text-sm text-gray-500">Aprobá las cuentas nuevas del portal y gestioná los accesos.</p>
        </div>
      </div>
      {msg && <p className="text-sm text-gray-600">{msg}</p>}

      {cargando ? <p className="text-sm text-gray-400">Cargando...</p> : (
        <>
          {pendientes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">Pendientes de aprobación ({pendientes.length})</p>
              <div className="space-y-2">
                {pendientes.map(c => (
                  <div key={c.id} className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-wrap items-center gap-3">
                    <Info c={c} />
                    <button onClick={() => actualizar(c.id, { aprobado: true })}
                      className="ml-auto flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-3 py-1.5 rounded-xl">
                      <Check size={15} /> Aprobar
                    </button>
                    <button onClick={() => eliminar(c.id, c.email)} className="text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Aprobados ({aprobados.length})</p>
            {aprobados.length === 0 ? (
              <p className="text-sm text-gray-400">Todavía no hay clientes aprobados.</p>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
                {aprobados.map(c => (
                  <div key={c.id} className="p-3 flex flex-wrap items-center gap-3">
                    <Info c={c} />
                    <label className="ml-auto text-xs text-gray-500 flex items-center gap-1">
                      <input type="checkbox" checked={c.activo} onChange={e => actualizar(c.id, { activo: e.target.checked })} className="accent-emerald-600" />
                      Activo
                    </label>
                    <button onClick={() => eliminar(c.id, c.email)} className="text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Info({ c }: { c: Cliente }) {
  return (
    <div className="min-w-[180px]">
      <p className="text-sm font-medium text-gray-800">{c.empresa || c.nombre || c.email}</p>
      <p className="text-xs text-gray-500">{c.email}{c.telefono ? ` · ${c.telefono}` : ""}</p>
    </div>
  );
}
