import { z } from "zod";
import type { Tool } from "./types";
import { buscarProductos, consultarStock } from "@/lib/services/productos.service";
import { consultarCompetencia, buscarEnCompetencia } from "@/lib/services/inteligencia.service";
import { alertasPrecio } from "@/lib/services/inteligencia-comercial.service";
import { seguimientosPendientes } from "@/lib/services/seguimiento.service";
import { buscarProspectos, contarProspectosPorEstado } from "@/lib/services/prospectos.service";
import { calcularPresupuesto } from "@/lib/services/presupuesto.service";
import { recolectarDatos } from "@/lib/briefing";
import { remember, recall } from "@/lib/memory";
import { aplicarPrecioSugerido } from "@/lib/services/pricing.service";
import { resumenFinanciero, productosParaPromocionar } from "@/lib/services/finanzas.service";
import { conversacionesPendientes, enviarWhatsapp } from "@/lib/services/whatsapp.service";
import { proximasFechas } from "@/lib/services/calendario.service";
import { generarCampana } from "@/lib/services/campana.service";

// Cada tool: nombre, categoría, efecto, validación zod, params documentados y handler.
export const TOOLS: Tool[] = [
  {
    name: "buscar_productos",
    description: "Busca productos del catálogo por nombre (o lista los activos) con precio, costo, precio mayorista y stock.",
    category: "Catálogo",
    sideEffect: "read",
    input: z.object({ q: z.string().optional(), limit: z.number().int().positive().max(100).optional() }),
    params: [
      { nombre: "q", tipo: "string", requerido: false, descripcion: "Texto a buscar en el nombre" },
      { nombre: "limit", tipo: "number", requerido: false, descripcion: "Máximo de resultados (def. 20)" },
    ],
    run: (i) => buscarProductos(i),
  },
  {
    name: "consultar_stock",
    description: "Devuelve el stock total de un producto (o de una variante puntual), con el detalle por variante.",
    category: "Catálogo",
    sideEffect: "read",
    input: z.object({ productId: z.string().optional(), variantId: z.string().optional() })
      .refine(v => v.productId || v.variantId, "Se requiere productId o variantId"),
    params: [
      { nombre: "productId", tipo: "string", requerido: false, descripcion: "ID del producto" },
      { nombre: "variantId", tipo: "string", requerido: false, descripcion: "ID de la variante" },
    ],
    run: (i) => consultarStock(i),
  },
  {
    name: "consultar_competencia",
    description: "Precios de la competencia para un producto propio (mínimo, promedio y máximo del mercado) según los vínculos confirmados.",
    category: "Inteligencia",
    sideEffect: "read",
    input: z.object({ productId: z.string() }),
    params: [{ nombre: "productId", tipo: "string", requerido: true, descripcion: "ID del producto propio" }],
    run: (i) => consultarCompetencia(i.productId),
  },
  {
    name: "buscar_en_competencia",
    description: "Busca productos scrapeados de competidores por nombre; devuelve precio, tienda y URL.",
    category: "Inteligencia",
    sideEffect: "read",
    input: z.object({ q: z.string(), limit: z.number().int().positive().max(100).optional() }),
    params: [
      { nombre: "q", tipo: "string", requerido: true, descripcion: "Texto a buscar" },
      { nombre: "limit", tipo: "number", requerido: false, descripcion: "Máximo de resultados" },
    ],
    run: (i) => buscarEnCompetencia(i.q, i.limit),
  },
  {
    name: "alertas_precio",
    description: "Analiza todo el catálogo vinculado a competencia y devuelve alertas de precio (dónde estás caro, barato o un competidor bajó). Determinístico, sin IA.",
    category: "Inteligencia",
    sideEffect: "read",
    input: z.object({}),
    params: [],
    run: () => alertasPrecio(),
  },
  {
    name: "seguimientos_pendientes",
    description: "Detecta a quién re-contactar: prospectos contactados sin respuesta y presupuestos enviados sin cerrar, con un mensaje sugerido. Determinístico.",
    category: "Comercial",
    sideEffect: "read",
    input: z.object({}),
    params: [],
    run: () => seguimientosPendientes(),
  },
  {
    name: "buscar_prospectos",
    description: "Lista prospectos B2B guardados, con filtros por estado, rubro y si tienen teléfono.",
    category: "Comercial",
    sideEffect: "read",
    input: z.object({
      estado: z.string().optional(),
      rubro: z.string().optional(),
      conTelefono: z.boolean().optional(),
      limit: z.number().int().positive().max(100).optional(),
    }),
    params: [
      { nombre: "estado", tipo: "string", requerido: false, descripcion: "nuevo | contactado | interesado | descartado" },
      { nombre: "rubro", tipo: "string", requerido: false, descripcion: "Rubro exacto" },
      { nombre: "conTelefono", tipo: "boolean", requerido: false, descripcion: "Solo los que tienen teléfono" },
      { nombre: "limit", tipo: "number", requerido: false, descripcion: "Máximo de resultados" },
    ],
    run: (i) => buscarProspectos(i),
  },
  {
    name: "calcular_presupuesto",
    description: "Calcula un presupuesto para una lista de productos y cantidades, usando precio mayorista cuando existe. No persiste nada.",
    category: "Comercial",
    sideEffect: "read",
    input: z.object({
      items: z.array(z.object({ productId: z.string(), cantidad: z.number().int().positive() })).min(1),
    }),
    params: [{ nombre: "items", tipo: "array", requerido: true, descripcion: "[{ productId, cantidad }]" }],
    run: (i) => calcularPresupuesto(i.items),
  },
  {
    name: "consultar_prospectos_resumen",
    description: "Cuenta los prospectos agrupados por estado (nuevo/contactado/interesado/descartado).",
    category: "Comercial",
    sideEffect: "read",
    input: z.object({}),
    params: [],
    run: () => contarProspectosPorEstado(),
  },
  {
    name: "resumen_negocio",
    description: "Snapshot del negocio: ventas de ayer, órdenes por despachar, carritos abandonados, stock bajo, bajadas de competencia, prospectos nuevos y productos sin rotación.",
    category: "Dirección",
    sideEffect: "read",
    input: z.object({}),
    params: [],
    run: () => recolectarDatos(),
  },
  {
    name: "resumen_financiero",
    description: "Ingresos aprobados (total y 30 días), órdenes pagadas/pendientes, ticket promedio y monto pendiente de cobro.",
    category: "Finanzas",
    sideEffect: "read",
    input: z.object({}),
    params: [],
    run: () => resumenFinanciero(),
  },
  {
    name: "productos_para_promocionar",
    description: "Ranking de productos candidatos a publicidad: mejor margen ponderado por ventas recientes.",
    category: "Marketing",
    sideEffect: "read",
    input: z.object({ limit: z.number().int().positive().max(20).optional() }),
    params: [{ nombre: "limit", tipo: "number", requerido: false, descripcion: "Máximo de candidatos" }],
    run: (i) => productosParaPromocionar(i.limit),
  },
  {
    name: "conversaciones_whatsapp_pendientes",
    description: "Conversaciones de WhatsApp que necesitan atención humana: el bot no supo responder o el cliente pidió hablar con alguien.",
    category: "Atención al cliente",
    sideEffect: "read",
    input: z.object({ limit: z.number().int().positive().max(20).optional() }),
    params: [{ nombre: "limit", tipo: "number", requerido: false, descripcion: "Máximo de conversaciones" }],
    run: (i) => conversacionesPendientes(i.limit),
  },
  {
    name: "enviar_whatsapp",
    description: "Envía un mensaje de WhatsApp a un contacto. Acción de escritura: requiere aprobación salvo en modo autónomo.",
    category: "Atención al cliente",
    sideEffect: "write",
    input: z.object({ to: z.string(), texto: z.string().min(1) }),
    params: [
      { nombre: "to", tipo: "string", requerido: true, descripcion: "wa_id / número del contacto" },
      { nombre: "texto", tipo: "string", requerido: true, descripcion: "Mensaje a enviar" },
    ],
    run: (i) => enviarWhatsapp(i.to, i.texto),
  },
  {
    name: "fechas_comerciales",
    description: "Próximas fechas comerciales importantes (Día de la Madre, Navidad, Día del Mate, etc.) dentro de una ventana de días, con su relevancia y ángulo de venta.",
    category: "Marketing",
    sideEffect: "read",
    input: z.object({ ventanaDias: z.number().int().positive().max(365).optional() }),
    params: [{ nombre: "ventanaDias", tipo: "number", requerido: false, descripcion: "Anticipación en días (def. 60)" }],
    run: async (i) => proximasFechas(i.ventanaDias ?? 60),
  },
  {
    name: "consultar_memoria",
    description: "Consulta la memoria de la empresa por espacio (productos, clientes, comercial, decisiones, etc.), con filtros por texto o etiquetas.",
    category: "Memoria",
    sideEffect: "read",
    input: z.object({
      namespace: z.string(),
      query: z.string().optional(),
      tags: z.array(z.string()).optional(),
      limit: z.number().int().positive().max(50).optional(),
    }),
    params: [
      { nombre: "namespace", tipo: "string", requerido: true, descripcion: "productos|clientes|comercial|mercadolibre|reglas|aprendizajes|decisiones" },
      { nombre: "query", tipo: "string", requerido: false, descripcion: "Texto a buscar en el contenido" },
      { nombre: "tags", tipo: "array", requerido: false, descripcion: "Etiquetas a filtrar" },
      { nombre: "limit", tipo: "number", requerido: false, descripcion: "Máximo de resultados" },
    ],
    run: (i) => recall(i),
  },
  {
    name: "generar_campana",
    description: "Genera un borrador completo de campaña de Meta Ads para un producto (nombre, presupuesto, público y 2 anuncios A/B). Opcionalmente ambientada en una ocasión (ej: Día de la Madre). Acción de escritura: requiere aprobación salvo en modo autónomo.",
    category: "Marketing",
    sideEffect: "write",
    input: z.object({ productId: z.string(), ocasion: z.string().optional(), estrategia: z.string().optional() }),
    params: [
      { nombre: "productId", tipo: "string", requerido: true, descripcion: "ID del producto a promocionar" },
      { nombre: "ocasion", tipo: "string", requerido: false, descripcion: "Fecha/tema, ej: Día de la Madre" },
      { nombre: "estrategia", tipo: "string", requerido: false, descripcion: "ventas | rotacion" },
    ],
    run: (i) => generarCampana(i.productId, { ocasion: i.ocasion, estrategia: i.estrategia }),
  },
  {
    name: "aplicar_precio",
    description: "Cambia el precio de la variante activa más barata de un producto. Registra el cambio en el historial. Acción de escritura: requiere aprobación salvo en modo autónomo.",
    category: "Comercial",
    sideEffect: "write",
    input: z.object({ productId: z.string(), precio: z.number().positive() }),
    params: [
      { nombre: "productId", tipo: "string", requerido: true, descripcion: "ID del producto" },
      { nombre: "precio", tipo: "number", requerido: true, descripcion: "Nuevo precio" },
    ],
    run: (i) => aplicarPrecioSugerido(i.productId, i.precio, "agente"),
  },
  {
    name: "guardar_memoria",
    description: "Guarda un aprendizaje o dato en la memoria de la empresa para que cualquier agente lo reutilice.",
    category: "Memoria",
    sideEffect: "write",
    input: z.object({
      namespace: z.string(),
      key: z.string(),
      value: z.any(),
      kind: z.string().optional(),
      tags: z.array(z.string()).optional(),
      source: z.string().optional(),
    }),
    params: [
      { nombre: "namespace", tipo: "string", requerido: true, descripcion: "Espacio de memoria" },
      { nombre: "key", tipo: "string", requerido: true, descripcion: "Clave única dentro del espacio" },
      { nombre: "value", tipo: "object", requerido: true, descripcion: "Contenido a guardar" },
      { nombre: "kind", tipo: "string", requerido: false, descripcion: "Tipo/categoría" },
      { nombre: "tags", tipo: "array", requerido: false, descripcion: "Etiquetas" },
      { nombre: "source", tipo: "string", requerido: false, descripcion: "Origen del dato" },
    ],
    run: (i) => remember(i),
  },
];
