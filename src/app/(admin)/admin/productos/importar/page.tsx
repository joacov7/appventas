"use client";

import { useState } from "react";
import { Upload, FileText, Check, AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Fila { codigo: string; nombre: string; precio: string }

// Parser CSV simple (soporta comas dentro de comillas).
function parseCSV(texto: string): string[][] {
  const filas: string[][] = [];
  let campo = "", fila: string[] = [], enComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') enComillas = false;
      else campo += c;
    } else {
      if (c === '"') enComillas = true;
      else if (c === ",") { fila.push(campo); campo = ""; }
      else if (c === "\n") { fila.push(campo); filas.push(fila); fila = []; campo = ""; }
      else if (c === "\r") { /* ignora */ }
      else campo += c;
    }
  }
  if (campo.length || fila.length) { fila.push(campo); filas.push(fila); }
  return filas.filter(f => f.some(x => x.trim() !== ""));
}

export default function ImportarProductosPage() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [canal, setCanal] = useState<"minorista" | "mayorista">("mayorista");
  const [importando, setImportando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [resultado, setResultado] = useState<{ creados: number; actualizados: number; omitidos: number; errores: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function procesarTexto(texto: string) {
    setError(null); setResultado(null);
    const rows = parseCSV(texto);
    if (rows.length < 2) { setError("El archivo no tiene datos suficientes."); return; }

    // Detectar columnas por encabezado.
    const header = rows[0].map(h => h.toLowerCase().trim());
    let idxNombre = header.findIndex(h => h.includes("nombre") || h.includes("producto") || h.includes("descrip"));
    let idxPrecio = header.findIndex(h => h.includes("venta") || h.includes("precio") || h.includes("$"));
    let idxCodigo = header.findIndex(h => h.includes("codigo") || h.includes("código") || h.includes("cod") || h.includes("sku"));
    // Si no hay encabezado de código, usamos la primera columna.
    if (idxCodigo === -1) idxCodigo = 0;
    if (idxNombre === -1) idxNombre = header.length > 1 ? 1 : 0;
    if (idxPrecio === -1) idxPrecio = 2;

    const datos: Fila[] = rows.slice(1).map(r => ({
      codigo: (r[idxCodigo] ?? "").trim(),
      nombre: (r[idxNombre] ?? "").trim(),
      precio: (r[idxPrecio] ?? "").trim(),
    })).filter(f => f.nombre);

    if (datos.length === 0) { setError("No detecté productos. ¿La primera fila son los títulos de columnas?"); return; }
    setFilas(datos);
  }

  function onFile(file: File) {
    setNombreArchivo(file.name);
    const reader = new FileReader();
    reader.onload = () => procesarTexto(String(reader.result));
    reader.readAsText(file, "utf-8");
  }

  async function importar() {
    if (!filas.length) return;
    setImportando(true); setProgreso(0); setResultado(null);
    const CHUNK = 50;
    const acum = { creados: 0, actualizados: 0, omitidos: 0, errores: [] as string[] };
    for (let i = 0; i < filas.length; i += CHUNK) {
      const lote = filas.slice(i, i + CHUNK);
      try {
        const r = await fetch("/api/productos/importar", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filas: lote, canal }),
        });
        const d = await r.json();
        if (r.ok) {
          acum.creados += d.creados ?? 0;
          acum.actualizados += d.actualizados ?? 0;
          acum.omitidos += d.omitidos ?? 0;
          if (d.errores?.length) acum.errores.push(...d.errores);
        } else acum.errores.push(d.error ?? "Error en un lote");
      } catch { acum.errores.push("Error de conexión en un lote"); }
      setProgreso(Math.min(filas.length, i + CHUNK));
    }
    setImportando(false);
    setResultado(acum);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="text-indigo-600" size={24} />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Importar productos</h1>
          <p className="text-sm text-gray-500">Subí tu lista de precios (CSV) y carga todo el catálogo de una.</p>
        </div>
        <Link href="/admin/productos" className="ml-auto flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft size={15} /> Productos</Link>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-sm text-indigo-900 space-y-1">
        <p className="font-medium">Cómo exportar tu planilla:</p>
        <p>En Google Sheets/Excel → <b>Archivo → Descargar → CSV</b> (valores separados por comas). Después subí ese archivo acá.</p>
        <p className="text-xs">Detecto solas las columnas <b>Nombre</b>, <b>Precio/Ventas</b> y <b>Código</b>. Cada fila se crea como un producto (las fotos las agregás después).</p>
      </div>

      <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-2xl p-8 cursor-pointer hover:bg-gray-50">
        <Upload size={26} className="text-gray-400" />
        <span className="text-sm text-gray-600">{nombreArchivo || "Elegí tu archivo CSV"}</span>
        <input type="file" accept=".csv,.txt,text/csv" className="hidden" onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>

      {error && <div className="bg-amber-50 text-amber-700 text-sm rounded-xl p-3 flex items-center gap-2"><AlertTriangle size={15} /> {error}</div>}

      {filas.length > 0 && !resultado && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm text-gray-700 mb-3">Detecté <b>{filas.length} productos</b>. Vista previa:</p>

          <div className="mb-3">
            <label className="text-xs text-gray-500">El precio de la planilla es:</label>
            <div className="grid grid-cols-2 gap-2 mt-1 max-w-xs">
              {(["mayorista", "minorista"] as const).map(c => (
                <button key={c} onClick={() => setCanal(c)}
                  className={`text-sm py-2 rounded-lg border ${canal === c ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600"}`}>
                  {c === "mayorista" ? "Mayorista (B2B)" : "Minorista (B2C)"}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-400 border-b">
                <th className="py-1 pr-3">Código</th><th className="py-1 pr-3">Nombre</th><th className="py-1 text-right">Precio</th>
              </tr></thead>
              <tbody>
                {filas.slice(0, 8).map((f, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1 pr-3 text-gray-500">{f.codigo}</td>
                    <td className="py-1 pr-3 text-gray-800">{f.nombre}</td>
                    <td className="py-1 text-right text-gray-800">{f.precio}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filas.length > 8 && <p className="text-xs text-gray-400 mt-2">…y {filas.length - 8} más.</p>}

          <button onClick={importar} disabled={importando}
            className="w-full mt-4 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-3 rounded-xl">
            {importando ? `Importando... ${progreso}/${filas.length}` : `Importar ${filas.length} productos`}
          </button>
          {importando && (
            <div className="w-full h-2 bg-gray-100 rounded-full mt-3 overflow-hidden">
              <div className="h-full bg-indigo-600 transition-all" style={{ width: `${(progreso / filas.length) * 100}%` }} />
            </div>
          )}
        </div>
      )}

      {resultado && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-2">
          <div className="flex items-center gap-2 text-emerald-600"><Check size={20} /> <span className="font-semibold">Importación terminada</span></div>
          <p className="text-sm text-gray-700">✅ Creados: <b>{resultado.creados}</b> · 🔄 Actualizados: <b>{resultado.actualizados}</b>{resultado.omitidos > 0 && <> · Omitidos: {resultado.omitidos}</>}</p>
          {resultado.errores.length > 0 && (
            <details className="text-xs text-amber-600">
              <summary className="cursor-pointer">Errores ({resultado.errores.length})</summary>
              <ul className="mt-1 space-y-0.5">{resultado.errores.map((e, i) => <li key={i}>• {e}</li>)}</ul>
            </details>
          )}
          <div className="border-t pt-3 mt-3 text-sm text-gray-600">
            <p>Ahora, desde <b>Productos</b> podés <b>clasificar por rubro</b> y <b>calcular los precios minoristas</b> (mayorista + %) con las herramientas del catálogo.</p>
          </div>

          <Link href="/admin/productos" className="inline-block text-sm text-indigo-600 hover:underline mt-2">Ir a Productos →</Link>
        </div>
      )}
    </div>
  );
}
