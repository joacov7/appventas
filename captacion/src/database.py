import os
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

load_dotenv()


def get_connection():
    url = os.getenv("DATABASE_URL")
    if not url:
        raise ValueError("DATABASE_URL no está configurada en .env")
    return psycopg2.connect(url)


def crear_tabla():
    """Crea las tablas de captación si no existen."""
    sqls = [
        """
        CREATE TABLE IF NOT EXISTS leads_captacion (
            id          SERIAL PRIMARY KEY,
            autor       VARCHAR(255),
            calificacion INT,
            texto_queja TEXT,
            url_perfil  VARCHAR(512) UNIQUE,
            competidor  VARCHAR(255),
            mensaje_abordaje TEXT,
            estado      VARCHAR(50) DEFAULT 'nuevo',
            creado_en   TIMESTAMP DEFAULT NOW()
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS negocios_competidores (
            id         SERIAL PRIMARY KEY,
            nombre     VARCHAR(500) NOT NULL,
            url        VARCHAR(1000) UNIQUE NOT NULL,
            activo     BOOLEAN DEFAULT TRUE,
            creado_en  TIMESTAMP DEFAULT NOW()
        );
        """,
    ]
    with get_connection() as conn:
        with conn.cursor() as cur:
            for sql in sqls:
                cur.execute(sql)
        conn.commit()
    print("[DB] Tablas captación listas.")


def cargar_negocios_activos() -> list[dict]:
    """Carga negocios competidores activos cargados manualmente."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, nombre, url FROM negocios_competidores WHERE activo = TRUE ORDER BY creado_en"
                )
                rows = cur.fetchall()
        return [{"id": r[0], "nombre": r[1], "url": r[2]} for r in rows]
    except Exception as e:
        print(f"[WARN] cargar_negocios_activos: {e}")
        return []


def upsert_leads(leads: list[dict]):
    """
    Inserta leads nuevos o actualiza el mensaje_abordaje si el url_perfil ya existe.
    Retorna la cantidad de filas afectadas.
    """
    if not leads:
        return 0

    sql = """
    INSERT INTO leads_captacion (autor, calificacion, texto_queja, url_perfil, competidor, mensaje_abordaje)
    VALUES %s
    ON CONFLICT (url_perfil)
    DO UPDATE SET
        calificacion     = EXCLUDED.calificacion,
        texto_queja      = EXCLUDED.texto_queja,
        mensaje_abordaje = EXCLUDED.mensaje_abordaje,
        creado_en        = NOW();
    """

    rows = [
        (
            lead["autor"],
            lead["calificacion"],
            lead["texto_queja"],
            lead["url_perfil"],
            lead["competidor"],
            lead["mensaje_abordaje"],
        )
        for lead in leads
    ]

    with get_connection() as conn:
        with conn.cursor() as cur:
            execute_values(cur, sql, rows)
        conn.commit()

    return len(rows)


def listar_leads(estado: str = None):
    """Lista los leads, opcionalmente filtrados por estado."""
    sql = "SELECT id, autor, calificacion, competidor, estado, creado_en FROM leads_captacion"
    params = []
    if estado:
        sql += " WHERE estado = %s"
        params.append(estado)
    sql += " ORDER BY creado_en DESC LIMIT 50;"

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall()


# ── Inteligencia de precios ──────────────────────────────────────────────────

def crear_tablas_inteligencia():
    sqls = [
        """
        CREATE TABLE IF NOT EXISTS busquedas_competidores (
            id           SERIAL PRIMARY KEY,
            termino      VARCHAR(500) NOT NULL,
            plataforma   VARCHAR(50)  DEFAULT 'todas',
            activa       BOOLEAN      DEFAULT TRUE,
            umbral_alerta INT         DEFAULT 10,
            creado_en    TIMESTAMP    DEFAULT NOW()
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS tiendas_competidoras (
            id            SERIAL PRIMARY KEY,
            nombre        VARCHAR(500),
            url           VARCHAR(1000) UNIQUE NOT NULL,
            plataforma    VARCHAR(50),
            activa        BOOLEAN      DEFAULT TRUE,
            ultimo_scrape TIMESTAMP,
            creado_en     TIMESTAMP    DEFAULT NOW()
        );
        """,
        """
        CREATE TABLE IF NOT EXISTS productos_competidores (
            id              SERIAL PRIMARY KEY,
            tienda_id       INT REFERENCES tiendas_competidoras(id) ON DELETE CASCADE,
            nombre          VARCHAR(1000),
            precio          NUMERIC(12,2),
            precio_anterior NUMERIC(12,2),
            categoria       VARCHAR(500),
            url             VARCHAR(1000) UNIQUE NOT NULL,
            imagen          VARCHAR(2000),
            disponible      BOOLEAN   DEFAULT TRUE,
            ultima_vez      TIMESTAMP DEFAULT NOW(),
            creado_en       TIMESTAMP DEFAULT NOW()
        );
        """,
    ]
    with get_connection() as conn:
        with conn.cursor() as cur:
            for sql in sqls:
                cur.execute(sql)
        conn.commit()
    print("[DB] Tablas inteligencia listas.")


def seed_busquedas_default():
    """Inserta búsquedas por defecto si la tabla está vacía."""
    defaults = [
        ("mates mayorista Argentina", "tiendanube", 10),
        ("bombillas mates mayorista", "tiendanube", 10),
        ("tablas madera artesanal mayorista", "tiendanube", 10),
        ("mates madera mayorista", "empretienda", 10),
    ]
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM busquedas_competidores")
            count = cur.fetchone()[0]
            if count == 0:
                for termino, plat, umbral in defaults:
                    cur.execute(
                        "INSERT INTO busquedas_competidores (termino, plataforma, umbral_alerta) VALUES (%s, %s, %s)",
                        (termino, plat, umbral),
                    )
        conn.commit()
    print("[DB] Búsquedas default insertadas.")


def cargar_busquedas_activas():
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, termino, plataforma, umbral_alerta FROM busquedas_competidores WHERE activa = TRUE ORDER BY id"
            )
            rows = cur.fetchall()
    return [{"id": r[0], "termino": r[1], "plataforma": r[2], "umbral_alerta": r[3]} for r in rows]


def upsert_tienda(nombre: str, url: str, plataforma: str) -> int:
    """Inserta o actualiza una tienda, retorna su id."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO tiendas_competidoras (nombre, url, plataforma, ultimo_scrape)
                VALUES (%s, %s, %s, NOW())
                ON CONFLICT (url) DO UPDATE SET
                    nombre        = EXCLUDED.nombre,
                    ultimo_scrape = NOW()
                RETURNING id
                """,
                (nombre, url, plataforma),
            )
            tienda_id = cur.fetchone()[0]
        conn.commit()
    return tienda_id


def upsert_producto(tienda_id: int, producto: dict) -> dict:
    """
    Inserta o actualiza un producto. Retorna dict con cambio de precio si lo hubo.
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            # Precio anterior
            cur.execute("SELECT precio FROM productos_competidores WHERE url = %s", (producto["url"],))
            row = cur.fetchone()
            precio_anterior = float(row[0]) if row and row[0] else None
            precio_nuevo = producto.get("precio")

            cur.execute(
                """
                INSERT INTO productos_competidores
                    (tienda_id, nombre, precio, precio_anterior, categoria, url, imagen, disponible, ultima_vez)
                VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE, NOW())
                ON CONFLICT (url) DO UPDATE SET
                    nombre          = EXCLUDED.nombre,
                    precio_anterior = productos_competidores.precio,
                    precio          = EXCLUDED.precio,
                    categoria       = EXCLUDED.categoria,
                    imagen          = EXCLUDED.imagen,
                    disponible      = TRUE,
                    ultima_vez      = NOW()
                """,
                (
                    tienda_id,
                    producto.get("nombre"),
                    precio_nuevo,
                    precio_anterior,
                    producto.get("categoria"),
                    producto["url"],
                    producto.get("imagen"),
                ),
            )
        conn.commit()

    cambio = None
    if precio_anterior and precio_nuevo and precio_anterior != precio_nuevo:
        pct = round((precio_nuevo - precio_anterior) / precio_anterior * 100, 1)
        cambio = {"anterior": precio_anterior, "nuevo": precio_nuevo, "pct": pct}
    return cambio


if __name__ == "__main__":
    print("[DB] Probando conexión a Neon...")
    crear_tabla()
    crear_tablas_inteligencia()
    print("[DB] Conexión exitosa.")
