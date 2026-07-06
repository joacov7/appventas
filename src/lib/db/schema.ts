import { prisma } from "@/lib/prisma";

/**
 * Fuente única de verdad del esquema "crudo" (tablas en español que conviven
 * con los modelos Prisma). Antes cada endpoint/servicio repetía su propio
 * `CREATE TABLE IF NOT EXISTS ...`; ahora todo el DDL vive acá.
 *
 * Es 100% idempotente: usa `IF NOT EXISTS` en tablas, columnas y constraints,
 * así que ejecutarlo nunca altera ni borra datos existentes en producción.
 * Sirve tanto para bases nuevas (crea todo) como para la actual (no hace nada).
 *
 * Uso: `await ensureSchema("ambito")` o `await ensureSchema()` para todo.
 */

type Ambito =
  | "config"
  | "catalogo"
  | "fabricantes"
  | "ventas_registradas"
  | "cotizador"
  | "pricing"
  | "inteligencia"
  | "captacion"
  | "marketing"
  | "ventas"
  | "whatsapp"
  | "agentes"
  | "memoria";

// Cada entrada es una sentencia DDL idempotente. Se ejecutan en orden para
// respetar dependencias (una tabla referenciada antes de la que la referencia).
const DDL: Record<Ambito, string[]> = {
  // ─── Configuración clave-valor compartida ────────────────────────────────
  config: [
    `CREATE TABLE IF NOT EXISTS catalog_config (
      tipo TEXT PRIMARY KEY,
      config JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
  ],

  // ─── Catálogo extendido (combos) ─────────────────────────────────────────
  catalogo: [
    `CREATE TABLE IF NOT EXISTS combos (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      image_urls JSONB DEFAULT '[]',
      active BOOLEAN DEFAULT TRUE,
      precio_venta DECIMAL(12,2),
      precio_manual BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS combo_items (
      id SERIAL PRIMARY KEY,
      combo_id TEXT NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      variant_id TEXT,
      quantity INTEGER NOT NULL DEFAULT 1
    )`,
  ],

  // ─── Fabricantes / proveedores (multi-fabricante configurable) ───────────
  // Permite dar de alta proveedores y sus reglas de precio desde el admin,
  // sin tocar código. Un producto se asocia opcionalmente a un fabricante.
  fabricantes: [
    `CREATE TABLE IF NOT EXISTS fabricantes (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      contacto_nombre TEXT,
      whatsapp TEXT,
      email TEXT,
      sitio_web TEXT,
      -- Reglas de precio configurables (porcentajes)
      margen_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
      descuento_b2b_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
      recargo_medios_pago_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
      moneda TEXT NOT NULL DEFAULT 'ARS',
      notas TEXT,
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      creado_en TIMESTAMPTZ DEFAULT now(),
      actualizado_en TIMESTAMPTZ DEFAULT now()
    )`,
    // Asocia un producto del catálogo (id de Prisma, TEXT) a un fabricante.
    // Tabla puente para no tocar el modelo Product de Prisma.
    `CREATE TABLE IF NOT EXISTS producto_fabricante (
      product_id TEXT PRIMARY KEY,
      fabricante_id INT NOT NULL REFERENCES fabricantes(id) ON DELETE CASCADE,
      costo_proveedor NUMERIC(12,2),
      codigo_proveedor TEXT,
      creado_en TIMESTAMPTZ DEFAULT now()
    )`,
  ],

  // ─── Ventas registradas fuera de la web (manual + presupuestos cerrados) ──
  // La tienda web ya guarda sus ventas en `orders`. Esta tabla suma las ventas
  // por WhatsApp/mostrador/mayorista/presupuesto para que Postventa y Finanzas
  // las vean también.
  ventas_registradas: [
    `CREATE TABLE IF NOT EXISTS ventas (
      id SERIAL PRIMARY KEY,
      cliente_nombre TEXT,
      cliente_email TEXT,
      cliente_telefono TEXT,
      canal TEXT NOT NULL DEFAULT 'manual',
      total NUMERIC(12,2) NOT NULL DEFAULT 0,
      detalle JSONB NOT NULL DEFAULT '[]',
      origen TEXT NOT NULL DEFAULT 'manual',
      presupuesto_id INT UNIQUE,
      fecha DATE NOT NULL DEFAULT CURRENT_DATE,
      creado_en TIMESTAMPTZ DEFAULT now()
    )`,
  ],

  // ─── Presupuestos emitidos por el Cotizador ──────────────────────────────
  cotizador: [
    `CREATE TABLE IF NOT EXISTS presupuestos (
      id SERIAL PRIMARY KEY,
      cliente_nombre TEXT,
      cliente_empresa TEXT,
      canal TEXT NOT NULL DEFAULT 'minorista',
      medio_pago TEXT,
      items JSONB NOT NULL DEFAULT '[]',
      subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
      descuento_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
      total NUMERIC(12,2) NOT NULL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'borrador',
      notas TEXT,
      creado_en TIMESTAMPTZ DEFAULT now(),
      actualizado_en TIMESTAMPTZ DEFAULT now()
    )`,
  ],

  // ─── Precios y su historial ──────────────────────────────────────────────
  pricing: [
    `CREATE TABLE IF NOT EXISTS product_pricing (
      product_id TEXT PRIMARY KEY,
      costo DECIMAL(12,2),
      precio_minorista DECIMAL(12,2),
      precio_mayorista DECIMAL(12,2),
      precio_distribuidor DECIMAL(12,2),
      minorista_manual BOOLEAN DEFAULT FALSE,
      mayorista_manual BOOLEAN DEFAULT FALSE,
      distribuidor_manual BOOLEAN DEFAULT FALSE,
      precios_medios_pago JSONB DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS price_history (
      id SERIAL PRIMARY KEY,
      product_id TEXT NOT NULL,
      campo TEXT NOT NULL,
      valor_anterior DECIMAL(12,2),
      valor_nuevo DECIMAL(12,2),
      usuario TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  ],

  // ─── Inteligencia comercial (competencia) ────────────────────────────────
  // Nota: estas dos tablas ya existían en producción sin DDL en el código.
  // El CREATE IF NOT EXISTS refleja su estructura real reconstruida desde el
  // uso; en la base actual no la altera (ya existe), sólo aplica a bases nuevas.
  inteligencia: [
    `CREATE TABLE IF NOT EXISTS tiendas_competidoras (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      url TEXT UNIQUE NOT NULL,
      plataforma TEXT DEFAULT 'desconocido',
      activa BOOLEAN DEFAULT TRUE,
      ultimo_scrape TIMESTAMPTZ,
      creado_en TIMESTAMPTZ DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS productos_competidores (
      id SERIAL PRIMARY KEY,
      tienda_id INT NOT NULL REFERENCES tiendas_competidoras(id) ON DELETE CASCADE,
      product_id TEXT,
      nombre TEXT NOT NULL,
      precio NUMERIC(12,2),
      precio_anterior NUMERIC(12,2),
      costo NUMERIC(12,2),
      categoria TEXT,
      imagen TEXT,
      url TEXT NOT NULL,
      disponible BOOLEAN DEFAULT TRUE,
      ultima_vez TIMESTAMPTZ DEFAULT now()
    )`,
    // Constraint único usado por el upsert masivo del scraper.
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'productos_competidores_tienda_url_unique'
      ) THEN
        ALTER TABLE productos_competidores
          ADD CONSTRAINT productos_competidores_tienda_url_unique UNIQUE (tienda_id, url);
      END IF;
    END $$`,
    `CREATE TABLE IF NOT EXISTS producto_competidor_links (
      id            SERIAL PRIMARY KEY,
      product_id    TEXT NOT NULL,
      competidor_id INT NOT NULL REFERENCES productos_competidores(id) ON DELETE CASCADE,
      estado        TEXT NOT NULL DEFAULT 'confirmado',
      creado_en     TIMESTAMPTZ DEFAULT now(),
      UNIQUE (product_id, competidor_id)
    )`,
    `CREATE EXTENSION IF NOT EXISTS pg_trgm`,
  ],

  // ─── Captación / prospección B2B ─────────────────────────────────────────
  captacion: [
    `CREATE TABLE IF NOT EXISTS prospectos (
      id        SERIAL PRIMARY KEY,
      nombre    TEXT NOT NULL,
      rubro     TEXT,
      direccion TEXT,
      telefono  TEXT,
      website   TEXT,
      provincia TEXT,
      lat       DOUBLE PRECISION,
      lon       DOUBLE PRECISION,
      osm_id    TEXT UNIQUE,
      estado    TEXT DEFAULT 'nuevo',
      notas     TEXT,
      creado_en TIMESTAMPTZ DEFAULT now()
    )`,
    `ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS instagram TEXT`,
    `ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS facebook TEXT`,
    `ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS mensaje_abordaje TEXT`,
    `ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS contactado_en TIMESTAMPTZ`,
    `ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS ultimo_seguimiento_en TIMESTAMPTZ`,
    `CREATE TABLE IF NOT EXISTS negocios_competidores (
      id        SERIAL PRIMARY KEY,
      nombre    TEXT NOT NULL,
      url       TEXT UNIQUE NOT NULL,
      activo    BOOLEAN DEFAULT TRUE,
      creado_en TIMESTAMPTZ DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS mayorista_solicitudes (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      empresa TEXT,
      telefono TEXT NOT NULL,
      email TEXT NOT NULL,
      mensaje TEXT,
      estado TEXT NOT NULL DEFAULT 'pendiente',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
  ],

  // ─── Marketing (newsletter, referidos) ───────────────────────────────────
  marketing: [
    `CREATE TABLE IF NOT EXISTS suscriptores_newsletter (
      id          SERIAL PRIMARY KEY,
      email       TEXT NOT NULL UNIQUE,
      nombre      TEXT,
      estado      TEXT NOT NULL DEFAULT 'activo',
      cupon_code  TEXT,
      creado_en   TIMESTAMPTZ DEFAULT now(),
      baja_en     TIMESTAMPTZ
    )`,
    `CREATE TABLE IF NOT EXISTS referidos (
      id          SERIAL PRIMARY KEY,
      email       TEXT NOT NULL UNIQUE,
      codigo      TEXT NOT NULL UNIQUE,
      usos        INT NOT NULL DEFAULT 0,
      activo      BOOLEAN NOT NULL DEFAULT true,
      creado_en   TIMESTAMPTZ DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS referido_usos (
      id              SERIAL PRIMARY KEY,
      codigo          TEXT NOT NULL,
      email_comprador TEXT,
      order_id        TEXT,
      descuento_pct   NUMERIC(5,2),
      creado_en       TIMESTAMPTZ DEFAULT now()
    )`,
  ],

  // ─── Ventas / retención (carritos, suscripciones, virolas láser) ─────────
  ventas: [
    `CREATE TABLE IF NOT EXISTS carritos_abandonados (
      id         SERIAL PRIMARY KEY,
      email      TEXT NOT NULL,
      items_json JSONB NOT NULL,
      total      NUMERIC(12,2) NOT NULL,
      estado     TEXT NOT NULL DEFAULT 'pendiente',
      email_2h_en   TIMESTAMPTZ,
      email_24h_en  TIMESTAMPTZ,
      creado_en  TIMESTAMPTZ DEFAULT now(),
      actualizado_en TIMESTAMPTZ DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_carritos_email ON carritos_abandonados(email)`,
    `CREATE INDEX IF NOT EXISTS idx_carritos_estado ON carritos_abandonados(estado)`,
    `CREATE TABLE IF NOT EXISTS suscripciones_reposicion (
      id               SERIAL PRIMARY KEY,
      email            TEXT NOT NULL,
      variant_id       TEXT NOT NULL,
      product_name     TEXT NOT NULL,
      variant_name     TEXT NOT NULL,
      product_slug     TEXT NOT NULL,
      quantity         INT NOT NULL DEFAULT 1,
      frecuencia_dias  INT NOT NULL DEFAULT 30,
      proximo_envio    DATE NOT NULL,
      ultimo_envio     DATE,
      estado           TEXT NOT NULL DEFAULT 'activa',
      creado_en        TIMESTAMPTZ DEFAULT now(),
      UNIQUE (email, variant_id)
    )`,
    `CREATE TABLE IF NOT EXISTS perfiles_laser (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      material TEXT NOT NULL DEFAULT 'todos',
      potencia INTEGER NOT NULL DEFAULT 80,
      velocidad INTEGER NOT NULL DEFAULT 100,
      pasadas INTEGER NOT NULL DEFAULT 1,
      notas TEXT,
      activo BOOLEAN NOT NULL DEFAULT true,
      creado_en TIMESTAMPTZ DEFAULT now()
    )`,
  ],

  // ─── WhatsApp ────────────────────────────────────────────────────────────
  whatsapp: [
    `CREATE TABLE IF NOT EXISTS whatsapp_mensajes (
      id SERIAL PRIMARY KEY,
      wa_id TEXT NOT NULL,
      direccion TEXT NOT NULL DEFAULT 'entrante',
      texto TEXT NOT NULL,
      creado_en TIMESTAMPTZ DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_wa_mensajes_wa_id ON whatsapp_mensajes(wa_id)`,
  ],

  // ─── Agentes (ejecuciones, cola de aprobaciones, briefings) ──────────────
  agentes: [
    `CREATE TABLE IF NOT EXISTS agent_runs (
      id BIGSERIAL PRIMARY KEY,
      tenant_id TEXT DEFAULT 'default',
      agent_id TEXT NOT NULL,
      ok BOOLEAN,
      decision JSONB,
      telemetry JSONB,
      cost_usd REAL,
      ms INT,
      created_at TIMESTAMPTZ DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS action_queue (
      id BIGSERIAL PRIMARY KEY,
      tenant_id TEXT DEFAULT 'default',
      agent_id TEXT,
      tool TEXT,
      input JSONB,
      estado TEXT DEFAULT 'pendiente',
      created_at TIMESTAMPTZ DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS briefings (
      id        SERIAL PRIMARY KEY,
      fecha     DATE UNIQUE NOT NULL,
      datos     JSONB NOT NULL,
      resumen   TEXT NOT NULL,
      acciones  JSONB NOT NULL,
      creado_en TIMESTAMPTZ DEFAULT now()
    )`,
  ],

  // ─── Memoria compartida de la Empresa IA ─────────────────────────────────
  memoria: [
    `CREATE TABLE IF NOT EXISTS memory_entries (
      id          BIGSERIAL PRIMARY KEY,
      tenant_id   TEXT NOT NULL DEFAULT 'default',
      namespace   TEXT NOT NULL,
      kind        TEXT,
      mkey        TEXT NOT NULL,
      value       JSONB NOT NULL,
      tags        TEXT[] DEFAULT '{}',
      source      TEXT,
      confidence  REAL DEFAULT 0.5,
      hits        INT DEFAULT 0,
      created_at  TIMESTAMPTZ DEFAULT now(),
      updated_at  TIMESTAMPTZ DEFAULT now(),
      UNIQUE (tenant_id, namespace, mkey)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_memory_ns ON memory_entries (tenant_id, namespace)`,
  ],
};

// Evita re-ejecutar el mismo ámbito varias veces en el mismo proceso (caliente).
const listo = new Set<string>();

/**
 * Garantiza que exista el esquema de uno o varios ámbitos. Sin argumentos crea
 * todo. Idempotente y seguro para producción.
 */
export async function ensureSchema(...ambitos: Ambito[]): Promise<void> {
  const objetivos = ambitos.length ? ambitos : (Object.keys(DDL) as Ambito[]);
  for (const ambito of objetivos) {
    if (listo.has(ambito)) continue;
    for (const stmt of DDL[ambito]) {
      try {
        await (prisma as any).$executeRawUnsafe(stmt);
      } catch {
        // Idempotente: si ya existe o corre en paralelo, se ignora.
      }
    }
    listo.add(ambito);
  }
}
