"use client";

import { useState, useMemo } from "react";
import { Calculator, Info } from "lucide-react";
import { ProductoPickerML } from "@/components/admin/ProductoPickerML";

const money = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(Math.round(n || 0));

// Comisiones por defecto (Argentina, aprox.). Editables por si cambian o según categoría.
const COMISION_DEFAULT = { clasica: 13, premium: 18 };

export default function CalculadoraMLPage() {
  const [modo, setModo] = useState<"precio" | "ganancia">("precio");
  const [costo, setCosto] = useState(0);
  const [margen, setMargen] = useState(40);       // % ganancia deseada (modo precio)
  const [precioVenta, setPrecioVenta] = useState(0); // precio publicado (modo ganancia)
  const [tipo, setTipo] = useState<"clasica" | "premium">("clasica");
  const [comision, setComision] = useState(COMISION_DEFAULT.clasica);
  const [otrosPct, setOtrosPct] = useState(0);     // impuestos u otros costos %
  const [envioGratis, setEnvioGratis] = useState(false);
  const [costoEnvio, setCostoEnvio] = useState(0);
  const [umbralFijo, setUmbralFijo] = useState(15000);
  const [cargoFijo, setCargoFijo] = useState(1100);
  const [avanzado, setAvanzado] = useState(false);

  function cambiarTipo(t: "clasica" | "premium") { setTipo(t); setComision(COMISION_DEFAULT[t]); }

  const r = useMemo(() => {
    const envio = envioGratis ? costoEnvio : 0;
    const pct = (comision + otrosPct) / 100;
    let P: number;
    let fijo = 0;

    if (modo === "precio") {
      const objetivoNeto = costo * (1 + margen / 100);
      P = (objetivoNeto + envio) / (1 - pct);
      if (P < umbralFijo) { fijo = cargoFijo; P = (objetivoNeto + envio + cargoFijo) / (1 - pct); }
    } else {
      P = precioVenta;
      fijo = P > 0 && P < umbralFijo ? cargoFijo : 0;
    }

    const comisionMonto = P * (comision / 100);
    const otrosMonto = P * (otrosPct / 100);
    const neto = P - comisionMonto - otrosMonto - fijo - envio;
    const ganancia = neto - costo;
    const margenReal = costo > 0 ? (ganancia / costo) * 100 : 0;
    return { P, comisionMonto, otrosMonto, fijo, envio, neto, ganancia, margenReal };
  }, [modo, costo, margen, precioVenta, comision, otrosPct, envioGratis, costoEnvio, umbralFijo, cargoFijo]);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Calculator className="text-yellow-500" size={22} />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Calculadora Mercado Libre</h1>
          <p className="text-sm text-gray-500">Calculá a qué precio publicar (o cuánto te queda) contemplando la comisión de ML.</p>
        </div>
      </div>

      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-fit">
        {([["precio", "Precio de venta"], ["ganancia", "Ganancia"]] as [typeof modo, string][]).map(([m, l]) => (
          <button key={m} onClick={() => setModo(m)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium ${modo === m ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>{l}</button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Entradas */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <div>
            <label className="text-xs text-gray-500">Traer del catálogo (opcional)</label>
            <div className="mt-1"><ProductoPickerML onSelect={p => setCosto(p.costo)} /></div>
          </div>
          <Campo label="Tu costo del producto" value={costo} onChange={setCosto} prefix="$" />
          {modo === "precio"
            ? <Campo label="Ganancia que querés (%)" value={margen} onChange={setMargen} suffix="%" />
            : <Campo label="Precio publicado en ML" value={precioVenta} onChange={setPrecioVenta} prefix="$" />}

          <div>
            <label className="text-xs text-gray-500">Tipo de publicación</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {([["clasica", "Clásica"], ["premium", "Premium (cuotas)"]] as [typeof tipo, string][]).map(([t, l]) => (
                <button key={t} onClick={() => cambiarTipo(t)}
                  className={`text-sm py-2 rounded-lg border ${tipo === t ? "bg-yellow-400 border-yellow-400 text-gray-900 font-medium" : "bg-white text-gray-600"}`}>{l}</button>
              ))}
            </div>
          </div>

          <Campo label="Comisión de ML (%)" value={comision} onChange={setComision} suffix="%" hint="Preseleccionada según el tipo. Ajustala según tu categoría." />

          <div className="border-t pt-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={envioGratis} onChange={e => setEnvioGratis(e.target.checked)} className="accent-yellow-500" />
              Ofrezco envío gratis (lo pago yo)
            </label>
            {envioGratis && <div className="mt-2"><Campo label="Costo del envío que absorbés" value={costoEnvio} onChange={setCostoEnvio} prefix="$" /></div>}
          </div>

          <button onClick={() => setAvanzado(a => !a)} className="text-xs text-gray-500 hover:text-gray-800">
            {avanzado ? "− Ocultar" : "+ Opciones avanzadas"}
          </button>
          {avanzado && (
            <div className="space-y-3 border-t pt-3">
              <Campo label="Otros costos / impuestos (%)" value={otrosPct} onChange={setOtrosPct} suffix="%" />
              <Campo label="Cargo fijo por venta (precio bajo)" value={cargoFijo} onChange={setCargoFijo} prefix="$" />
              <Campo label="Se aplica si el precio es menor a" value={umbralFijo} onChange={setUmbralFijo} prefix="$" />
              <p className="text-[11px] text-gray-400 flex gap-1"><Info size={13} className="shrink-0 mt-0.5" /> ML cobra un cargo fijo en productos de precio bajo. Los valores son aproximados; ajustalos según lo que veas en tu cuenta.</p>
            </div>
          )}
        </div>

        {/* Resultado */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 h-fit">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
            <p className="text-xs text-gray-500">{modo === "precio" ? "Publicá a" : "Te queda limpio"}</p>
            <p className="text-3xl font-bold text-gray-900">{money(modo === "precio" ? r.P : r.ganancia)}</p>
            {modo === "precio" && <p className="text-xs text-gray-500 mt-1">Ganancia: <b>{money(r.ganancia)}</b> ({r.margenReal.toFixed(0)}%)</p>}
            {modo === "ganancia" && <p className="text-xs text-gray-500 mt-1">Margen sobre el costo: <b>{r.margenReal.toFixed(0)}%</b></p>}
          </div>

          <div className="text-sm space-y-1.5">
            <Fila label={modo === "precio" ? "Precio de publicación" : "Precio publicado"} value={money(r.P)} strong />
            <Fila label={`Comisión ML (${comision}%)`} value={`− ${money(r.comisionMonto)}`} rojo />
            {r.otrosMonto > 0 && <Fila label={`Otros / impuestos (${otrosPct}%)`} value={`− ${money(r.otrosMonto)}`} rojo />}
            {r.fijo > 0 && <Fila label="Cargo fijo" value={`− ${money(r.fijo)}`} rojo />}
            {r.envio > 0 && <Fila label="Envío que absorbés" value={`− ${money(r.envio)}`} rojo />}
            <div className="border-t my-1" />
            <Fila label="Neto que recibís" value={money(r.neto)} strong />
            <Fila label="Tu costo" value={`− ${money(costo)}`} rojo />
            <div className="border-t my-1" />
            <Fila label="Ganancia" value={money(r.ganancia)} strong verde={r.ganancia >= 0} rojo={r.ganancia < 0} />
          </div>
          {r.ganancia < 0 && <p className="text-xs text-red-500">⚠️ A este precio perdés plata. Subí el precio o revisá los costos.</p>}
        </div>
      </div>
    </div>
  );
}

function Campo({ label, value, onChange, prefix, suffix, hint }: {
  label: string; value: number; onChange: (n: number) => void; prefix?: string; suffix?: string; hint?: string;
}) {
  return (
    <div>
      <label className="text-xs text-gray-500">{label}</label>
      <div className="flex items-center gap-1 mt-1">
        {prefix && <span className="text-sm text-gray-400">{prefix}</span>}
        <input type="number" value={value === 0 ? "" : value} placeholder="0"
          onChange={e => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="w-full text-sm border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-yellow-300" />
        {suffix && <span className="text-sm text-gray-400">{suffix}</span>}
      </div>
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function Fila({ label, value, strong, rojo, verde }: { label: string; value: string; strong?: boolean; rojo?: boolean; verde?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={`${strong ? "text-gray-800 font-medium" : "text-gray-500"}`}>{label}</span>
      <span className={`${verde ? "text-emerald-600 font-semibold" : rojo ? "text-red-500" : strong ? "text-gray-900 font-semibold" : "text-gray-700"}`}>{value}</span>
    </div>
  );
}
