# Auditoría y Plan de Evolución — de AppVentas a Empresa IA

> Documento para aprobación. **No se implementa nada hasta que apruebes.**
> Fecha: 2026-07-05 · Proyecto: appventas (Pava Negra / pavanegra.com.ar)
> Objetivo: convertir el proyecto en una plataforma **configurable, multi-fabricante y multi-catálogo**, B2B/B2C, para vender productos personalizados (mates, bombillas, materas, cuchillos, tablas, termos, llaveros, pulseras, regalos corporativos, merchandising… cualquier producto) con un equipo de **agentes de IA** que comparten memoria, herramientas y reglas, usando IA como **último recurso**.

---

## 0. Resumen ejecutivo (léelo aunque no leas el resto)

**Dónde estás hoy:** tenés una base sólida y poco común para un negocio de este tamaño. Ya existe una tienda funcional (Next.js 16 + Prisma + Postgres en Vercel), un scraper de competencia multi-plataforma, un prospector B2B por provincia, WhatsApp conectado punta a punta, y — lo más valioso — una **plataforma de 7 capas de "Empresa IA"** ya construida: proveedor de IA multi-modelo, registro de herramientas, servicios de negocio deterministas, motor de memoria, motor de agentes (7 agentes), cola de aprobaciones y agendado por cron.

**El problema real no es técnico, es de foco:** construiste mucha capacidad y poca de esa capacidad está *conectada a plata*. El scraper, los agentes y la memoria funcionan, pero el negocio hoy tiene poco tráfico, así que la IA no tiene de qué aprender y varios agentes corren "en el vacío". Además hay **dos capas de datos** conviviendo (modelos Prisma en inglés + tablas SQL crudas en español) que es la principal deuda técnica y el mayor riesgo a futuro.

**Mi recomendación (diferente a "sumar más agentes"):** NO agregar agentes nuevos todavía. Primero **consolidar el dominio de datos** y **hacer configurable el catálogo/fabricante** (que es lo que te desbloquea vender cualquier producto de cualquier proveedor). Recién después, activar de a uno los agentes que tocan plata: **Cotizador** (presupuestos B2B automáticos) e **Inteligencia Comercial** (posición vs. competencia). Taller/BOM y Compras son valiosos pero recién rinden cuando tengas volumen de producción real.

**En una frase:** _menos agentes nuevos, más configurabilidad y datos limpios; encender los agentes por orden de retorno, no todos a la vez._

---

## 1. Auditoría completa del estado actual

### 1.1 Stack y plataforma
- **Framework:** Next.js 16.2.9 (App Router, Turbopack). Ojo: esta versión tiene breaking changes; los `params` de rutas dinámicas son `Promise` y hay que `await`. Ya está documentado en AGENTS.md.
- **Datos:** Prisma + PostgreSQL (Neon).
- **Hosting:** Vercel plan Hobby → límite duro de **60s por función**. Ya nos mordió (prospector con `maxDuration=90` rompió el deploy). Es una restricción real de diseño, no un detalle.
- **IA:** capa de abstracción propia (Anthropic SDK + compatible OpenAI vía fetch → OpenAI / OpenRouter / Ollama / LM Studio). Hoy activo: **OpenAI GPT-4o**, ~US$0.0005 por corrida de agente.

### 1.2 Las 7 capas de "Empresa IA" (ya existen y funcionan)
1. **Proveedor de IA** (`src/lib/ai/*`): multi-proveedor, config en `catalog_config`, costos estimados, claves enmascaradas. ✅
2. **Herramientas** (`src/lib/tools/*`): 17 tools con contrato `{name, sideEffect: read|write, input(zod), run}` y validación. ✅
3. **Servicios de negocio deterministas** (`src/lib/services/*`): productos, inteligencia (estadísticas con mediana + filtro de outliers), prospectos, presupuesto, pricing (piso de margen 15%), finanzas, whatsapp, calendario, campañas. ✅ **Esta es la joya**: hace trabajo sin gastar tokens.
4. **Memoria** (`src/lib/memory/*`): namespaces, confianza, hits, caché de respuestas de IA. ✅ pero **sub-utilizada** (poco tráfico = poco que recordar).
5. **Agentes** (`src/lib/agents/*`): 7 agentes (ceo, comercial, compras, finanzas, marketing, whatsapp, calendario) con flujo memoria→reglas→datos→IA→experiencia, telemetría y modos de autonomía (manual/asistido/autónomo). ✅
6. **Aprobaciones** (`action_queue`): las acciones de escritura se **proponen** y esperan tu OK (excepto en modo autónomo). ✅
7. **Agendado** (`vercel.json` crons): briefing diario, corrida de agentes, carritos abandonados, suscripciones. ✅

### 1.3 Funcionalidades de negocio que ya tenés
- Tienda e-commerce funcional (catálogo, precios, combos).
- **Scraper de competencia** multi-plataforma (Tiendanube, Shopify, WooCommerce + sniffing + MercadoLibre por HTML). Frágil por naturaleza (depende del HTML ajeno), pero operativo.
- **Prospector B2B** por provincia/país vía OpenStreetMap Overpass + geocoding Nominatim, con Instagram/Facebook, filtros y matching sin acentos.
- **WhatsApp Business** punta a punta (webhook, bot de reglas, normalización de números Argentina, respuestas cálidas).
- **Cross-reference competencia↔catálogo** ("Mi posición").
- **Empleado Virtual** fases 1-4: briefing diario, sugeridor de precios con "Aplicar", generador de campañas Meta, mensajes de outreach B2B.
- Manuales PDF en `docs/`.

### 1.4 Deuda técnica y puntos débiles (lo que hay que mirar de frente)
| # | Problema | Severidad | Por qué importa |
|---|----------|-----------|-----------------|
| D1 | **Dos capas de datos**: modelos Prisma (inglés) + tablas SQL crudas (español) vía `$queryRawUnsafe`. | 🔴 Alta | Duplica la verdad, invita a inconsistencias, y `$queryRawUnsafe` esquiva el tipado de Prisma. Es la deuda #1. |
| D2 | **Uso de `$executeRawUnsafe`/`$queryRawUnsafe`** con `CREATE TABLE IF NOT EXISTS` en caliente. | 🟠 Media | No hay migraciones versionadas para media plataforma. Difícil de auditar y revertir. |
| D3 | **Scraper dependiente de HTML ajeno.** | 🟠 Media | Se rompe cuando cambian los sitios. Ya pasó varias veces (403/404/406/422). |
| D4 | **Agentes corriendo sin datos** (poco tráfico). | 🟡 Media-baja | Gastan tokens sin aprender. Hoy la memoria no se llena. |
| D5 | **Catálogo/fabricante no configurable** todavía. | 🔴 Alta | Es exactamente lo que bloquea "vender cualquier producto de cualquier proveedor". |
| D6 | **Límite 60s de Vercel Hobby.** | 🟡 Baja | Techo para scraping/prospección masiva y para agentes pesados. |
| D7 | **Seguridad**: ya se hizo un hardening (validación de precio server-side, webhooks/crons fail-closed, token admin firmado + rate limit). | 🟢 Ok | Mantener; revisar que todo endpoint nuevo herede el patrón. |

---

## 2. Diagrama de arquitectura ACTUAL

```
┌──────────────────────────────────────────────────────────────┐
│                        USUARIOS                                │
│   Cliente B2C (web)   ·   Cliente B2B (WhatsApp)   ·   Vos     │
└───────────────┬───────────────┬───────────────────┬───────────┘
                │               │                   │
        ┌───────▼───────┐  ┌────▼─────────┐   ┌─────▼──────────┐
        │  Tienda web   │  │  WhatsApp    │   │  Panel Admin   │
        │  (App Router) │  │  webhook+bot │   │  (agentes,     │
        │               │  │              │   │  memoria, etc) │
        └───────┬───────┘  └────┬─────────┘   └─────┬──────────┘
                │               │                   │
                └───────────────┴─────────┬─────────┘
                                          │
                  ┌───────────────────────▼────────────────────────┐
                  │            PLATAFORMA "EMPRESA IA"              │
                  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
                  │  │ Agentes  │→ │  Tools   │→ │  Servicios   │  │
                  │  │ (7)      │  │ (17)     │  │ deterministas│  │
                  │  └────┬─────┘  └──────────┘  └──────┬───────┘  │
                  │       │  ┌──────────┐  ┌────────────▼───────┐  │
                  │       ├─→│ Memoria  │  │  Aprobaciones      │  │
                  │       │  └──────────┘  │  (action_queue)    │  │
                  │       │  ┌──────────┐  └────────────────────┘  │
                  │       └─→│ IA multi │  (último recurso)        │
                  │          │ proveedor│                          │
                  │          └──────────┘                          │
                  └───────────────────────┬────────────────────────┘
                                          │
              ┌───────────────────────────┼───────────────────────────┐
              │                           │                           │
      ┌───────▼────────┐        ┌─────────▼─────────┐       ┌─────────▼────────┐
      │  Prisma models │        │  Tablas SQL crudas│       │  APIs externas   │
      │  (inglés)      │        │  (español, raw)   │       │  Overpass/Nomina │
      │                │◄──D1──►│  catalog_config   │       │  MercadoLibre    │
      └───────┬────────┘        └─────────┬─────────┘       │  Meta/WhatsApp   │
              └──────────┬────────────────┘                 └──────────────────┘
                         ▼
                 PostgreSQL (Neon)
              ⚠️ D1: dos capas de datos
```

---

## 3. Diagrama de arquitectura PROPUESTA

Idea central: una **capa de configuración de negocio** por encima de todo (multi-fabricante, multi-catálogo, reglas editables desde el admin **sin tocar código**) y un **dominio de datos unificado** debajo. Los agentes no cambian de motor; cambian de "combustible" (datos limpios y configuración).

```
┌───────────────────────────────────────────────────────────────────┐
│                     PANEL DE CONFIGURACIÓN (admin)                 │
│  Fabricantes · Catálogos · Reglas de precio · Reglas de agentes    │
│  Plantillas de mensajes · Ocasiones/calendario · Proveedores IA    │
│         (TODO editable sin tocar código — capa "no-code")          │
└───────────────────────────────┬───────────────────────────────────┘
                                 │  (config declarativa en DB)
┌───────────────────────────────▼───────────────────────────────────┐
│                     PLATAFORMA "EMPRESA IA" (motor)                │
│                                                                    │
│   Agentes activos por ROI  →  Tools  →  Servicios deterministas    │
│                                                                    │
│   Encendido por fases:                                             │
│   FASE A: Cotizador · Inteligencia Comercial                       │
│   FASE B: Atención omnicanal · Marketing                           │
│   FASE C: Taller/BOM · Compras   (cuando haya volumen)             │
│   Siempre: Dirección (dashboard ejecutivo)                         │
│                                                                    │
│   Memoria compartida ·  Aprobaciones ·  IA multiproveedor (último) │
└───────────────────────────────┬───────────────────────────────────┘
                                 │
┌───────────────────────────────▼───────────────────────────────────┐
│              DOMINIO DE DATOS UNIFICADO (una sola verdad)          │
│  Prisma como fuente única · migraciones versionadas · sin raw SQL  │
│  Entidades: Fabricante, Producto, Catálogo, Cliente(B2B/B2C),      │
│  Presupuesto, Pedido, Competencia, Conversación, Experiencia       │
└───────────────────────────────┬───────────────────────────────────┘
                                 ▼
                        PostgreSQL (Neon)
```

**Qué cambia respecto a hoy:** (a) desaparece la doble capa de datos (D1/D2); (b) aparece la capa de configuración no-code que te deja dar de alta un fabricante o un catálogo nuevo desde el admin; (c) los agentes se **encienden por orden de retorno**, no todos juntos.

---

## 4. Roadmap por fases

### Fase 0 — Fundaciones (habilita todo lo demás)
- **F0.1 Unificar dominio de datos** (resolver D1/D2): migrar las tablas crudas a modelos Prisma con migraciones versionadas. Sin esto, cada agente nuevo agranda el problema.
- **F0.2 Modelo de Fabricante y Catálogo configurable** (resolver D5): entidades + pantallas de admin para dar de alta fabricantes, catálogos y reglas de precio por fabricante.

### Fase A — Agentes que tocan plata (encender de a uno)
- **A.1 Cotizador**: presupuestos B2B automáticos a partir de catálogo + reglas (determinista; IA solo para redactar el mensaje). **Mayor ROI.**
- **A.2 Inteligencia Comercial**: consolidar scraper + "Mi posición" en un agente con alertas de precio.

### Fase B — Captación y atención
- **B.1 Atención omnicanal**: unificar WhatsApp (+ luego Instagram/Meta) en una sola bandeja con el agente asistido.
- **B.2 Marketing**: campañas por ocasión (ya existe base) + calendario con anticipación (Día de la Madre, etc.).

### Fase C — Producción (solo con volumen real)
- **C.1 Taller/BOM**: lista de materiales y costeo de producción.
- **C.2 Compras**: reposición de insumos según BOM y stock.

### Continuo
- **Dirección**: dashboard ejecutivo que resume todo (evolución del briefing actual).
- **Seguridad**: mantener el patrón fail-closed en cada endpoint nuevo.

---

## 5. Riesgos

| Riesgo | Prob. | Impacto | Mitigación |
|--------|-------|---------|------------|
| Migración de datos (F0.1) rompe módulos vivos | Media | Alto | Migrar por entidad, con doble escritura temporal y verificación; no "big bang". |
| Scraper se sigue rompiendo | Alta | Medio | Tratarlo como "best-effort", con fallback y alertas; no depender de él para decisiones críticas. |
| Agentes gastan tokens sin retorno | Media | Bajo | Encender por fase; IA como último recurso; caché de memoria; modo manual/asistido por defecto. |
| Límite 60s Vercel Hobby | Media | Medio | Trabajos largos por lotes/cron; evaluar plan Pro solo si hace falta. |
| Sobre-ingeniería (más agentes que ventas) | **Alta** | Alto | **Este documento**: encender por ROI, no por entusiasmo. |
| Dependencia de un solo proveedor IA | Baja | Bajo | Ya mitigado: capa multiproveedor. |

---

## 6. Mejoras recomendadas (priorizadas)

1. **Unificar datos en Prisma** (D1/D2) — base de todo.
2. **Fabricante/Catálogo configurable no-code** (D5) — desbloquea el modelo de negocio.
3. **Reglas de precio por fabricante** editables desde admin.
4. **Cotizador determinista** — el agente con mejor retorno.
5. **Bandeja omnicanal** — una sola pantalla para toda la atención.
6. **Panel de configuración de agentes** más completo (reglas, plantillas, límites de gasto).
7. **Observabilidad de costos de IA** (ya hay estimación; falta tablero histórico).

---

## 7. Funcionalidades faltantes (respecto a la visión multi-fabricante)

- Alta/gestión de **fabricantes** y sus catálogos.
- **Reglas de precio** por fabricante/canal (B2B vs B2C) configurables.
- **Cotizador** B2B (presupuesto → PDF → seguimiento).
- **CRM** mínimo de clientes B2B (estado, historial, próxima acción).
- **Bandeja omnicanal** (WhatsApp + Instagram/Meta).
- **BOM/costeo de producción** (para personalizados reales).
- **Compras/reposición** de insumos.
- **Dashboard de Dirección** consolidado (KPIs, no solo briefing de texto).

---

## 8. Priorización (impacto × retorno ÷ complejidad)

| Iniciativa | Impacto | Retorno | Complejidad | Prioridad |
|-----------|---------|---------|-------------|-----------|
| F0.1 Unificar datos | Alto | Indirecto (habilitador) | Alta | **1** |
| F0.2 Fabricante/Catálogo | Alto | Alto | Media | **2** |
| A.1 Cotizador | Alto | **Muy alto** | Media | **3** |
| A.2 Inteligencia Comercial | Medio | Alto | Media | 4 |
| B.1 Omnicanal | Medio | Medio | Media | 5 |
| B.2 Marketing/calendario | Medio | Medio | Baja | 6 |
| C.1 Taller/BOM | Alto (con volumen) | Bajo (hoy) | Alta | 7 |
| C.2 Compras | Medio (con volumen) | Bajo (hoy) | Media | 8 |

---

## 9. Estimación de dificultad

- **F0.1 Unificar datos:** difícil (toca todo). Es la única pieza que recomiendo hacer con cuidado quirúrgico, por entidad.
- **F0.2 Fabricante/Catálogo:** media. Entidades nuevas + pantallas de admin; el motor ya soporta config en DB.
- **A.1 Cotizador:** media. La lógica es determinista (catálogo + reglas); la IA solo redacta.
- **A.2 Inteligencia Comercial:** media. Ya existe scraper + "Mi posición"; falta empaquetarlo como agente con alertas.
- **B.1 Omnicanal:** media. WhatsApp ya está; sumar Instagram/Meta y unificar bandeja.
- **B.2 Marketing/calendario:** baja. Base ya construida.
- **C.1 Taller/BOM y C.2 Compras:** alta/media, pero **no urgentes**: rinden con volumen de producción real.

---

## 10. Recomendación técnica por mejora

- **Datos (F0.1):** Prisma como **fuente única de verdad**. Migrar tablas crudas a modelos + migraciones versionadas. Eliminar `$queryRawUnsafe` salvo casos de solo-lectura muy puntuales. Migrar por entidad con doble escritura temporal.
- **Fabricante/Catálogo (F0.2):** entidades `Fabricante`, `Catalogo`, `ReglaPrecio`. Config declarativa en DB, editable desde admin. Nada hardcodeado por producto.
- **Cotizador (A.1):** motor determinista (catálogo × cantidad × reglas × margen piso 15%). IA **solo** para el texto del mensaje. Salida a PDF reutilizando el pipeline de manuales.
- **Inteligencia Comercial (A.2):** empaquetar el scraper actual como servicio "best-effort" con caché; el agente lee de la base, no scrapea en vivo en cada corrida.
- **Omnicanal (B.1):** abstraer "canal" (WhatsApp/Instagram) detrás de una interfaz común; una sola tabla de conversaciones.
- **Agentes:** mantener el motor actual. Cambiar **cuáles** están encendidos y con qué reglas, no el motor. IA siempre último recurso; por defecto modo asistido con cola de aprobaciones.
- **Costos IA:** sumar tablero histórico sobre la estimación que ya existe. Poner límite de gasto por agente configurable.
- **Vercel:** seguir en Hobby; trabajos largos por cron/lotes. Pasar a Pro solo si el Cotizador o el scraping lo exigen.

---

## Mi propuesta (donde difiero de la idea original)

Tu instinto de "armar todos los agentes" es entendible, pero **el orden importa más que la cantidad**. Propongo:

1. **No sumar agentes nuevos todavía.** Primero datos limpios (F0.1) y catálogo configurable (F0.2).
2. **Encender agentes por retorno, no por completitud.** Cotizador primero (toca plata directa), Taller/BOM último (rinde con volumen).
3. **La IA sigue siendo último recurso.** Todo lo que se puede hacer con código determinista, se hace con código — así ahorrás tokens, que es algo que ya pediste.

Con poco tráfico, la ventaja no está en tener 8 agentes: está en tener **1 dominio de datos sólido + catálogo configurable + 1 cotizador que cierra ventas B2B**. Eso genera el volumen que después sí justifica el resto.

---

## Pendiente operativo abierto (no bloquea este documento)

- **Verificación WhatsApp→Aprobaciones:** quedó por confirmar que la acción propuesta por el agente de WhatsApp aparezca en la pantalla de Aprobaciones tras el último fix (commit `fe274ed`: lista `FALLBACK` sincronizada + inserción en `action_queue` observable). Cuando ejecutes el agente con el código ya desplegado, avisame qué frase sale en el log ("encolado en Aprobaciones" / "no se pudo encolar…" / la vieja "propone enviar_whatsapp"), y cierro ese punto.
- **Token permanente de WhatsApp:** pendiente de tu lado (lo ibas a crear con el instructivo del PDF).

---

**Esperando tu aprobación para empezar por la Fase 0. No implemento nada hasta tu OK.**
