"use client";

import { useEffect, useState } from "react";
import { Users, UserPlus, Trash2, Save } from "lucide-react";

interface Usuario {
  id: number; email: string; nombre: string | null; rol: string; activo: boolean; created_at: string;
}

const ROLES = [
  { clave: "admin", label: "Administrador", ayuda: "Acceso total al panel." },
  { clave: "deposito", label: "Depósito", ayuda: "Solo ve la sección Depósito (sin precios ni clientes)." },
];
const ROL_LABEL: Record<string, string> = { admin: "Administrador", deposito: "Depósito" };

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [msg, setMsg] = useState("");

  // Alta
  const [nuevo, setNuevo] = useState({ email: "", nombre: "", password: "", rol: "deposito" });
  const [creando, setCreando] = useState(false);

  async function cargar() {
    setCargando(true);
    const r = await fetch("/api/usuarios");
    const d = await r.json().catch(() => ({}));
    setUsuarios(d.usuarios ?? []);
    setCargando(false);
  }
  useEffect(() => { cargar(); }, []);

  async function crear() {
    setMsg(""); setCreando(true);
    const r = await fetch("/api/usuarios", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nuevo),
    });
    setCreando(false);
    const d = await r.json().catch(() => ({}));
    if (r.ok) { setNuevo({ email: "", nombre: "", password: "", rol: "deposito" }); setMsg("✅ Usuario creado"); cargar(); }
    else setMsg(`Error: ${d.error ?? r.status}`);
  }

  async function actualizar(id: number, cambios: Partial<Usuario> & { password?: string }) {
    const r = await fetch("/api/usuarios", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...cambios }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { setMsg("✅ Guardado"); cargar(); } else setMsg(`Error: ${d.error ?? r.status}`);
  }

  async function eliminar(id: number, email: string) {
    if (!confirm(`Eliminar al usuario ${email}? No se puede deshacer.`)) return;
    const r = await fetch("/api/usuarios", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
    });
    if (r.ok) { setMsg("Usuario eliminado"); cargar(); }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Users className="text-emerald-600" size={22} />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Usuarios y roles</h1>
          <p className="text-sm text-gray-500">Creá accesos para tu equipo. El administrador principal (por variables) sigue existiendo aparte.</p>
        </div>
      </div>

      {msg && <p className="text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">{msg}</p>}

      {/* Alta de usuario */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <p className="text-sm font-medium text-gray-800 mb-3 flex items-center gap-2"><UserPlus size={16} /> Nuevo usuario</p>
        <div className="grid sm:grid-cols-2 gap-2">
          <input value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })}
            placeholder="Nombre" className="text-sm border rounded-xl px-3 py-2 outline-none" />
          <input value={nuevo.email} onChange={e => setNuevo({ ...nuevo, email: e.target.value })}
            placeholder="Email" type="email" className="text-sm border rounded-xl px-3 py-2 outline-none" />
          <input value={nuevo.password} onChange={e => setNuevo({ ...nuevo, password: e.target.value })}
            placeholder="Contraseña (mín. 6)" type="text" className="text-sm border rounded-xl px-3 py-2 outline-none" />
          <select value={nuevo.rol} onChange={e => setNuevo({ ...nuevo, rol: e.target.value })}
            className="text-sm border rounded-xl px-3 py-2 outline-none bg-white">
            {ROLES.map(r => <option key={r.clave} value={r.clave}>{r.label}</option>)}
          </select>
        </div>
        <p className="text-xs text-gray-400 mt-2">{ROLES.find(r => r.clave === nuevo.rol)?.ayuda}</p>
        <button onClick={crear} disabled={creando}
          className="mt-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl">
          {creando ? "Creando..." : "Crear usuario"}
        </button>
      </div>

      {/* Listado */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {cargando ? (
          <p className="text-sm text-gray-400 p-4">Cargando...</p>
        ) : usuarios.length === 0 ? (
          <p className="text-sm text-gray-400 p-4">Todavía no hay usuarios. El acceso principal sigue siendo el administrador por variables.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {usuarios.map(u => (
              <FilaUsuario key={u.id} u={u} onActualizar={actualizar} onEliminar={eliminar} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilaUsuario({ u, onActualizar, onEliminar }: {
  u: Usuario;
  onActualizar: (id: number, c: Partial<Usuario> & { password?: string }) => void;
  onEliminar: (id: number, email: string) => void;
}) {
  const [pass, setPass] = useState("");
  return (
    <div className="p-4 flex flex-wrap items-center gap-3">
      <div className="flex-1 min-w-[180px]">
        <p className="text-sm font-medium text-gray-800">{u.nombre || u.email}</p>
        <p className="text-xs text-gray-500">{u.email}</p>
      </div>
      <select value={u.rol} onChange={e => onActualizar(u.id, { rol: e.target.value })}
        className="text-sm border rounded-lg px-2 py-1.5 bg-white">
        <option value="admin">Administrador</option>
        <option value="deposito">Depósito</option>
      </select>
      <label className="text-xs text-gray-500 flex items-center gap-1">
        <input type="checkbox" checked={u.activo} onChange={e => onActualizar(u.id, { activo: e.target.checked })} className="accent-emerald-600" />
        Activo
      </label>
      <div className="flex items-center gap-1">
        <input value={pass} onChange={e => setPass(e.target.value)} placeholder="Nueva contraseña"
          className="text-xs border rounded-lg px-2 py-1.5 w-32 outline-none" />
        <button onClick={() => { if (pass) { onActualizar(u.id, { password: pass }); setPass(""); } }}
          disabled={!pass} title="Cambiar contraseña"
          className="text-gray-500 hover:text-emerald-600 disabled:opacity-30 p-1"><Save size={15} /></button>
      </div>
      <button onClick={() => onEliminar(u.id, u.email)} title="Eliminar"
        className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={15} /></button>
    </div>
  );
}
