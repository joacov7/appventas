"use client";

import Link from "next/link";
import { ArrowLeft, ScrollText, Cpu, ShieldCheck, Clock, DollarSign, Eye } from "lucide-react";

type Tool = { name: string; write?: boolean };
type Agente = { nombre: string; rol: string; obj: string; ia: boolean; tools: Tool[] };

const AGENTES: Agente[] = [
  { nombre: "CEO", rol: "Dirección", ia: true, obj: "Cada día resume el estado del negocio y prioriza las acciones de mayor impacto.",
    tools: [{ name: "resumen_negocio" }, { name: "consultar_prospectos_resumen" }] },
  { nombre: "Comercial", rol: "Ventas y precios", ia: false, obj: "Detecta productos mal posicionados frente a la competencia y propone el precio corregido.",
    tools: [{ name: "buscar_productos" }, { name: "consultar_competencia" }, { name: "aplicar_precio", write: true }] },
  { nombre: "Compras", rol: "Abastecimiento", ia: false, obj: "Avisa qué reponer por stock bajo y qué frenar por baja rotación.",
    tools: [{ name: "resumen_negocio" }] },
  { nombre: "Finanzas", rol: "Cobros y salud", ia: false, obj: "Reporta ingresos, ticket promedio y plata pendiente de cobro.",
    tools: [{ name: "resumen_financiero" }] },
  { nombre: "Marketing", rol: "Publicidad y contenido", ia: false, obj: "Detecta el producto con mejor margen y rotación para publicitar.",
    tools: [{ name: "productos_para_promocionar" }] },
  { nombre: "Calendario", rol: "Fechas de temporada", ia: false, obj: "Avisa fechas comerciales con anticipación y, si están cerca, prepara el borrador de campaña.",
    tools: [{ name: "fechas_comerciales" }, { name: "productos_para_promocionar" }, { name: "generar_campana", write: true }] },
  { nombre: "WhatsApp", rol: "Atención al cliente", ia: true, obj: "Detecta las conversaciones que el bot no pudo resolver y redacta una respuesta para tu aprobación.",
    tools: [{ name: "conversaciones_whatsapp_pendientes" }, { name: "buscar_productos" }, { name: "enviar_whatsapp", write: true }] },
  { nombre: "Inteligencia Comercial", rol: "Posición vs. competencia", ia: false, obj: "Escanea todo el catálogo vinculado a competidores y alerta dónde estás caro, barato o un rival bajó.",
    tools: [{ name: "alertas_precio" }] },
  { nombre: "Seguimiento", rol: "Re-contacto comercial", ia: false, obj: "Persigue lo que quedó sin cerrar: prospectos sin respuesta y presupuestos enviados. Propone el recordatorio.",
    tools: [{ name: "seguimientos_pendientes" }, { name: "enviar_whatsapp", write: true }] },
  { nombre: "Postventa", rol: "Reseñas y recompra", ia: false, obj: "Aprovecha a los que ya compraron: pide reseña tras la entrega y reactiva a los que hace rato no compran.",
    tools: [{ name: "oportunidades_postventa" }] },
];

const FLUJO = [
  { t: "Memoria", d: "Repasa decisiones y aprendizajes previos tuyos, para no repetir lo que ya descartaste." },
  { t: "Reglas", d: "Aplica lógica fija del negocio (margen mínimo, umbral de stock bajo). Es matemática, no adivina." },
  { t: "Datos", d: "Lee lo que necesita con herramientas de solo lectura: productos, competencia, finanzas, conversaciones." },
  { t: "IA", d: "Solo como último recurso, y solo dos agentes la usan: para redactar (el resumen del CEO, una respuesta de WhatsApp)." },
  { t: "Experiencia", d: "Guarda lo aprendido en la memoria de la empresa para que el próximo agente lo aproveche." },
];

const MODOS = [
  { tag: "Manual", color: "bg-gray-100 text-gray-600", h: "Solo mira y sugiere", p: "El agente analiza y te deja recomendaciones. Toda acción de escritura queda como propuesta.", v: "El más seguro. Ideal para empezar." },
  { tag: "Asistido", color: "bg-amber-100 text-amber-700", h: "Propone para aprobar", p: "Redacta el mensaje o prepara el cambio y lo manda a Aprobaciones. Vos lo revisás, editás y aprobás. Recién ahí se ejecuta.", v: "El punto justo: te ahorra el trabajo, mantenés el control." },
  { tag: "Autónomo", color: "bg-emerald-100 text-emerald-700", h: "Ejecuta solo", p: "Las acciones de escritura se ejecutan sin pasar por vos: manda el WhatsApp, cambia el precio, crea la campaña.", v: "Máxima potencia. Usalo cuando ya confiás en ese agente." },
];

const PUEDEN = [
  "Leer todo tu negocio: catálogo, stock, órdenes, finanzas, prospectos, precios de competidores y conversaciones.",
  "Detectar problemas y oportunidades con reglas: precios fuera de mercado, stock por caer, cobros pendientes, clientes para reactivar.",
  "Redactar mensajes y campañas (los dos agentes que usan IA).",
  "Proponer acciones: cambiar un precio, mandar un WhatsApp, crear una campaña, dar de alta un contacto.",
  "Ejecutar esas acciones solos únicamente si vos les pusiste modo Autónomo.",
  "Recordar tus decisiones para mejorar con el tiempo.",
];

const NO_PUEDEN = [
  "Ejecutar acciones que salen al mundo sin tu OK, salvo que actives el modo Autónomo.",
  "Usar una herramienta que no esté en su lista: el sistema se lo bloquea.",
  "Trabajar en tiempo real ni vigilar el negocio minuto a minuto: corren cuando los ejecutás o una vez al día.",
  "Inventar datos o navegar internet libremente.",
  "Reemplazar al bot de WhatsApp en vivo: el agente solo toma lo que el bot no supo resolver.",
  "Funcionar sin IA configurada, en el caso del CEO y WhatsApp (los otros ocho andan igual).",
];

const CRONS = [
  { tarea: "Briefing del día", hora: "11:00", que: "Resumen del negocio para arrancar el día." },
  { tarea: "Agentes programados", hora: "11:30", que: "Corre los agentes con frecuencia diaria (y los semanales, los lunes)." },
  { tarea: "Jefe de Gabinete", hora: "12:00", que: "Revisión proactiva y coordinación." },
  { tarea: "WhatsApp pendientes", hora: "21:00", que: "Repasa conversaciones sin responder del día." },
];

function Num({ n }: { n: string }) {
  return <span className="text-emerald-600 font-mono text-sm font-semibold">{n}</span>;
}

export default function ManualAgentesPage() {
  return (
    <div className="max-w-3xl space-y-10 pb-16">
      {/* Volver + título */}
      <div>
        <Link href="/admin/ayuda" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4">
          <ArrowLeft size={15} /> Volver a Ayuda
        </Link>
        <div className="flex items-start gap-3">
          <ScrollText className="text-emerald-600 shrink-0 mt-1" size={26} />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Manual de agentes</h1>
            <p className="text-gray-500 mt-1">
              Diez empleados virtuales que revisan el negocio, detectan oportunidades y <strong>proponen</strong> acciones.
              Vos decidís cuánta libertad les das. Nada se ejecuta solo salvo que lo permitas.
            </p>
          </div>
        </div>
      </div>

      {/* 01 idea */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Num n="01" /> La idea en una frase</h2>
        <p className="text-gray-600">
          Cada agente es como un empleado con una especialidad: uno mira los precios frente a la competencia, otro qué reponer,
          otro los cobros, otro las conversaciones de WhatsApp sin responder. Cuando lo ejecutás, hace su trabajo y te devuelve un
          <strong> resumen</strong> con <strong>recomendaciones concretas</strong>. Si algo requiere una acción que sale al mundo —mandar un
          mensaje, cambiar un precio, armar una campaña— <strong>no la hace por su cuenta</strong>: te la propone y espera tu OK.
        </p>
        <p className="text-gray-600">
          Trabajan siempre con <strong>tus datos reales</strong> (catálogo, stock, órdenes, prospectos, precios que ya cargaste).
          No inventan información ni salen a internet a hacer cosas por su cuenta.
        </p>
      </section>

      {/* 02 flujo */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Num n="02" /> Cómo razona un agente</h2>
        <p className="text-sm text-gray-500">El mismo orden en todos: barato y seguro primero, IA solo si hace falta.</p>
        <div className="space-y-1">
          {FLUJO.map((f, i) => (
            <div key={f.t} className="flex items-start gap-4 py-3 border-b border-dashed border-gray-100 last:border-0">
              <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 font-mono text-sm font-semibold flex items-center justify-center shrink-0">{i + 1}</span>
              <div>
                <span className="font-semibold text-gray-900 block">{f.t}</span>
                <span className="text-sm text-gray-600">{f.d}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 03 modos */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Num n="03" /> Los tres modos de autonomía</h2>
        <p className="text-sm text-gray-500">Lo más importante: define cuánto puede hacer un agente sin preguntarte. Lo elegís por agente y lo cambiás cuando quieras.</p>
        <div className="grid sm:grid-cols-3 gap-3">
          {MODOS.map(m => (
            <div key={m.tag} className="bg-white rounded-2xl border shadow-sm p-5 flex flex-col">
              <span className={`text-[11px] font-mono uppercase tracking-wide font-medium px-2 py-1 rounded-full self-start ${m.color}`}>{m.tag}</span>
              <h3 className="font-semibold text-gray-900 mt-3">{m.h}</h3>
              <p className="text-sm text-gray-600 mt-1 flex-1">{m.p}</p>
              <p className="text-xs text-gray-400 mt-3 pt-3 border-t">{m.v}</p>
            </div>
          ))}
        </div>
        <div className="bg-amber-50 border-l-4 border-amber-400 rounded-xl p-4">
          <p className="text-[11px] font-mono uppercase tracking-wide text-amber-700 font-medium mb-1">La regla de oro</p>
          <p className="text-sm text-gray-700">
            Las herramientas de <strong>lectura</strong> siempre se ejecutan (no tocan nada). Las de <strong>escritura</strong> —enviar
            WhatsApp, cambiar precio, crear campaña, dar de alta un contacto— <strong>solo se ejecutan solas en modo Autónomo</strong>.
            En Manual y Asistido, esperan tu aprobación. Por defecto, todos vienen en Manual.
          </p>
        </div>
      </section>

      {/* 04 agentes */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Num n="04" /> Los diez agentes</h2>
        <p className="text-sm text-gray-500">Cada uno con su rol, sus herramientas y si consume IA o no.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {AGENTES.map(a => (
            <div key={a.nombre} className="bg-white rounded-2xl border shadow-sm p-5 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-gray-900">{a.nombre}</h3>
                  <span className="text-xs text-gray-400 font-mono">{a.rol}</span>
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full whitespace-nowrap ${a.ia ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                  {a.ia ? "usa IA" : "0 tokens"}
                </span>
              </div>
              <p className="text-sm text-gray-600 my-3 flex-1">{a.obj}</p>
              <div className="flex flex-wrap gap-1.5">
                {a.tools.map(t => (
                  <span key={t.name} className={`text-[11px] font-mono px-2 py-0.5 rounded-md border inline-flex items-center gap-1.5 ${t.write ? "bg-amber-50 text-amber-700 border-transparent" : "bg-gray-50 text-gray-500 border-gray-200"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${t.write ? "bg-amber-500" : "bg-gray-400"}`} />{t.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-400 font-mono pt-1">
          <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-400" />lectura — se ejecuta siempre, no toca nada</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" />escritura — necesita tu aprobación (salvo Autónomo)</span>
        </div>
      </section>

      {/* 05 pueden / no pueden */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Num n="05" /> Qué pueden y qué no pueden hacer</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border shadow-sm p-5">
            <h3 className="font-semibold text-emerald-700 flex items-center gap-2 mb-3"><ShieldCheck size={18} /> Pueden</h3>
            <ul className="space-y-2.5">
              {PUEDEN.map((x, i) => (
                <li key={i} className="text-sm text-gray-600 pl-5 relative before:content-['+'] before:absolute before:left-0 before:text-emerald-600 before:font-bold before:font-mono">{x}</li>
              ))}
            </ul>
          </div>
          <div className="bg-white rounded-2xl border shadow-sm p-5">
            <h3 className="font-semibold text-red-600 flex items-center gap-2 mb-3"><Eye size={18} /> No pueden</h3>
            <ul className="space-y-2.5">
              {NO_PUEDEN.map((x, i) => (
                <li key={i} className="text-sm text-gray-600 pl-5 relative before:content-['–'] before:absolute before:left-0 before:text-red-500 before:font-bold before:font-mono">{x}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 06 cuándo */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Num n="06" /> Cuándo se ejecutan</h2>
        <p className="text-gray-600">
          Desde <strong>Admin → Agentes</strong> tocás <span className="font-mono text-xs bg-gray-100 border px-1.5 py-0.5 rounded">Ejecutar</span> y corre al instante.
          Además, cada agente tiene una frecuencia: <span className="font-mono text-xs bg-gray-100 border px-1.5 py-0.5 rounded">off</span> (solo a mano),
          <span className="font-mono text-xs bg-gray-100 border px-1.5 py-0.5 rounded ml-1">diario</span> o
          <span className="font-mono text-xs bg-gray-100 border px-1.5 py-0.5 rounded ml-1">semanal</span>. Un programador los despierta cada mañana
          y corre los que correspondan (los semanales, solo los lunes).
        </p>
        <div className="overflow-x-auto rounded-2xl border shadow-sm">
          <table className="w-full text-sm bg-white">
            <thead>
              <tr className="text-left text-[11px] font-mono uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 font-medium">Tarea automática</th>
                <th className="px-4 py-3 font-medium">Horario</th>
                <th className="px-4 py-3 font-medium">Qué hace</th>
              </tr>
            </thead>
            <tbody>
              {CRONS.map(c => (
                <tr key={c.tarea} className="border-t">
                  <td className="px-4 py-3 text-gray-800">{c.tarea}</td>
                  <td className="px-4 py-3"><span className="font-mono text-xs bg-gray-100 border px-1.5 py-0.5 rounded">{c.hora}</span></td>
                  <td className="px-4 py-3 text-gray-600">{c.que}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400">
          Un agente en frecuencia <span className="font-mono">diario</span> pero en modo Manual corre y deja sugerencias; no ejecuta nada solo.
          La frecuencia dice <em>cuándo trabaja</em>; el modo dice <em>cuánto puede hacer</em>.
        </p>
      </section>

      {/* 07 costo */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Num n="07" /> Costo de IA y control de gasto</h2>
        <div className="bg-white rounded-2xl border shadow-sm p-5 flex items-start gap-3">
          <DollarSign className="text-emerald-600 shrink-0 mt-0.5" size={20} />
          <p className="text-sm text-gray-600">
            Ocho de los diez agentes son <strong>determinísticos</strong>: resuelven con matemática y reglas, <strong>sin gastar un solo token</strong>.
            Solo el <strong>CEO</strong> y el de <strong>WhatsApp</strong> llaman a la IA, y únicamente para redactar texto. Cada llamada registra su costo,
            y hay un <strong>tope de gasto mensual</strong> configurable. Todo el consumo se ve en <strong>Admin → Gasto de IA</strong>.
          </p>
        </div>
      </section>

      {/* 08 dónde ver */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Num n="08" /> Dónde ver todo</h2>
        <div className="space-y-2.5">
          {[
            { path: "/admin/agentes", label: "Agentes", txt: "Centro de Agentes. Cada agente con su rol, herramientas, modo y frecuencia. Botón para ejecutar y ver el resultado de la última corrida." },
            { path: "/admin/aprobaciones", label: "Aprobaciones", txt: "La bandeja de decisiones. Acciones que los agentes proponen y esperan tu OK. Podés editar el texto antes de aprobar. Tiene historial." },
            { path: "/admin/bitacora", label: "Bitácora", txt: "Línea de tiempo unificada. Todo lo que hicieron los agentes —ejecuciones y acciones— en un solo lugar, con filtros y detalle de logs." },
            { path: "/admin/ia-gasto", label: "Gasto de IA", txt: "El contador. Cuánto consumió la IA, con tope mensual." },
          ].map(p => (
            <Link key={p.path} href={p.path} className="flex items-start gap-4 bg-white rounded-xl border shadow-sm p-4 hover:border-emerald-300 transition-colors">
              <span className="text-emerald-600 font-medium text-sm whitespace-nowrap pt-0.5 w-28 shrink-0">{p.label} →</span>
              <span className="text-sm text-gray-600">{p.txt}</span>
            </Link>
          ))}
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
          <Cpu className="text-emerald-600 shrink-0 mt-0.5" size={18} />
          <p className="text-sm text-emerald-900">
            <strong>Para probarlo ahora:</strong> entrá a Agentes, elegí uno que no gaste IA (ej. Finanzas o Inteligencia Comercial) y tocá Ejecutar.
            Después mirá la Bitácora: ahí aparece la corrida con su duración, resultado y el paso a paso.
          </p>
        </div>
      </section>
    </div>
  );
}
