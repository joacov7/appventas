"""
Pipeline completo:
  1. Scrapea reseñas de Google Maps (competidores en config/competidores.json)
  2. Filtra quejas con palabras clave y genera mensajes de abordaje
  3. Inserta/actualiza leads en Neon PostgreSQL
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from database import crear_tabla, upsert_leads, listar_leads
from scraper_maps import scrape_all
from filtrado import filtrar_y_generar


def run():
    print("=" * 55)
    print("  CAPTACIÓN DE LEADS — AppVentas")
    print("=" * 55)

    # 1. Asegurar que la tabla existe
    crear_tabla()

    # 2. Scrapear reseñas de todos los competidores
    print("\n[1/3] Scrapeando Google Maps...")
    reviews = scrape_all()

    if not reviews:
        print("[WARN] No se obtuvieron reseñas. Verificá las URLs en config/competidores.json")
        return

    # 3. Filtrar y generar mensajes
    print("\n[2/3] Filtrando y generando mensajes de abordaje...")
    leads = filtrar_y_generar(reviews)

    if not leads:
        print("[INFO] No se encontraron quejas que coincidan con las palabras clave.")
        return

    # 4. Insertar en Neon
    print(f"\n[3/3] Insertando {len(leads)} leads en Neon...")
    insertados = upsert_leads(leads)
    print(f"[OK] {insertados} leads guardados en leads_captacion.")

    # 5. Mostrar resumen
    print("\n─── RESUMEN ─────────────────────────────────────")
    rows = listar_leads()
    print(f"{'ID':<5} {'Autor':<20} {'★':<4} {'Competidor':<25} {'Estado':<12} {'Fecha'}")
    print("─" * 80)
    for row in rows:
        fecha = row[5].strftime("%d/%m %H:%M") if row[5] else "—"
        print(f"{row[0]:<5} {str(row[1]):<20} {str(row[2]):<4} {str(row[3]):<25} {str(row[4]):<12} {fecha}")


if __name__ == "__main__":
    run()
