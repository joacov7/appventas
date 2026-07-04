import { z } from "zod";
import type { Tool } from "./types";
import { buscarProductos, consultarStock } from "@/lib/services/productos.service";
import { consultarCompetencia, buscarEnCompetencia } from "@/lib/services/inteligencia.service";
import { buscarProspectos, contarProspectosPorEstado } from "@/lib/services/prospectos.service";
import { calcularPresupuesto } from "@/lib/services/presupuesto.service";
import { recolectarDatos } from "@/lib/briefing";

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
];
