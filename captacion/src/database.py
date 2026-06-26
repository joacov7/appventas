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
    """Crea la tabla leads_captacion si no existe."""
    sql = """
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
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
    print("[DB] Tabla leads_captacion lista.")


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


if __name__ == "__main__":
    print("[DB] Probando conexión a Neon...")
    crear_tabla()
    print("[DB] Conexión exitosa.")
